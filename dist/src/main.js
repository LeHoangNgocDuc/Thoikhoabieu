
import {DAYS,SHIFTS,addDays,monday,dayNumber,schoolWeek,classById,activeVersion,eventsForWeek,conflicts,ppctSequence,effectiveBaseline,parseDate,normalizeSheetData,tutoringForWeek,parseGroups,extraSlotOverlap,parseStreamPattern,progressAt,progressSummary,mathStreamPattern,applyStreamAssignments,recurringDateInWeek,previewMainRevision,previewMainOnce,compareVersions,tutoringForRange,EXTRA_CLASSES} from './core.js';
import {extractTeacherSchedule} from './importExcel.js';
import {SNAPSHOT_KEY,validateSnapshot,snapshotText} from './cache.js';
import {moveCollision,validateOfficialScope} from './core.js';
import {collapseTutorDisplay,MOBILE_PERIODS,planMobileWeekCells} from './mobileDisplay.js';

const $=s=>document.querySelector(s);
const newRequestId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FRONTEND_VERSION='1.8.4';
const COMPATIBLE_API_VERSION='1.8.4';
const PENDING_EXTRA_KEY='smart-tkb-extra-pending-v162';
const getSnapshot=()=>{try{return validateSnapshot(localStorage.getItem(SNAPSHOT_KEY));}catch{return null;}};
function writeSnapshot(data){try{localStorage.setItem(SNAPSHOT_KEY,snapshotText(data));}catch(e){console.warn('Không lưu được bộ nhớ đệm, ứng dụng vẫn dùng dữ liệu trực tuyến.');}}
const $state={data:null,mode:'checking',view:'overview',week:monday('2026-11-09'),filterClass:'all',filterShift:'all',filterSubject:'all',filterKind:'all',filterStream:'all',notice:'',edit:null,pendingImport:null,ppctGrade:'7',ppctSubject:'Toán',ppctStream:'all',ppctQuery:'',loggedIn:false,fitWeek:localStorage.getItem('smart-tkb-focus-v14')!=='off',calendarLayout:'week',dayIndex:2,backendConfigured:false,extraServerReady:null,extraServerVersion:'',extraSourceSheet:'',extraSourceTail:'',extraServerError:'',remoteError:'',savingExtra:false,drawerOpen:false,onlyExtra:false,statsClass:'all',statsSubject:'all',statsStream:'all',statsDate:'',statsPeriod:'today',extraList:null,extraListLoading:false,extraListQuery:'',extraGrade:'all',extraLetter:'all',extraPeriod:'week',extraPickerGrade:9,syncDiagnostics:null,extraPending:null,extraDay:'all',extraShift:'all',refreshing:false,sessionStatus:'checking',sessionCode:'',apiVersion:'',authError:'',lastHttpStatus:0,lastApiError:'',lastSyncedAt:'',updateAvailable:false,syncState:'idle',snapshotAt:'',cacheLoginRequired:false,clipboardMain:null,mainServerReady:false,baselineSavingId:''};
const shiftLabel=s=>({S:'Sáng',C:'Chiều',T:'Tối'})[s]||s;
const dayLabel=n=>DAYS.find(d=>d.n===n)?.label||n;
const className=id=>classById($state.data,id)?.name||id;
const options=(values,current)=>values.map(([value,label])=>`<option value="${esc(value)}" ${current===value?'selected':''}>${esc(label)}</option>`).join('');
const CLASS_OPTS=()=>{
 const list=[['all','Tất cả lớp'],...($state.data?.classes||[]).map(c=>[c.id,`${c.name} (${c.id})`])];
 const known=new Set(list.map(x=>x[0]));
 for(const ch of [...($state.data?.extra_sessions||[]),...($state.data?.extra_patterns||[])]){
  for(const name of parseGroups(ch.groups)){
   if(!known.has(name)){list.push([name,`${name} (dạy thêm)`]);known.add(name);}
  }
 }
 return list;
};
const weekEnd=()=>addDays($state.week,6);
const isExtra=e=>e?.kind==='EXTRA';
const classPalette=[['#eaf3ff','#2764bd'],['#e9f8ed','#16773c'],['#fff0df','#a95a0b'],['#f4ecff','#7546b6'],['#dcf7f4','#0b8278'],['#ffe8f0','#b02b63'],['#e7edff','#4c5dd7'],['#eaf7fa','#177c9d']];
const colorFor=id=>{const found=($state.data?.classes||[]).findIndex(c=>c.id===id);let n=found;if(n<0){n=[...String(id||'')].reduce((h,ch)=>h*31+ch.charCodeAt(0),0);n=Math.abs(n);}return classPalette[n%classPalette.length];};
const styleFor=id=>{const [bg,accent]=colorFor(id);return `--lesson-bg:${bg};--lesson-accent:${accent}`;};
const courses=()=>($state.data?.classes||[]).flatMap(c=>c.subjects.map(subject=>({id:`${c.id}|${subject}`,label:`${c.name} - ${subject}`,classId:c.id,subject})));
function notify(msg){$state.notice=msg;render();}
function apiError(response,j){
 const code=j?.code||((response.status===401)?'UNAUTHENTICATED':'UPSTREAM_ERROR');
 const err=new Error(j?.error||`Lỗi máy chủ HTTP ${response.status}`);
 err.code=code;err.status=response.status;
 $state.lastHttpStatus=response.status;$state.lastApiError=code;
 if(response.status===401){$state.mode=$state.data?'cached':'unauthenticated';$state.sessionStatus='expired';$state.cacheLoginRequired=true;$state.sessionCode=code;$state.loggedIn=false;$state.extraList=null;$state.authError=err.message;}
 return err;
}
async function serverRequest(path,opts={}){
 let r;
 try{r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts});}
 catch(e){const err=new Error('Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.');err.code='NETWORK_ERROR';$state.lastApiError=err.code;throw err;}
 const j=await r.json().catch(()=>({ok:false,code:'INVALID_RESPONSE',error:'Máy chủ trả về dữ liệu không hợp lệ'}));
 if(!r.ok||j.ok===false)throw apiError(r,j);
 $state.lastHttpStatus=r.status;$state.lastApiError='';return j;
}
async function callApi(body){return serverRequest('/api/tkb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
async function getSession(){
 const j=await serverRequest('/api/tkb?action=session');
 $state.backendConfigured=Boolean(j.backendConfigured);
 $state.apiVersion=String(j.apiVersion||'');$state.updateAvailable=Boolean($state.apiVersion&&!([FRONTEND_VERSION,COMPATIBLE_API_VERSION].includes($state.apiVersion)));
 $state.sessionStatus=j.authenticated?'authenticated':'unauthenticated';$state.sessionCode=j.code||'';
 return j;
}
async function persist(table,row){
 if($state.mode==='google'){
  await callApi({op:'save',table,row});await pullGoogle();
 }else{
  const arr=$state.data[table]||[];const index=arr.findIndex(x=>x.id===row.id);if(index>=0)arr[index]=row;else arr.push(row);cacheDemo();
 }
}
function cacheDemo(){localStorage.setItem('smart-tkb-demo-v1',JSON.stringify($state.data));}
async function probeExtraServer(){
 try{
   const r=await callApi({op:'probeExtra'});
   if(!r.extraWrites||!r.verifiedWrites||!Array.isArray(r.supportedActions)||!r.supportedActions.includes('CREATE'))throw Error('Apps Script chưa hỗ trợ xác minh ghi dạy thêm. Cập nhật Apps Script rồi triển khai Phiên bản mới trước khi sửa lịch.');
   $state.extraServerReady=true;$state.extraServerVersion=r.gasVersion||r.apiVersion||'không rõ';
   $state.mainServerReady=Boolean(r.verifiedMainWrites&&r.supportedMainActions?.includes('DELETE')&&r.supportedMainActions?.includes('COPY')&&r.mainScopes?.includes('one')&&r.mainScopes?.includes('future'));
   $state.extraSourceSheet=r.sourceSheetName||'';$state.extraSourceTail=r.sourceSheetIdTail||'';
   $state.extraServerError='';
   return r;
 }catch(e){
   const message=e.code==='INCOMPATIBLE_GAS'||e.code==='UNSUPPORTED_ACTION'?
     'Máy chủ GAS_URL chưa hỗ trợ ghi dạy thêm; kiểm tra phiên bản Vercel/API và deployment Apps Script tại Cấu hình & dữ liệu. '+e.message:e.message;
   $state.extraServerReady=false;$state.mainServerReady=false;$state.extraServerError=message;throw Error(message);
 }
}
async function pullGoogle(){
 const j=await serverRequest('/api/tkb');
 if(!j.data||!Array.isArray(j.data.classes)||!Array.isArray(j.data.extra_patterns)){
   const err=new Error('Phản hồi Google Sheets thiếu cấu trúc dữ liệu. Không thể thay thế bằng dữ liệu mẫu.');err.code='SHEETS_READ_FAILED';throw err;
 }
 $state.data=normalizeSheetData(j.data);$state.mode='google';$state.loggedIn=true;$state.sessionStatus='authenticated';
 $state.remoteError='';$state.authError='';$state.extraList=null;$state.lastSyncedAt=new Date().toISOString();$state.snapshotAt=$state.lastSyncedAt;$state.syncState='synced';$state.cacheLoginRequired=false;writeSnapshot($state.data);render();
 // The timetable has already rendered. Capability probing must never block the screen.
 probeExtraServer().then(()=>render()).catch(e=>{console.warn('Lưu dạy thêm chưa sẵn sàng:',e.code||'BACKEND_NOT_READY');render();});
 return $state.data;
}
async function refreshExtraList(){
 if($state.mode!=='google')throw Object.assign(new Error('Vui lòng đăng nhập trên thiết bị này để đọc lịch đã lưu.'),{code:'UNAUTHENTICATED'});
 $state.extraListLoading=true;render();
 try{
  const r=await callApi({op:'listExtra',week:$state.week});
  if(!Array.isArray(r.patterns)||!Array.isArray(r.sessions))throw Error('Máy chủ trả thiếu danh sách lịch dạy thêm');
  $state.extraList={patterns:normalizeSheetData({extra_patterns:r.patterns}).extra_patterns,
    sessions:normalizeSheetData({extra_sessions:r.sessions}).extra_sessions,counts:r.counts||{},lastRequest:r.lastRequest,readAt:new Date().toISOString(),apiVersion:r.apiVersion};
  // IMPORTANT: the listExtra endpoint is authoritative for tutoring. The earlier
  // code fetched it but rendered stale $state.data, producing 'already exists'
  // errors while the saved teaching session stayed invisible.
  $state.data={...$state.data,extra_patterns:$state.extraList.patterns,extra_sessions:$state.extraList.sessions};
  writeSnapshot($state.data);
  return $state.extraList;
 }finally{$state.extraListLoading=false;render();}
}
function extraOccurrenceVisible(answer,action,row){
 const matched=tutoringForWeek($state.data,monday(row.date)).filter(x=>x.date===row.date&&x.shift===row.shift&&Number(x.period)===Number(row.period));
 const target=matched.find(x=>x.id===answer.entityId||x.patternId===answer.entityId);
 return ['DELETE_ONE','DELETE_SERIES','STOP_FUTURE','CANCEL_ONCE'].includes(action)?!target:!!target&&
  parseGroups(target.groups).join('\u001f')===parseGroups(row.groups).join('\u001f');
}
async function checkPendingExtra(){
 const raw=localStorage.getItem(PENDING_EXTRA_KEY);if(!raw)return null;
 let pending;try{pending=JSON.parse(raw)}catch{localStorage.removeItem(PENDING_EXTRA_KEY);return null;}
 if(!pending.requestId)return null;
 try{
  const r=await callApi({op:'extraStatus',requestId:pending.requestId});
  $state.extraPending={...pending,status:r};
  if(r.verified===true&&$state.data){
   const visible=!pending.row||extraOccurrenceVisible({entityId:r.entityId},pending.action,pending.row);
   $state.extraPending.visible=visible;
   if(visible){localStorage.removeItem(PENDING_EXTRA_KEY);$state.extraPending=null;}
  }
  return r;
 }catch(err){$state.extraPending={...pending,error:err.message};return null;}
}
async function init(){
 // Stale-while-revalidate: render a previously VERIFIED Google Sheets snapshot synchronously.
 // A snapshot is NEVER an authorization credential. All writes require the server's HttpOnly cookie.
 const last=getSnapshot();
 if(last){$state.data=normalizeSheetData(last.data);$state.mode='cached';$state.snapshotAt=last.savedAt;$state.syncState='checking';$state.sessionStatus='checking';render();}
 else {$state.mode='checking';$state.syncState='checking';$state.sessionStatus='checking';render();}
 try{
   const sess=await getSession();
   if(!sess.backendConfigured){$state.mode=last?'cached':'unconfigured';$state.syncState='error';$state.authError='Vercel chưa có GAS_URL/GAS_API_KEY.';}
   else if(!sess.authenticated){$state.mode=last?'cached':'unauthenticated';$state.cacheLoginRequired=true;$state.syncState='login-required';$state.authError='Cần đăng nhập trên thiết bị này để đồng bộ và chỉnh sửa.';}
   else{
     $state.syncState='syncing';render();
     try{await pullGoogle();await checkPendingExtra();if($state.view==='extraList')await refreshExtraList();}
     catch(e){if(e.status===401){$state.mode=$state.data?'cached':'unauthenticated';$state.cacheLoginRequired=true;$state.syncState='login-required';$state.authError='Phiên hết hạn. Cần đăng nhập lại để đồng bộ.';}
      else{$state.mode=$state.data?'cached':'connection-error';$state.syncState='error';$state.remoteError=e.message;$state.authError=`Không đọc được Google Sheets: ${e.message}`;}}
   }
 }catch(e){$state.mode=$state.data?'cached':e.status===401?'unauthenticated':'connection-error';$state.syncState='error';$state.authError=e.message;$state.remoteError=e.message;}
 render();
}
function connectionPage(){
 const expired=$state.mode==='unauthenticated';
 const loading=$state.mode==='checking';
 const noServer=$state.mode==='unconfigured';
 const code=$state.sessionCode||$state.lastApiError||(expired?'UNAUTHENTICATED':noServer?'BACKEND_NOT_CONFIGURED':'NETWORK_ERROR');
 return `<div class="auth-page"><div class="auth-card"><div class="auth-logo">TK</div><p class="eyebrow">SMART TKB · NAM NHA TRANG</p>
  <h1>${loading?'Đang kiểm tra phiên đăng nhập':expired?'Đăng nhập Smart TKB':noServer?'Máy chủ chưa được cấu hình':'Không thể tải dữ liệu Google Sheets'}</h1>
  <p class="auth-description">${loading?'Ứng dụng đang xác minh phiên trên thiết bị này…':expired?'Máy tính và điện thoại đăng nhập độc lập. Dữ liệu vẫn được giữ trên cùng Google Sheets.':noServer?'Kiểm tra các biến môi trường Production trong Vercel.':'Phiên có thể vẫn hợp lệ nhưng máy chủ chưa phản hồi. Dữ liệu Google Sheets không bị xóa.'}</p>
  ${!loading?`<div class="auth-details" role="status">${esc($state.authError||'')}<small>Mã: ${esc(code)}${$state.lastHttpStatus>=400?' · HTTP '+$state.lastHttpStatus:''}</small></div>`:''}
  ${expired?`<label for="login-pass">Mật khẩu Smart TKB</label><input id="login-pass" type="password" autocomplete="current-password" placeholder="Nhập APP_PASSWORD"/><button class="btn primary auth-main" data-action="login">Đăng nhập và đồng bộ</button>`:''}
  ${!loading?`<div class="auth-actions"><button class="btn soft" data-action="recheck-session">↻ Kiểm tra lại kết nối</button>${$state.updateAvailable?'<button class="btn soft" data-action="refresh-app">Cập nhật ứng dụng</button>':''}</div>`:''}
  <p class="auth-footer">Giáo viên: Lê Hoàng Ngọc Đức · Frontend ${FRONTEND_VERSION}${$state.apiVersion?' · API '+esc($state.apiVersion):''}<br>Không sử dụng dữ liệu mẫu khi chưa đăng nhập vào hệ thống thật.</p>
 </div></div>`;
}
async function loginAndSync(){
 const password=$('#login-pass')?.value;
 if(!password)throw Error('Vui lòng nhập mật khẩu.');
 await serverRequest('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
 $state.sessionStatus='authenticated';
 try{await pullGoogle();if($state.view==='extraList')await refreshExtraList();$state.notice='Đã đăng nhập và đọc dữ liệu thật từ Google Sheets.';render();}
 catch(e){$state.mode=e.status===401?'unauthenticated':'connection-error';$state.authError='Đã đăng nhập nhưng chưa đọc được Google Sheets: '+e.message;render();}
}
function sideFilters(){
 if(!['calendar','extra','overview'].includes($state.view))return '';
 return `<div class="side-filter-section"><div class="navtitle">BỘ LỌC LỊCH</div>
 <label>Lớp / nhóm</label><select id="f-class">${options(CLASS_OPTS(),$state.filterClass)}</select>
 <label>Buổi</label><select id="f-shift">${options([['all','Cả ngày'],['S','Sáng'],['C','Chiều'],['T','Tối']],$state.filterShift)}</select>
 <label>Môn học</label><select id="f-subject">${options([['all','Toán + Tin'],['Toán','Toán'],['Tin','Tin']],$state.filterSubject)}</select>
 <label>Mạch Toán</label><select id="f-stream">${options([['all','ĐS + HH'],['ĐS','Đại số'],['HH','Hình học']],$state.filterStream)}</select>
 ${$state.view==='extra'?`<label class="extra-only-side"><input type="checkbox" id="only-extra" ${$state.onlyExtra?'checked':''}> Chỉ hiển thị dạy thêm</label>`:''}
 <button class="btn ghost full" data-action="reset-filters">Xóa bộ lọc</button>
 <div class="side-legend"><strong>Màu nhận diện lớp</strong>${($state.data?.classes||[]).map(c=>`<div><i style="background:${colorFor(c.id)[1]}"></i>${esc(c.name)} <small>${esc(c.id)}</small></div>`).join('')}</div></div>`;
}
function drawerTools(){
 const isCalendar=['calendar','extra','overview'].includes($state.view);
 const stats=$state.view==='statistics';
 const extraList=$state.view==='extraList';
 const cls=$state.data?.classes||[];
 return `<div class="drawer-tools"><div class="navtitle">HIỂN THỊ & CÔNG CỤ</div>
 <div class="drawer-connection"><strong>${$state.mode==='google'?'● Đã kết nối Google Sheets':'◌ Đang xem bản lưu'}</strong><small>Web ${FRONTEND_VERSION} · API ${esc($state.apiVersion||'?')}</small>${$state.mode==='cached'?`<small>Đồng bộ: ${esc($state.syncState==='checking'||$state.syncState==='syncing'?'Đang kiểm tra Sheet':$state.authError||'Chưa đồng bộ')}</small>`:''}</div>
 <button class="btn soft full" data-action="refresh-google">↻ Đồng bộ Google Sheets</button><button class="btn soft full" data-action="today">Trở về tuần hiện tại</button>
 ${$state.updateAvailable?'<button class="btn primary full" data-action="refresh-app">Cập nhật ứng dụng</button>':''}
 ${$state.mode==='cached'?`<button class="btn soft full" data-action="${$state.cacheLoginRequired?'show-cache-login':'recheck-session'}">${$state.cacheLoginRequired?'Đăng nhập để đồng bộ':'Kiểm tra lại kết nối'}</button>`:''}
 ${$state.notice?`<div class="drawer-message" role="status">${esc($state.notice)} <button data-action="clear-notice" aria-label="Xóa thông báo">×</button></div>`:''}
 ${$state.extraPending?`<div class="drawer-message">Có yêu cầu Dạy thêm cần xác minh <button class="btn small" data-action="check-pending-extra">Kiểm tra lại</button></div>`:''}
 ${isCalendar?`<div class="drawer-toolset"><strong>Chế độ lịch</strong><div class="drawer-option-grid"><button class="btn ${$state.calendarLayout==='week'?'primary':'soft'}" data-action="layout-week">Toàn tuần</button><button class="btn ${$state.calendarLayout==='day'?'primary':'soft'}" data-action="layout-day">Theo ngày</button></div><div class="drawer-option-grid">${[['calendar','Chính khóa'],['extra','Dạy thêm'],['overview','Tổng hợp']].map(([id,label])=>`<button class="btn ${$state.view===id?'primary':'soft'}" data-view="${id}">${label}</button>`).join('')}</div><button class="btn soft full" data-action="fit-week">${$state.fitWeek?'Giao diện đầy đủ':'Thu gọn giao diện'}</button><button class="btn soft full" data-action="fullscreen-week">Toàn màn hình</button><button class="btn soft full" data-action="export">Xuất lịch CSV</button><button class="btn soft full" data-action="print">In thời khóa biểu</button></div>`:''}
 ${stats?`<div class="drawer-toolset"><strong>Bộ lọc thống kê</strong><label>Mốc thống kê<select id="drawer-stats-period">${options([['today','Đến hôm nay'],['week','Đến hết tuần'],['hk1','Học kỳ I'],['hk2','Năm học'],['custom','Chọn ngày']],$state.statsPeriod)}</select></label><label>Ngày<input id="drawer-stats-date" type="date" value="${esc($state.statsDate||vietnamToday())}" ${$state.statsPeriod==='custom'?'':'disabled'}></label><label>Lớp<select id="drawer-stats-class">${options([['all','Tất cả lớp'],...cls.map(c=>[c.id,c.name])],$state.statsClass)}</select></label><label>Môn<select id="drawer-stats-subject">${options([['all','Toán và Tin'],['Toán','Toán'],['Tin','Tin']],$state.statsSubject)}</select></label><label>Mạch<select id="drawer-stats-stream">${options([['all','Tất cả mạch'],['ĐS','Đại số'],['HH','Hình học'],['TIN','Tin học']],$state.statsStream)}</select></label><button class="btn soft full" data-action="export-statistics">Xuất thống kê CSV</button></div>`:''}
 ${extraList?`<div class="drawer-toolset"><strong>Lọc danh sách dạy thêm</strong><label>Khối<select id="drawer-extra-grade">${options([['all','Tất cả'],...[6,7,8,9,10,11,12].map(n=>[String(n),'Khối '+n])],$state.extraGrade)}</select></label><label>Lớp<select id="drawer-extra-letter">${options([['all','Tất cả'],['A','A'],['B','B'],['C','C']],$state.extraLetter)}</select></label><label>Thời gian<select id="drawer-extra-period">${options([['week','Theo tuần'],['month','Theo tháng']],$state.extraPeriod)}</select></label><label>Ngày<select id="drawer-extra-day">${options([['all','Cả tuần'],...DAYS.map(d=>[String(d.n),d.label])],$state.extraDay)}</select></label><label>Buổi<select id="drawer-extra-shift">${options([['all','Cả ngày'],['S','Sáng'],['C','Chiều'],['T','Tối']],$state.extraShift)}</select></label><label>Tìm lớp / bài<input id="drawer-extra-list-search" value="${esc($state.extraListQuery)}" placeholder="Nhập từ khóa..."></label></div>`:''}
 </div>`;
}
function showTop(){
 const d=$state.data;
 const official=eventsForWeek(d,$state.week).filter(e=>e.kind!=='EXTRA');
 const extras=tutoringForWeek(d,$state.week);
 const all=[...official,...extras];
 const combined=conflicts(all);
 const err=['extra','overview'].includes($state.view)?combined:conflicts(official);
 const events=['extra','overview'].includes($state.view)?all:official;
 return `<header class="topbar"><div class="mobile-topline"><button class="mobile-menu" data-action="toggle-drawer" aria-label="Mở menu chức năng" aria-expanded="${$state.drawerOpen?'true':'false'}" aria-controls="side-menu">☰</button><button class="mobile-week-arrow" data-action="prev-week" aria-label="Tuần trước">‹</button><strong class="mobile-week-title">Tuần ${schoolWeek($state.week)} · ${fmt($state.week)} – ${fmt(weekEnd())}</strong><button class="mobile-week-arrow" data-action="next-week" aria-label="Tuần sau">›</button><button class="mobile-view-toggle" data-action="cycle-calendar-view" aria-label="Chuyển nhanh Chính khóa, Dạy thêm, Tổng hợp" title="${$state.view==='overview'?'Tổng hợp':$state.view==='calendar'?'Chính khóa':$state.view==='extra'?'Dạy thêm':'Về Thời khóa biểu'}">${$state.view==='calendar'?'CK':$state.view==='extra'?'DT':'▦'}</button></div><button class="top-menu-toggle" data-action="toggle-drawer" aria-label="Mở thanh menu">☰</button><div class="brandmark">TK</div><div class="brandtext"><h1>Smart TKB<span>·</span> Lê Hoàng Ngọc Đức</h1><p>THCS Nam Nha Trang – Phân hiệu Vĩnh Trường</p></div><div class="topright"><span class="pill ${$state.mode==='google'?'good':'muted'}">${$state.mode==='google'?'● Google Sheets':$state.syncState==='login-required'?'🔒 Bản lưu · cần đăng nhập':$state.syncState==='error'?'⚠ Bản lưu · lỗi đồng bộ':'◌ Bản lưu · đang đồng bộ Sheet...'}</span>${$state.updateAvailable?'<button class="btn soft" data-action="refresh-app">Cập nhật ứng dụng</button>':''}<button class="btn ghost" data-action="refresh-google">↻ Tải lại Google Sheets</button><button class="btn ghost" data-action="open-settings">${$state.mode==='google'?'Đã kết nối':'Kết nối Google'}</button></div></header>
 <div class="shell">${$state.drawerOpen?'<button class="drawer-scrim" data-action="close-drawer" aria-label="Đóng bộ lọc"></button>':''}<aside class="sidebar ${$state.drawerOpen?'drawer-open':''}" id="side-menu"><div class="side-mobilehead"><strong>☰ Lê Hoàng Ngọc Đức</strong><button class="icon-btn" data-action="close-drawer">×</button></div><div class="navtitle">QUẢN LÝ GIẢNG DẠY</div>
 ${[['overview','▦','Thời khóa biểu 7 ngày'],['calendar','◫','Dạy chính thức & Tăng vượt'],['extra','◈','Dạy thêm · Ngoài PPCT'],['extraList','☷','Danh sách dạy thêm'],['overview','◫','TKB đầy đủ'],['statistics','▥','Thống kê tiến độ'],['progress','◷','PPCT & tiến độ'],['versions','⇄','Phiên bản TKB'],['settings','⚙','Cấu hình & dữ liệu']].map(([k,icon,label])=>`<button class="navitem ${$state.view===k?'selected':''}" data-view="${k}"><span class="navicon">${icon}</span>${label}</button>`).join('')}
 ${drawerTools()}${sideFilters()}<div class="sidefooter"><div class="stat-label">Năm học 2026 – 2027</div><div class="stat-desc">7 lớp chính khóa · 7 ngày/tuần<br>Sáng 5 tiết · Chiều 5 tiết · Tối 2 suất</div></div></aside><main class="content">${$state.notice?`<div class="notice">${esc($state.notice)}<button data-action="clear-notice">×</button></div>`:''}
 ${$state.mode==='cached'?`<div class="cache-notice" role="status"><strong>📋 Đang xem bản lưu gần nhất (${esc($state.snapshotAt?new Date($state.snapshotAt).toLocaleString('vi-VN'):'không rõ')})</strong> · ${esc($state.syncState==='checking'||$state.syncState==='syncing'?'Đang kiểm tra và đồng bộ Sheet...':$state.authError||'Chưa đồng bộ được')} <button class="btn soft" data-action="${$state.cacheLoginRequired?'show-cache-login':'recheck-session'}">${$state.cacheLoginRequired?'Đăng nhập để đồng bộ':'Thử lại'}</button></div>`:''}
 ${$state.extraPending?`<div class="pending-sync"><strong>⚠ Có yêu cầu dạy thêm cần xác minh</strong><span>${esc($state.extraPending.requestId)} · ${esc($state.extraPending.status?.state||$state.extraPending.error||'Đang kiểm tra')}</span><button data-action="check-pending-extra" class="btn soft">Kiểm tra lại</button></div>`:''}
 ${['calendar','extra','overview'].includes($state.view)?calendarPage(events,err):$state.view==='extraList'?extraListPage():$state.view==='statistics'?statisticsPage():$state.view==='progress'?progressPage():$state.view==='versions'?versionsPage():settingsPage()}
 </main></div>`;
}
function dayBoard(events,conflictKeys,page){
 const day=$state.dayIndex,date=addDays($state.week,day-2);
 const slots=SHIFTS.flatMap(sh=>Array.from({length:sh.count},(_,i)=>({shift:sh.id,period:i+1})));
 const oneDay=events.filter(e=>e.date===date&&(!($state.view==='extra'&&$state.onlyExtra)||e.kind==='EXTRA'));
 const cards=slots.map(slot=>{
  const matches=oneDay.filter(x=>x.shift===slot.shift&&Number(x.period)===slot.period);
  const mergedPrevious=oneDay.find(x=>x.kind==='EXTRA'&&x.shift===slot.shift&&Number(x.period)<slot.period&&Number(x.periodEnd||x.period)>=slot.period);
  if(!matches.length&&mergedPrevious)return '';
  const main=matches.some(e=>e.kind!=='EXTRA');const extra=matches.some(e=>e.kind==='EXTRA');
  const editor=page==='extra'?'extra':page==='calendar'?'official':main?'official':extra?'extra':'choose';
  const conflict=conflictKeys.has(`${date}|${slot.shift}|${slot.period}`);
  const firstSpan=matches.find(e=>e.kind==='EXTRA'&&Number(e.periodEnd||e.period)>slot.period);
  const label=firstSpan?(slot.shift==='T'?'Tối · Ca dạy':`${shiftLabel(slot.shift)} · Tiết ${slot.period}–${firstSpan.periodEnd}`):extra&&!main&&slot.shift==='T'?'Tối · Ca dạy':`${shiftLabel(slot.shift)} · ${slot.shift==='T'?'Ca dạy':'Tiết '+slot.period}`;
  return `<button class="day-event ${matches.length?'has-events':''} ${conflict?'day-conflict':''}" data-action="open-cell" data-date="${date}" data-shift="${slot.shift}" data-period="${slot.period}" data-editor="${editor}"><span class="day-time">${label}</span><span class="day-contents">${matches.length?matches.map(x=>{
   const names=x.kind==='EXTRA'?parseGroups(x.groups).map(className).join(' · '):className(x.classId);
   return `<span class="day-entry ${x.kind==='EXTRA'?'day-extra-entry':''}" style="${styleFor(x.kind==='EXTRA'?parseGroups(x.groups)[0]:x.classId)}"><b>${esc(names||'Dạy thêm')}</b><small>${esc(x.kind==='EXTRA'?`${x.subject}${x.startTime?' · '+x.startTime+(x.endTime?'–'+x.endTime:''):''}`:`${x.subject} ${x.stream||''} · PPCT ${x.ppct?.period||'—'}`)}</small>${x.kind==='EXTRA'&&(x.lessonTitle||x.notes)?`<small>${esc(x.lessonTitle||x.notes)}</small>`:x.kind!=='EXTRA'&&x.ppct?.title?`<small>${esc(x.ppct.title)}</small>`:''}</span>`;
  }).join(''):'<span class="day-empty">+ Chưa có lịch · Chạm để thêm</span>'}</span></button>`;
 }).filter(Boolean).join('');
 return `<div class="day-board"><div class="day-switch"><button data-action="prev-day" aria-label="Ngày trước">‹</button><strong>${dayLabel(day)} · ${fmt(date)}</strong><button data-action="next-day" aria-label="Ngày sau">›</button></div><div class="day-chips">${DAYS.map(d=>`<button type="button" data-action="select-day" data-day="${d.n}" class="${d.n===day?'selected':''}">${d.n===8?'CN':`T${d.n}`}<small>${fmt(addDays($state.week,d.n-2))}</small></button>`).join('')}</div><div class="day-events">${cards}</div></div>`;
}

/** Fixed full-week phone board: 8 columns x 13 rows, presentation only. */
function mobileWeekBoard(rawEvents,conflictKeys,page,allOfficial,allExtras){
 const dates=DAYS.map(d=>addDays($state.week,d.n-2));
 const cells=planMobileWeekCells(rawEvents,dates);
 const headers=DAYS.map((d,i)=>`<div class="mw-day" role="columnheader" style="grid-column:${i+2};grid-row:1">${d.n===8?'CN':`T${d.n}`}<small>${fmt(dates[i])}</small></div>`).join('');
 const labels=MOBILE_PERIODS.map((s,i)=>`<div class="mw-period ${i===5||i===10?'mw-shift-break':''}" role="rowheader" style="grid-column:1;grid-row:${i+2}">${s.label}</div>`).join('');
 const slots=cells.map(cell=>{
  const {date,shift,period,events:shown,span,col,row}=cell;
  const main=allOfficial.some(e=>e.date===date&&e.shift===shift&&Number(e.period)===period);
  const ex=allExtras.some(e=>e.date===date&&e.shift===shift&&Number(e.period)===period);
  const editor=page==='extra'?'extra':page==='calendar'?'official':main?'official':ex?'extra':'choose';
  const conflict=conflictKeys.has(`${date}|${shift}|${period}`)||shown.length>1;
  const aria=shown.length?shown.map(e=>e.kind==='EXTRA'?`Dạy thêm ${parseGroups(e.groups).map(className).join(', ')}`:`${e.subject} ${className(e.classId)} ${e.stream||''} tiết PPCT ${e.ppct?.period||''}`).join('; '):'Chưa có lịch';
  const body=shown.map(e=>{
   const names=e.kind==='EXTRA'?parseGroups(e.groups).map(className).join(' + '):className(e.classId);
   const detail=e.kind==='EXTRA'?'':`${e.subject==='Toán'?e.stream||'Toán':'TIN'}${e.ppct?.period?'·T'+e.ppct.period:''}`;
   return `<span class="mw-lesson ${e.kind==='EXTRA'?'mw-tutor':'mw-official'}" style="${styleFor(e.kind==='EXTRA'?(parseGroups(e.groups)[0]||'extra'):e.classId)}"><b>${esc(names||'Dạy thêm')}</b>${detail?`<small>${esc(detail)}</small>`:''}</span>`;
  }).join('');
  return `<button type="button" class="mw-slot ${shown.length?'mw-filled':''} ${conflict?'mw-conflict':''} ${span===2?'mw-spanned':''} ${row===7||row===12?'mw-shift-break':''}" style="grid-column:${col};grid-row:${row} / span ${span}" role="gridcell" data-action="open-cell" data-editor="${editor}" data-date="${date}" data-shift="${shift}" data-period="${period}" aria-label="${esc(date+' '+shift+period+': '+aria)}" title="${esc(aria)}">${body}</button>`;
 }).join('');
 return `<div class="mobile-week-board" role="grid" aria-label="Thời khóa biểu đủ bảy ngày, năm tiết sáng, năm tiết chiều và hai ca tối"><div class="mw-corner" style="grid-column:1;grid-row:1">Ca</div>${headers}${labels}${slots}</div>`;
}

function calendarPage(events,error){
 const page=$state.view,extraMode=page==='extra',overview=page==='overview';
 const heading=extraMode?'Lịch dạy thêm':overview?'Thời khóa biểu Thầy Đức · 7 ngày':'Thời khóa biểu chính khóa';
 const version=activeVersion($state.data,$state.week);
 const filtered=events.filter(e=>{
  const matchesClass=$state.filterClass==='all'||($state.filterClass===e.classId)||(e.kind==='EXTRA'&&parseGroups(e.groups).includes($state.filterClass));
  return matchesClass&&($state.filterShift==='all'||$state.filterShift===e.shift)&&($state.filterSubject==='all'||$state.filterSubject===e.subject)&&($state.filterStream==='all'||e.subject==='Tin'||e.kind==='EXTRA'||e.stream===$state.filterStream);
 });
 const displayEvents=collapseTutorDisplay(filtered);
 const activeShifts=SHIFTS.filter(s=>$state.filterShift==='all'||s.id===$state.filterShift);
 const allOfficial=eventsForWeek($state.data,$state.week).filter(e=>e.kind!=='EXTRA');
 const allExtras=tutoringForWeek($state.data,$state.week);
 const conflictKeys=new Set(error.map(c=>c.key));
 const occupied=events.filter(e=>e.status!=='OFF'&&(!extraMode||e.kind==='EXTRA')).length;
 const completed=events.filter(e=>e.status==='DONE'&&(!extraMode||e.kind==='EXTRA')).length;
 const renderCell=(day,s,p)=>{
  const date=addDays($state.week,day-2);
  const shown=displayEvents.filter(e=>e.date===date&&e.shift===s&&Number(e.period)===p&&(!extraMode||!$state.onlyExtra||e.kind==='EXTRA'));
  const previousMerged=displayEvents.find(e=>e.kind==='EXTRA'&&e.date===date&&e.shift===s&&Number(e.period)===p-1&&Number(e.periodEnd||e.period)===p);
  const previousHasOther=previousMerged&&displayEvents.some(e=>e.date===date&&e.shift===s&&Number(e.period)===p-1&&e!==previousMerged);
  if(previousMerged&&!previousHasOther&&!shown.length)return '';
  const merge=shown.length===1&&shown[0].kind==='EXTRA'&&Number(shown[0].periodEnd||p)===p+1&&!displayEvents.some(e=>e.date===date&&e.shift===s&&Number(e.period)===p+1);
  const main=allOfficial.some(e=>e.date===date&&e.shift===s&&Number(e.period)===p);
  const ex=allExtras.some(e=>e.date===date&&e.shift===s&&Number(e.period)===p);
  const editor=extraMode?'extra':overview?(main?'official':ex?'extra':'choose'):'official';
  const conflict=conflictKeys.has(`${date}|${s}|${p}`);
  const hint=shown.map(e=>e.kind==='EXTRA'?`${e.subject}: ${parseGroups(e.groups).map(className).join(' + ')}`:`${e.subject} ${className(e.classId)} (${e.stream||''})`).join(' | ')||'Nhấn để thêm hoặc điều chỉnh';
  return `<td ${merge?'rowspan="2" class="extra-merged-cell"':''}><button class="cell ${shown.length?'filled':''} ${conflict?'conflict':''}" data-action="open-cell" data-editor="${editor}" data-date="${date}" data-shift="${s}" data-period="${p}" title="${esc(hint)}">
    ${shown.map(e=>{const groupNames=parseGroups(e.groups);const short=e.kind==='EXTRA'?groupNames.map(className).join(' · '):className(e.classId);const colors=styleFor(e.kind==='EXTRA'?(groupNames[0]||'extra'):e.classId);
     return `<span class="lesson ${e.kind==='EXTRA'?'tutor':e.subject==='Toán'?'math':'ict'} ${e.status==='OFF'?'off':''} ${extraMode&&e.kind!=='EXTRA'?'official-muted':''}" style="${colors}">
     <span class="lesson-name lesson-full">${esc(e.subject)} · ${esc(e.kind==='EXTRA'?groupNames.map(className).join(' + '):className(e.classId))}</span>
     <span class="lesson-name lesson-short">${esc(short)}</span>
     <span class="lesson-sub lesson-sub-full">${e.kind==='EXTRA'?`<b>${esc(e.subject)}</b>${e.startTime?' · '+esc(e.startTime):''}`:`<b>${esc(e.stream||'')}</b> · ${e.status==='OFF'?'NGHỈ · ':''}${e.ppct?`PPCT ${esc(e.ppct.period)}`:'Chưa gán PPCT'}`}</span><span class="lesson-sub lesson-sub-mobile">${e.kind==='EXTRA'?`${esc(e.subject)}`:`${esc(e.stream||'')} · ${e.ppct?`T${esc(e.ppct.period)}`:'—'}`}</span>
     ${e.kind==='EXTRA'&&(e.lessonTitle||e.notes)?`<span class="lesson-title">${esc(e.lessonTitle||e.notes)}</span>`:e.ppct?.title?`<span class="lesson-title">${esc(e.ppct.title)}</span>`:''}</span>`;
    }).join('')||'<span class="addmark">+</span>'}
    ${conflict?'<span class="alert-dot" title="Cần kiểm tra lịch trùng">!</span>':''}</button></td>`;
 };
 return `<div class="pagehead"><div><div class="eyebrow">SMART TKB V1.8.0 · LÊ HOÀNG NGỌC ĐỨC</div><h2>${heading}</h2><p>${extraMode?'Dạy thêm (ngoài PPCT) hoàn toàn độc lập với chính khóa và Tăng vượt. Mỗi suất có thể chọn nhiều lớp hoặc nhóm tự đặt tên.':overview?'Xem cả chính khóa và dạy thêm nhưng lưu dữ liệu hoàn toàn riêng biệt.':'Chính khóa theo phiên bản TKB; nghỉ/dạy bù theo PPCT từng lớp.'}</p></div><div class="actions"><button class="btn soft" data-action="print">⎙ In</button><button class="btn primary" data-action="export">↓ Xuất CSV</button></div></div>

 <!-- V1.8: summary counters are exclusively on the Statistics page. -->
 <section class="panel"><div class="weekbar"><button class="menu-toggle" data-action="toggle-drawer" aria-label="Mở danh mục và bộ lọc">☰<small>Bộ lọc</small></button><div class="weekchange"><button class="arrow" data-action="prev-week">‹</button><div><strong>Tuần ${schoolWeek($state.week)} · ${fmt($state.week)} – ${fmt(weekEnd())}</strong><span>Đầy đủ 7 ngày · Sáng 1–5 · Chiều 1–5 · Tối 1–2</span><em class="teacher-byline">GV: Lê Hoàng Ngọc Đức</em></div><button class="arrow" data-action="next-week">›</button></div><div class="weektools"><button class="btn soft" data-action="today">Tuần hiện tại</button><button class="btn fit-toggle" data-action="fit-week">${$state.fitWeek?'▣ Mở giao diện đầy đủ':'▣ Xem vừa màn hình'}</button><button class="btn soft" data-action="fullscreen-week">⛶ Toàn màn hình</button></div></div>
 <div class="view-layout-toolbar"><div class="layout-choice" role="group" aria-label="Cách xem lịch"><button type="button" data-action="layout-week" class="layout-button ${$state.calendarLayout==='week'?'on':''}">▦ Toàn tuần</button><button type="button" data-action="layout-day" class="layout-button ${$state.calendarLayout==='day'?'on':''}">☷ Theo ngày</button></div><span class="layout-info">Chạm ô để xem chi tiết · ${$state.mode==='google'?'Đã kết nối Sheets':'Bản lưu đã xác thực · chỉ xem'}</span><span class="release-label" title="Phiên bản đang chạy trên trình duyệt và Vercel API">Web ${FRONTEND_VERSION} · API ${esc($state.apiVersion||'?')}</span></div><div class="week-view-tabs"><button data-view="calendar" class="week-tab ${page==='calendar'?'active':''}">Chính khóa</button><button data-view="extra" class="week-tab ${page==='extra'?'active':''}">Dạy thêm</button><button data-view="overview" class="week-tab ${page==='overview'?'active':''}">Tổng hợp</button></div>
 
 ${page==='calendar'?'<button class="btn soft compact-full-toggle" data-view="overview">▣ Xem TKB đầy đủ (cả dạy thêm)</button>':page==='extra'?`<div class="extra-hint">Dạy thêm lưu riêng · <button type="button" class="btn soft" data-action="open-extra-list">☷ Danh sách đã lưu</button></div>${$state.mode==='google'&&$state.extraServerReady===false?`<div class="extra-server-alert"><strong>Chưa thể lưu dạy thêm:</strong> ${esc($state.extraServerError)} <button class="btn soft" data-action="probe-extra">Kiểm tra lại</button></div>`:''}`:''}
 ${$state.clipboardMain&&page!=='extra'?`<div class="main-clipboard"><strong>📋 Đã sao chép: ${esc($state.clipboardMain.subject)} ${esc(className($state.clipboardMain.classId))}</strong><span>Chạm ô đích, chọn “Dán tiết đã sao chép”.</span><button class="btn soft" data-action="cancel-copy-main">Hủy sao chép</button></div>`:''}
 ${error.length?`<details class="warning compact-warning"><summary>⚠ Có ${error.length} vị trí trùng lịch (chọn đúng tiết để sửa, xóa hoặc sao chép)</summary>
 ${error.map(c=>{const e=c.items[0];return `<div class="conflict-resolve"><strong>${fmt(e.date)} ${shiftLabel(e.shift)} tiết ${e.period}</strong><div class="conflict-options">${c.items.map(x=>`<div>${esc(x.kind==='EXTRA'?'Dạy thêm '+parseGroups(x.groups).join(', '):x.subject+' '+className(x.classId)+' '+(x.stream||''))} ${x.kind==='MAIN'?`<button class="btn soft" data-action="start-move" data-id="${esc(x.id)}" data-date="${esc(x.date)}">Sửa</button> <button class="btn danger" data-action="start-delete-main" data-id="${esc(x.id)}" data-date="${esc(x.date)}">Xóa</button> <button class="btn soft" data-action="copy-main" data-id="${esc(x.id)}" data-date="${esc(x.date)}">Sao chép</button>`:'<span class="caption">Sửa trong Dạy thêm</span>'}</div>`).join('')}</div></div>`}).join('')}</details>`:''}
 ${mobileWeekBoard(filtered,conflictKeys,page,allOfficial,allExtras)}
 ${$state.calendarLayout==='day'?dayBoard(displayEvents,conflictKeys,page):`<div class="table-scroller week-scroller"><table class="timetable"><thead><tr><th class="sidecol">Ca</th>${DAYS.map(d=>`<th><span class="day-long">${d.label}</span><span class="day-short">${d.n===8?'CN':`T${d.n}`}</span><small>${fmt(addDays($state.week,d.n-2))}</small></th>`).join('')}</tr></thead><tbody>
 ${activeShifts.map(sh=>Array.from({length:sh.count},(_,i)=>`<tr><th class="period-label"><span>${sh.label}</span><strong>${sh.id==='T'?'Suất':'Tiết'} ${i+1}</strong></th>${DAYS.map(d=>renderCell(d.n,sh.id,i+1)).join('')}</tr>`).join('')).join('')}
 </tbody></table></div>`}<div class="legend"><span>Mỗi lớp một màu · Chọn ô để xem chi tiết</span><span><i class="dot red"></i> Trùng thời điểm</span><span>↻ Dạy thêm lặp hàng tuần</span></div></section>`;
}
function fmt(date){const [y,m,d]=date.split('-');return `${d}/${m}`;}
function extraListPage(){
 const month=$state.week.slice(0,7),startMonth=month+'-01';
 const [yy,mm]=month.split('-').map(Number),endMonth=new Date(Date.UTC(yy,mm,0)).toISOString().slice(0,10);
 const start=$state.extraPeriod==='month'?startMonth:$state.week;
 const end=$state.extraPeriod==='month'?endMonth:addDays($state.week,6);
 const all=tutoringForRange($state.data,start,end);
 const monthly=tutoringForRange($state.data,startMonth,endMonth);
 const predicate=x=>{
  const groups=parseGroups(x.groups).map(className);
  const grade=$state.extraGrade,letter=$state.extraLetter;
  if(grade!=='all'&&!groups.some(g=>new RegExp('^'+grade+'(?:[ABC]|[/])','i').test(g)))return false;
  if(letter!=='all'&&!groups.some(g=>new RegExp('^(?:6|7|8|9|10|11|12)'+letter+'$','i').test(g)))return false;
  if($state.extraDay!=='all'&&String(dayNumber(x.date))!==$state.extraDay)return false;
  if($state.extraShift!=='all'&&x.shift!==$state.extraShift)return false;
  const q=String($state.extraListQuery||'').toLocaleLowerCase('vi');
  return !q||[x.subject,x.lessonTitle,x.notes,x.date,shiftLabel(x.shift),...groups].join(' ').toLocaleLowerCase('vi').includes(q);
 };
 const filtered=all.filter(predicate),monthCount=monthly.length,monthDone=monthly.filter(x=>x.status==='DONE').length;
 const filteredCount=filtered.length;
 const cards=filtered.map(x=>{
  const groupNames=parseGroups(x.groups).map(className);
  const classLabel=groupNames.join(' · '),grade=Number(groupNames[0]?.match(/^\d{1,2}/)?.[0])||0;
  const accent=['#2563eb','#12866a','#c58019','#7c3db4','#0d8299','#bb4c76','#4a6dc2'][Math.max(0,grade-6)%7];
  const code=esc(x.id),date=esc(x.date),status=x.status||'PLANNED';
  const labels={DONE:'Đã dạy',PLANNED:'Chưa dạy',OFF:'Nghỉ',MAKEUP:'Bù'};
  return `<article class="extra-lesson-card" style="--card-accent:${accent}">
    <div class="extra-card-head"><strong class="extra-class-label">${esc(classLabel)}</strong><span class="extra-status ${esc(status.toLowerCase())}">${labels[status]||esc(status)}</span></div>
    <div class="extra-card-detail"><span>📅 ${esc(dayLabel(dayNumber(x.date)))}, ${fmt(x.date)}</span><span>🕒 ${esc(shiftLabel(x.shift))} · ${x.shift==='T'?'Ca':'Tiết'} ${esc(x.period)}${x.startTime?' · '+esc(x.startTime)+(x.endTime?'–'+esc(x.endTime):''):''}</span></div>
    <div class="extra-card-title">${esc(x.lessonTitle||x.notes||'Chưa nhập nội dung bài học')}</div>
    <div class="extra-card-meta">${esc(x.subject)} · Buổi ${esc(x.lessonNumber||1)} ${x.recurring?' · ↻ Lặp hàng tuần':''} · Ngoài PPCT</div>
    <div class="extra-card-status-actions">${[['DONE','Đã dạy'],['PLANNED','Chưa dạy'],['OFF','Nghỉ'],['MAKEUP','Bù']].map(([id,label])=>`<button type="button" class="extra-status-choice ${status===id?'active':''}" data-action="quick-extra-status" data-id="${code}" data-date="${date}" data-status="${id}" ${$state.mode!=='google'?'disabled':''}>${label}</button>`).join('')}</div>
    <div class="extra-card-actions"><button class="btn soft" data-action="open-saved-extra" data-date="${date}" data-shift="${esc(x.shift)}" data-period="${esc(x.period)}">✎ Sửa</button><button class="btn soft" data-action="clone-extra-next" data-date="${date}" data-id="${code}">⧉ Tuần sau</button><button class="btn danger" data-action="remove-extra-card" data-date="${date}" data-id="${code}">Xóa</button></div>
   </article>`;
 }).join('');
 return `<div class="pagehead"><div><div class="eyebrow">SMART TKB · DẠY THÊM NGOÀI PPCT</div><h2>Danh sách ca dạy thêm</h2><p>21 lớp mặc định 6A–12C · hiển thị lịch lặp theo ngày thực tế · không tác động PPCT chính khóa.</p></div><div class="actions"><button class="btn soft" data-view="extra">▦ Lịch tuần</button><button class="btn primary" data-action="refresh-extra-list">↻ Đồng bộ Google Sheets</button></div></div>
 <section class="panel extras-list"><div class="extra-dashboard"><div><small>Ca dạy trong tháng ${esc(month)}</small><strong>${monthCount}</strong></div><div><small>Đã hoàn thành trong tháng</small><strong>${monthDone}</strong></div><div><small>Ca theo bộ lọc</small><strong>${filteredCount}</strong></div></div>
 <div class="extra-filter-bar" aria-label="Lọc theo khối">${[['all','Tất cả'],...[6,7,8,9,10,11,12].map(g=>[String(g),'Khối '+g])].map(([id,label])=>`<button class="btn ${$state.extraGrade===id?'primary':'soft'}" data-extra-grade="${id}">${label}</button>`).join('')}</div>
 <div class="extra-filter-bar" aria-label="Lọc theo lớp">${['all','A','B','C'].map(id=>`<button class="btn ${$state.extraLetter===id?'primary':'soft'}" data-extra-letter="${id}">${id==='all'?'Tất cả lớp':'Lớp '+id}</button>`).join('')}</div>
 <div class="extra-list-toolbar"><label>Thời gian<select id="extra-period">${options([['week','Theo tuần '+schoolWeek($state.week)],['month','Theo tháng '+month]],$state.extraPeriod)}</select></label><label>Ngày<select id="extra-day">${options([['all','Cả tuần'],...DAYS.map(d=>[String(d.n),d.label])],$state.extraDay)}</select></label><label>Buổi<select id="extra-shift">${options([['all','Cả ngày'],['S','Sáng'],['C','Chiều'],['T','Tối']],$state.extraShift)}</select></label><label>Tìm kiếm<input id="extra-list-search" value="${esc($state.extraListQuery)}" placeholder="Tên lớp, nội dung"></label></div>
 <div class="extra-lesson-grid">${cards||'<div class="extra-empty">Chưa có ca dạy nào phù hợp. Thử bỏ bộ lọc hoặc mở TKB để thêm ca mới.</div>'}</div>
 <p class="caption">Ca dạy thêm được lưu trong extra_patterns/extra_sessions; báo cáo PPCT chỉ tính chính khóa và Tăng vượt.</p></section>`;
}

function progressPage(){const d=$state.data;const list=(d.ppct||[]).filter(e=>String(e.grade)===$state.ppctGrade&&e.subject===$state.ppctSubject&&($state.ppctStream==='all'||e.stream===$state.ppctStream)&&e.title.toLowerCase().includes($state.ppctQuery.toLowerCase())).sort((a,b)=>a.week-b.week||a.period-b.period);
 const bs=(d.baselines||[]).filter(b=>{const c=classById(d,b.classId);return String(c?.grade)===$state.ppctGrade&&b.subject===$state.ppctSubject;});
 return `<div class="pagehead"><div><div class="eyebrow">PHÂN PHỐI CHƯƠNG TRÌNH</div><h2>PPCT & tiến độ lớp học</h2><p>Toán chia thành Đại số và Hình học; Tin học dùng chuỗi bài riêng. Dữ liệu trích từ 4 file gốc.</p></div></div>
 <section class="panel baseline-panel"><div class="panelheading"><h3>Điểm bắt đầu PPCT – áp dụng từ tuần chọn</h3><p>Chọn tuần bắt đầu rồi chọn tiết PPCT theo danh mục và tiến độ. Tên bài chỉ để xem, không được chỉnh trong mục này. Chỉ nhấn Lưu mới ghi mốc mới; các tuần trước giữ nguyên.</p></div><div class="baseline-grid">${bs.map(b=>{
  const c=classById(d,b.classId);if(!c)return '';
  const seq=ppctSequence(d,c.grade,b.subject,b.stream,b.classId);
  const active=effectiveBaseline(d,b.classId,b.subject,b.stream,$state.week);
  const revision=(d.baseline_revisions||[]).find(x=>x.baselineId===b.id&&x.fromDate===$state.week);
  const planned=eventsForWeek(d,$state.week).find(e=>e.kind!=='EXTRA'&&e.classId===b.classId&&e.subject===b.subject&&e.stream===b.stream&&e.ppct);
  const plannedIndex=planned?seq.findIndex(x=>x.id===planned.ppct.id):-1;
  const currentIndex=revision?Number(revision.nextIndex):plannedIndex>=0?plannedIndex:Number(active?.nextIndex??b.nextIndex);
  const index=Math.max(0,Math.min(seq.length-1,currentIndex));const chosen=seq[index];
  const fromWeek=$state.week;
  const afterDate=addDays(fromWeek,-1),prior=progressAt(d,b.classId,b.subject,b.stream,afterDate);
  const prevLesson=fromWeek<=b.fromDate?seq[Math.max(0,Number(b.nextIndex)||0)]:prior.next;
  return `<div class="baseline-item" data-baseline-id="${esc(b.id)}"><div class="base-header"><strong>${esc(c.name)} · ${esc(b.subject)} ${esc(b.stream)}</strong><span class="state ${revision?'ok':'pending'}">${revision?'Đã lưu mốc tuần này':'Chưa đổi mốc tuần này'}</span></div>
   <label for="base-week-${esc(b.id)}">Áp dụng từ tuần (Thứ Hai)</label>
   <input id="base-week-${esc(b.id)}" class="baseline-week" type="date" min="${esc(monday(b.fromDate))}" value="${esc(fromWeek)}" />
   <small class="baseline-help">Các tuần trước ${esc(fmt(fromWeek))} không bị thay đổi.</small>
   <label for="base-${esc(b.id)}">Chọn tiết trong danh mục PPCT</label>
   <select id="base-${esc(b.id)}" aria-label="Chọn bài PPCT cho ${esc(c.name)}" ${!seq.length?'disabled':''}>${seq.map((lesson,i)=>`<option value="${i}" ${i===index?'selected':''}>Tiết ${esc(lesson.period)} · ${esc(lesson.title)}</option>`).join('')}</select>
   <div class="baseline-readonly" role="status"><small>Nội dung bài từ PPCT & tiến độ (chỉ xem)</small><strong id="base-preview-${esc(b.id)}">${esc(chosen?`Tiết ${chosen.period} – ${chosen.title}`:'Chưa có dữ liệu PPCT')}</strong></div>
   <small class="baseline-forecast" id="base-forecast-${esc(b.id)}">Tiếp theo: ${esc(seq.slice(index+1,index+3).map(x=>`T${x.period}: ${x.title}`).join(' → ')||'Đã hết chuỗi PPCT')}</small>
   <small class="baseline-progress-ref" id="base-progress-ref-${esc(b.id)}">Theo tiến độ trước tuần này: ${esc(prevLesson?`T${prevLesson.period}: ${prevLesson.title}`:'Chưa có bài kế tiếp')}</small>
   <div class="baseline-actions"><button class="btn primary small" data-action="save-baseline" data-id="${esc(b.id)}" ${!seq.length||$state.baselineSavingId===b.id?'disabled':''}>${$state.baselineSavingId===b.id?'Đang lưu...':'Lưu áp dụng từ tuần này'}</button><small>Chọn tiết chỉ xem trước; không lưu và không sửa tên bài tự động.</small></div></div>`;
 }).join('')}</div></section>
 <section class="panel"><div class="panelheading"><h3>Danh mục PPCT đã nhập</h3><p>Có thể tìm theo tên bài hoặc lọc theo mạch ĐS / HH.</p></div><div class="filters ppct-filters"><div><label>Khối</label><select id="ppct-grade">${options([['7','Khối 7'],['9','Khối 9']],$state.ppctGrade)}</select></div><div><label>Môn</label><select id="ppct-subject">${options([['Toán','Toán'],['Tin','Tin']],$state.ppctSubject)}</select></div><div><label>Mạch</label><select id="ppct-stream">${options([['all','Tất cả'],['ĐS','Đại số'],['HH','Hình học'],['TIN','Tin học']],$state.ppctStream)}</select></div><div class="searchfield"><label>Tìm bài học</label><input id="ppct-query" placeholder="Ví dụ: căn bậc hai" value="${esc($state.ppctQuery)}"/></div></div>
 <div class="table-scroller"><table class="data-table"><thead><tr><th>Tuần</th><th>Mạch</th><th>Tiết PPCT</th><th>Tên bài học / chủ đề</th></tr></thead><tbody>${list.slice(0,350).map(e=>`<tr><td>${esc(e.week)}</td><td><span class="tag">${esc(e.stream)}</span></td><td>${esc(e.period)}</td><td>${esc(e.title)}</td></tr>`).join('')}</tbody></table></div><p class="caption">Hiển thị ${list.length} mục. Thầy cần kiểm tra kết quả đọc PDF/Word, đặc biệt các mốc kiểm tra và PPCT Tin 9 không tuần tự.</p></section>`;
}
function vietnamToday(){
 const date=new Date();const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const o=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${o.year}-${o.month}-${o.day}`;
}
function statsEndDate(){return {today:vietnamToday(),week:weekEnd(),hk1:'2027-01-09',hk2:'2027-05-22',custom:$state.statsDate||vietnamToday()}[$state.statsPeriod]||vietnamToday();}
function filteredStatistics(date){return progressSummary($state.data,date).filter(x=>($state.statsClass==='all'||x.classId===$state.statsClass)&&($state.statsSubject==='all'||x.subject===$state.statsSubject)&&($state.statsStream==='all'||x.stream===$state.statsStream));}
function statisticsPage(){
 const date=statsEndDate(),all=progressSummary($state.data,date),cls=$state.data.classes||[];
 const filtered=filteredStatistics(date);
 const ready=filtered.filter(x=>x.status==='ready'),partial=filtered.filter(x=>x.status==='partial'),unconfirmed=filtered.filter(x=>x.status==='unconfirmed');
 const deltaCell=x=>`<span class="pace ${x.delta<0?'behind':x.delta>0?'ahead':'ontime'}">${x.delta>0?'+':''}${x.delta<0?x.delta:x.delta} tiết ${x.delta>0?'(nhanh)':x.delta<0?'(chậm)':'— Đúng tiến độ (0 tiết)'}</span>${x.provisional?'<small class="planned-note">Tạm tính · cần xác nhận mốc/tiết đã dạy</small>':''}`;
 const rows=filtered.map(x=>`<tr><td><b>${esc(className(x.classId))}</b> <small>${esc(x.classId)}</small></td>
  <td>${esc(x.subject)} ${esc(x.stream==='TIN'?'':x.stream)}</td>
  <td>${x.planningPrecision==='estimated-date'?'≈ ':''}<span class="planned-number">${x.planned??0}</span>${x.planningPrecision==='unallocated'?'<small class="planned-note">Chưa có TKB phân bổ ngày</small>':''}</td>
  <td>${x.actual??0}${x.status==='partial'?'<small>Chưa tính các tiết chưa xác nhận</small>':''}${x.status!=='unconfirmed'?`<div class="progress-meter"><i style="width:${Math.min(100,Math.max(0,(x.actual/Math.max(1,x.planned))*100))}%"></i></div>`:''}</td>
  <td>${deltaCell(x)}</td><td>${x.next?`T${esc(x.next.period)} · ${esc(x.next.title)}`:'—'}${x.unlinked?`<span class="pending-stat"> · ${x.unlinked} tiết đã dạy chưa liên kết PPCT</span>`:''}${x.off?`<small>${x.off} tiết nghỉ đã ghi nhận</small>`:''}</td></tr>`).join('');
 const compactRows=filtered.map(x=>`<tr>
  <td><strong>${esc(className(x.classId))}</strong><small>${esc(x.subject)}${x.stream==='TIN'?'':' · '+esc(x.stream)}</small></td>
  <td><strong>${x.planningPrecision==='estimated-date'?'≈ ':''}${x.planned??0}</strong>${x.planningPrecision==='unallocated'?'<small title="Chưa có TKB phân bổ ngày">Chưa phân bổ ngày</small>':''}</td>
  <td><strong>${x.actual??0}</strong>${x.status==='partial'?'<small>Chưa đủ xác nhận</small>':''}</td>
  <td><span class="mobile-pace ${x.delta<0?'behind':x.delta>0?'ahead':'ontime'}">${x.delta>0?'+':''}${x.delta??0}</span><small>${x.delta>0?'Nhanh':x.delta<0?'Chậm':'Đúng'}</small>${x.provisional?'<small>Tạm tính</small>':''}</td>
  <td>${x.next?`<strong>Tiết ${esc(x.next.period)}</strong><small>${esc(x.next.title)}</small>`:'<span>—</span>'}${x.unlinked?`<small>${x.unlinked} tiết chưa liên kết</small>`:''}</td>
 </tr>`).join('');
 const total=filtered.reduce((sum,x)=>sum+(Number(x.actual)||0)-(Number(x.planned)||0),0);
 const allReady=ready.length===filtered.length&&filtered.length>0;
 const mathPairs=cls.filter(c=>c.subjects.includes('Toán')).filter(c=>$state.statsClass==='all'||$state.statsClass===c.id).filter(()=>$state.statsSubject==='all'||$state.statsSubject==='Toán').map(c=>{
   const parts=['ĐS','HH'].map(stream=>all.find(x=>x.classId===c.id&&x.subject==='Toán'&&x.stream===stream));
   const valid=parts.every(x=>x?.status==='ready');const value=parts.every(Boolean)?parts[0].delta+parts[1].delta:null;
   return `<div class="sum-card"><strong>${esc(c.name)} · Toán tổng hợp</strong><span>${value===null?'Chưa có dữ liệu PPCT':`${value>0?'+':''}${value} tiết${!valid?' · tạm tính':''}`}</span><small>ĐS: ${parts[0]?.status==='ready'?parts[0].delta:'—'} · HH: ${parts[1]?.status==='ready'?parts[1].delta:'—'}</small></div>`;
 }).join('');
 return `<div class="pagehead"><div><div class="eyebrow">SMART TKB V1.8.0 · LÊ HOÀNG NGỌC ĐỨC</div><h2>Thống kê tiến độ theo PPCT</h2><p>Đếm riêng theo lớp và mạch; chưa xác nhận thì không tự kết luận nhanh/chậm.</p></div><div class="actions"><button class="btn primary" data-action="export-statistics">↓ Xuất thống kê CSV</button><button class="btn soft" data-action="print">⎙ In báo cáo</button></div></div>
 <section class="panel"><div class="stats-toolbar"><div><label>Mốc thống kê</label><select id="stats-period">${options([['today','Đến hôm nay'],['week','Đến hết tuần đang xem'],['hk1','Đến hết học kỳ I'],['hk2','Đến hết năm học'],['custom','Chọn ngày cụ thể']],$state.statsPeriod)}</select></div><div><label>Ngày</label><input id="stats-date" type="date" value="${esc(date)}" ${$state.statsPeriod==='custom'?'':'disabled'}></div><div><label>Lớp</label><select id="stats-class">${options([['all','Tất cả lớp'],...cls.map(c=>[c.id,`${c.name} (${c.id})`])],$state.statsClass)}</select></div><div><label>Môn</label><select id="stats-subject">${options([['all','Toán và Tin'],['Toán','Toán'],['Tin','Tin']],$state.statsSubject)}</select></div><div><label>Mạch</label><select id="stats-stream">${options([['all','Tất cả mạch'],['ĐS','Đại số'],['HH','Hình học'],['TIN','Tin học']],$state.statsStream)}</select></div></div>
 <div class="statistics-summary"><div><small>Đã đủ xác nhận</small><strong>${ready.length}/${filtered.length}</strong></div><div><small>Còn tiết chưa xác nhận</small><strong>${partial.length}</strong></div><div><small>Chưa xác nhận mốc</small><strong>${unconfirmed.length}</strong></div><div><small class="desktop-summary-label">Chênh lệch đã ghi nhận · tạm tính nếu thiếu xác nhận</small><small class="mobile-summary-label">Chênh lệch</small><strong>${(total>0?'+':'')+total+' tiết'}</strong></div></div>
 ${unconfirmed.length?`<div class="stats-warning">⚠ Có ${unconfirmed.length} mạch/lớp chưa xác nhận mốc PPCT. Vào “PPCT & tiến độ” để xác nhận số tiết đã dạy trước ngày bắt đầu theo dõi.</div>`:''}
 ${partial.length?`<div class="stats-warning">⚠ Có ${partial.length} mạch/lớp có tiết dự kiến chưa được xác nhận đã dạy hoặc nghỉ. Mở TKB, chạm vào từng tiết và chọn “Đã dạy”/“Nghỉ”; tạm thời không kết luận nhanh hay chậm đối với các mạch này.</div>`:''}
 <div class="mobile-stats-scroller"><table class="mobile-stats-table"><colgroup><col style="width:23%"><col style="width:13%"><col style="width:13%"><col style="width:19%"><col style="width:32%"></colgroup><thead><tr><th>Lớp / Môn</th><th>Kế hoạch</th><th>Đã dạy</th><th>Nhanh / Chậm</th><th>Tiết tiếp theo</th></tr></thead><tbody>${compactRows}</tbody></table></div>
 <div class="table-scroller desktop-stats-scroller"><table class="data-table stats-table"><thead><tr><th>Lớp</th><th>Môn/mạch</th><th>Kế hoạch tới mốc</th><th>Đã dạy xác nhận</th><th>Nhanh/chậm</th><th>Tiết tiếp theo</th></tr></thead><tbody>${rows}</tbody></table></div>
 <p class="caption">Kế hoạch lấy từ PPCT theo từng tuần; nếu chọn giữa tuần, phân bổ theo tiết trong TKB. Kỳ nghỉ không làm số tiết kế hoạch về 0. Thực tế = phần trước mốc đã xác nhận + các mã PPCT đã xác nhận dạy sau mốc (không tính lặp). Bản ghi chưa đánh dấu không tự xem là “đã dạy” hay “nghỉ”. Khi số tiết TKB trong tuần khác định mức PPCT, kết quả kế hoạch giữa tuần là ước tính và không đưa ra chênh lệch chính thức.</p></section>
 <section class="panel"><div class="panelheading"><h3>Tổng hợp Toán theo từng lớp</h3><p>Đại số và Hình học được tính độc lập; chỉ cộng chênh lệch khi cả hai mạch đủ xác nhận.</p></div><div class="math-summary">${mathPairs}</div></section>`;
}
function exportStatistics(){
 const d=statsEndDate(),list=filteredStatistics(d);
 const cells=[['Ngày thống kê','Lớp','Mã lớp','Môn','Mạch','Kế hoạch','Đã dạy xác nhận','Chênh lệch chính thức','Trạng thái','Số tiết chưa xác nhận','Tiết đã dạy chưa liên kết','Độ chính xác kế hoạch','Tiết tiếp theo'],
 ...list.map(x=>[d,className(x.classId),x.classId,x.subject,x.stream,x.planned,x.actual??'',x.status==='ready'?x.delta:'',x.status,x.pending??'',x.unlinked??'',x.planningPrecision,x.next?.period??''])];
 const csv=cells.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');saveFile(`SmartTKB_TienDo_${d}.csv`,'\ufeff'+csv,'text/csv;charset=utf-8');
}
function versionsPage(){const d=$state.data;const versions=[...d.versions].sort(compareVersions);const p=$state.pendingImport;
 return `<div class="pagehead"><div><div class="eyebrow">PHIÊN BẢN THỜI KHÓA BIỂU</div><h2>Nhập 3 file Excel · khởi tạo TKB sạch</h2><p>Tải đồng thời khối 7, khối 9 và Tin học. Chương trình nhận diện nội dung, tự lấy ngày hiệu lực. <strong>PPCT, mốc và lịch sử đã dạy không bị xóa.</strong></p></div></div>
 <section class="panel"><div class="panelheading"><h3>1. Lịch đã lưu</h3></div><div class="version-list">${versions.map(v=>`<div class="version-line"><span class="version-icon">▤</span><div><strong>${esc(v.name)}</strong><small>Từ ${esc(v.fromDate)} đến ${esc(v.toDate||'khi có lịch thay thế')} · ${(d.slots||[]).filter(s=>s.versionId===v.id).length} tiết/tuần</small></div><span class="tag">Đã lưu</span></div>`).join('')}</div></section>
 <section class="panel math-rules"><div class="panelheading"><h3>Phân bổ Toán ĐS / HH theo từng lớp</h3><p>Chọn mẫu áp dụng từ đầu tuần đang xem; không xóa bài PPCT hay xác nhận đã dạy.</p></div><div class="math-rule-grid">${($state.data.classes||[]).filter(c=>c.subjects.includes('Toán')).map(c=>{const selected=[...($state.data.ppct_overrides||[])].filter(r=>r.classId===c.id&&r.fromDate<=$state.week&&(!r.toDate||r.toDate>=$state.week)).sort((a,b)=>b.fromDate.localeCompare(a.fromDate))[0];const mode=selected?.pattern?.join(',')||'';return `<div class="math-rule-card"><strong>Toán ${esc(c.name)}</strong><select id="math-rule-${esc(c.id)}">${options([['','Theo PPCT hiện có'],['ĐS,HH,ĐS,HH','2 Đại số – 2 Hình học'],['ĐS,ĐS,HH,ĐS','3 Đại số – 1 Hình học']],mode)}</select><button class="btn soft" data-action="save-math-rule" data-class="${esc(c.id)}">Lưu cách phân môn</button></div>`;}).join('')}</div></section>
 <section class="panel"><div class="panelheading"><h3>2. Tạo phiên bản mới</h3><p>Chọn ngày áp dụng, tải Excel khối 7, khối 9 hoặc Tin học. Có thể nhập nhiều file, giữ lịch môn/khối chưa thay đổi.</p></div><div class="import-grid"><div><label>Tên phiên bản</label><input id="new-version-name" value="${esc(p?.name||'TKB lần 5')}" /></div><div><label>Bắt đầu áp dụng</label><input type="date" id="new-version-date" value="${esc(p?.fromDate||'2026-12-14')}" /></div><div><label>Chọn 3 file Excel (.xlsx) cùng lúc</label><input type="file" id="excel-file" accept=".xlsx" multiple /><small class="formhint">Có thể nhập 1 file khi chỉ thay đổi một khối. Khi chọn cả 3, tạo lịch sạch 18 tiết không kế thừa tiết cũ.</small></div></div>
 <div class="row-buttons"><button class="btn soft" data-action="prepare-version">+ Tạo bản nháp từ lịch hiện tại</button><button class="btn primary" data-action="parse-excel">↥ Đọc tất cả file và kiểm tra lịch</button></div>
 ${p?`<div class="preview"><div class="preview-heading"><h4>Bản nháp: ${esc(p.name)} · ${esc(p.fromDate)}</h4><span class="tag">${p.slots.length} tiết</span></div><p>Đã nhập ${p.imported||0} tiết mới. Các tiết khác được kế thừa để tránh mất lịch chưa thay đổi.</p>
 ${p.warnings?.length?`<div class="warning">${p.warnings.map(esc).join('; ')}</div>`:''}
 ${previewConflicts(p.slots).length?`<div class="warning">Có ${previewConflicts(p.slots).length} ô trùng lịch. Hãy xóa một trong các tiết trùng trước khi áp dụng.</div>`:''}
 <div class="table-scroller"><table class="data-table"><thead><tr><th>Thứ</th><th>Buổi</th><th>Tiết</th><th>Lớp</th><th>Môn</th><th></th></tr></thead><tbody>${[...p.slots].sort((a,b)=>a.day-b.day||'SCT'.indexOf(a.shift)-'SCT'.indexOf(b.shift)||a.period-b.period).map(s=>`<tr><td>${dayLabel(s.day)}</td><td>${shiftLabel(s.shift)}</td><td>${s.period}</td><td>${className(s.classId)}</td><td>${s.subject}</td><td><button class="text-danger" data-action="remove-draft-slot" data-id="${esc(s.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>
 <div class="row-buttons"><button class="btn primary" data-action="save-version" ${previewConflicts(p.slots).length?'disabled':''}>✓ Xác nhận lưu phiên bản</button><button class="btn ghost" data-action="discard-version">Hủy bản nháp</button></div></div>`:''}</section>`;
}
function previewConflicts(slots){const m={};for(const e of slots){const k=`${e.day}|${e.shift}|${e.period}`;(m[k]||=([])).push(e);}return Object.entries(m).filter(([,x])=>x.length>1);}
function settingsPage(){return `<div class="pagehead"><div><div class="eyebrow">CẤU HÌNH HỆ THỐNG</div><h2>Dữ liệu & kết nối</h2><p>Quản lý quyền truy cập, sao lưu, lớp học và nơi lưu Google Sheets.</p></div></div>
 <div class="backend-health panel"><div><strong>Trạng thái lưu dạy thêm</strong><small>${$state.mode!=='google'?'Chưa kết nối Google Sheets':$state.extraServerReady===true?`Đã sẵn sàng · Apps Script ${esc($state.extraServerVersion)}`:$state.extraServerReady===false?`Cần cập nhật Apps Script · ${esc($state.extraServerError)}`:'Chưa kiểm tra'}</small></div><button class="btn primary" data-action="probe-extra">Kiểm tra máy chủ</button><button class="btn soft" data-action="diagnose-sync">Kiểm tra đồng bộ Sheets</button><button class="btn ghost" data-action="clear-local-snapshot">Xóa cache trên thiết bị (bảo lưu PPCT trên Sheets)</button><button class="btn soft" data-view="versions">↥ Nhập lại TKB sạch từ 3 file</button></div>${$state.syncDiagnostics?`<section class="panel sync-report"><h3>Kiểm tra đồng bộ hai chiều</h3><p>Frontend ${FRONTEND_VERSION} · API ${esc($state.syncDiagnostics.apiVersion||'Chưa rõ')} · Apps Script ${esc($state.extraServerVersion||'Chưa xác định')}</p><p>Google Sheets: ${$state.mode==='google'?'Đã kết nối':'Chưa kết nối'} · Lịch lặp ${$state.syncDiagnostics.counts?.patterns||0} · Buổi/ngoại lệ ${$state.syncDiagnostics.counts?.exceptions||0} · Lịch tuần ${$state.syncDiagnostics.weekCount||0}</p><p>Lần cuối: ${esc($state.syncDiagnostics.lastRequest?.at||'Chưa có')} · ${esc($state.syncDiagnostics.lastRequest?.action||'')} · Đồng bộ lúc ${esc(new Date($state.syncDiagnostics.readAt).toLocaleString('vi-VN'))}</p></section>`:''}<div class="system-status panel"><strong>Trạng thái thiết bị này</strong><p>Frontend ${FRONTEND_VERSION} · API ${esc($state.apiVersion||'chưa xác định')} · Apps Script ${esc($state.extraServerVersion||'chưa xác định')}</p><p>GAS ${esc($state.extraServerVersion||'?')} · File: ${esc($state.extraSourceSheet||'chưa xác định')} ${esc($state.extraSourceTail?('(...'+$state.extraSourceTail+')'):'')}.</p><p>Phiên: ${esc($state.sessionStatus)} · Google Sheets: ${$state.mode==='google'?'Đã kết nối':'Chưa kết nối'} · Lịch lặp: ${$state.data.extra_patterns?.length||0} · Ngoại lệ: ${$state.data.extra_sessions?.length||0}</p><p>Đồng bộ lần cuối: ${esc($state.lastSyncedAt?new Date($state.lastSyncedAt).toLocaleString('vi-VN'):'Chưa có')} · HTTP cuối: ${esc($state.lastHttpStatus||'Chưa có')} · Mã lỗi: ${esc($state.lastApiError||'Không có')}</p><div class="auth-actions"><button class="btn soft" data-action="diagnose-system">Kiểm tra trạng thái hệ thống</button><button class="btn soft" data-action="verify-release">Xác minh phiên bản Web / API / GAS</button>${$state.updateAvailable?'<button class="btn primary" data-action="refresh-app">Cập nhật ứng dụng</button>':''}</div></div><div class="setting-grid"><section class="panel"><div class="panelheading"><h3>Google Sheets</h3><p>Chế độ hiện tại: <strong>${$state.mode==='google'?'Đã kết nối':'Dùng thử trong trình duyệt'}</strong></p></div>${$state.mode==='demo'?`<p>Đăng nhập sau khi đã cấu hình API trên Vercel. Dữ liệu demo đang lưu riêng trên máy này.</p><label>Mật khẩu ứng dụng</label><input id="login-pass" type="password" autocomplete="current-password" placeholder="Nhập APP_PASSWORD"/><button class="btn primary full" data-action="login">Kết nối Google Sheets</button><p class="caption">Nếu chưa cấu hình máy chủ, xem hướng dẫn README.</p>`:`<p>Dữ liệu được lưu trong Google Sheets thông qua Apps Script và Vercel API. Khóa API không xuất hiện trong trình duyệt.</p><button class="btn soft" data-action="logout">Đăng xuất</button><button class="btn primary" data-action="bootstrap">Khởi tạo dữ liệu mẫu trên Sheet trống</button>`}</section>
 <section class="panel"><div class="panelheading"><h3>Sao lưu</h3><p>Xuất toàn bộ dữ liệu để lưu an toàn; có thể mở bằng trình soạn thảo JSON.</p></div><button class="btn soft full" data-action="backup">↓ Tải bản sao JSON</button><button class="btn ghost full" data-action="diagnose-extra">⌕ Kiểm tra dạy thêm đã lưu</button><button class="btn ghost full" data-action="print">⎙ In thời khóa biểu hiện tại</button></section></div>
 <section class="panel"><div class="panelheading"><h3>Lớp đang phụ trách</h3></div><div class="class-grid">${$state.data.classes.map(c=>`<div class="class-card"><div class="class-symbol">${esc(c.grade)}</div><div><strong>${esc(c.name)} <small>${esc(c.id)}</small></strong><div>${esc(c.subjects.join(' · '))}</div></div></div>`).join('')}</div></section>`;
}
function modal(){
 if(!$state.edit)return '';
 if($state.edit.type==='login')return `<div class="backdrop"><section class="modal cache-login" role="dialog" aria-modal="true"><div class="modalhead"><h3>Đăng nhập để đồng bộ Google Sheets</h3><button class="icon-btn" data-action="close-modal">×</button></div><p>Bản TKB đang hiển thị chỉ để xem. Dữ liệu mới chỉ được đọc sau khi đăng nhập hợp lệ.</p><label for="login-pass">Mật khẩu Smart TKB</label><input id="login-pass" type="password" autocomplete="current-password"/><button class="btn primary" data-action="login">Đăng nhập và đồng bộ</button></section></div>`;
 if(['move','addMain','pasteMain'].includes($state.edit.type))return moveModal();
 if($state.edit.type==='deleteMain')return deleteMainModal();
 if($state.edit.type==='conflict')return conflictModal();
 if($state.edit.type==='choose'){
  const x=$state.edit;
  return `<div class="backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><div class="modalhead"><h3>${fmt(x.date)} · ${shiftLabel(x.shift)} ${x.period}</h3><button class="icon-btn" data-action="close-modal">×</button></div><p>Chọn loại lịch cần thêm. Chính khóa và dạy thêm được lưu riêng.</p><div class="row-buttons"><button class="btn primary" data-action="choose-official">Chính khóa / Dạy bù</button><button class="btn soft" data-action="choose-extra">Dạy thêm</button></div></section></div>`;
 }
 return $state.edit.type==='extra'?extraModal():officialModal();
}
function conflictModal(){
 const {date,shift,period}=$state.edit;
 const list=eventsForWeek($state.data,monday(date)).filter(e=>e.kind==='MAIN'&&e.date===date&&e.shift===shift&&Number(e.period)===Number(period));
 return `<div class="backdrop" data-action="close-modal"><section class="modal conflict-editor" role="dialog" aria-modal="true" aria-label="Chọn tiết trùng để xử lý"><div class="modalhead"><h3>Xử lý từng tiết bị trùng</h3><button class="icon-btn" data-action="close-modal">×</button></div>
 <p>${fmt(date)} · ${shiftLabel(shift)} tiết ${period}. Mỗi nút chỉ tác động đến <strong>đúng lớp được chọn</strong>, không tự xóa tiết học còn lại.</p>
 <div class="conflict-choices">${list.map(e=>`<div class="conflict-entry"><strong>${esc(e.subject)} · ${esc(className(e.classId))}</strong><small>${esc(e.stream||'')} · PPCT ${esc(e.ppct?.period||'—')}</small><div class="row-buttons"><button type="button" class="btn primary" data-action="start-move" data-date="${esc(e.date)}" data-id="${esc(e.id)}">✎ Sửa / chuyển</button><button type="button" class="btn danger" data-action="start-delete-main" data-date="${esc(e.date)}" data-id="${esc(e.id)}">🗑 Xóa tiết</button><button type="button" class="btn soft" data-action="copy-main" data-date="${esc(e.date)}" data-id="${esc(e.id)}">⧉ Sao chép</button></div></div>`).join('')}</div>
 <p class="formhint">Mỗi thao tác được chọn phạm vi: <strong>chỉ tuần này</strong> hoặc <strong>đến khi có TKB mới</strong>. Khi xóa, chương trình vẫn giữ lịch sử trên Google Sheets.</p></section></div>`;
}
function chosenMainEvent(date,id){return eventsForWeek($state.data,monday(date)).find(e=>e.kind==='MAIN'&&e.date===date&&(e.id===id||e.originalSlotId===id));}
function mainScopeOptions(oneOnly=false){return options(oneOnly?[['one','Chỉ tuần đang xem']]:[['future','Từ tuần này đến khi có TKB mới (mặc định)'],['one','Chỉ tuần đang xem']],oneOnly?'one':'future');}
function moveModal(){
 const {date,sourceSlotId}=$state.edit;
 const pasting=$state.edit.type==='pasteMain',adding=$state.edit.type==='addMain',copy=$state.clipboardMain;
 const event=adding||pasting?null:chosenMainEvent(date,sourceSlotId);
 const version=activeVersion($state.data,date);
 const stored=adding||pasting?null:($state.data.slots||[]).find(x=>x.versionId===version?.id&&x.id===sourceSlotId);
 const onceSource=!stored&&!(adding||pasting)?($state.data.changes||[]).find(x=>x.id===sourceSlotId&&['MAIN_ADD_ONCE','MAIN_REPLACE_ONCE'].includes(x.action)):null;
 if(!version||(!(adding||pasting)&&(!event||(!stored&&!onceSource))))return `<div class="backdrop"><section class="modal"><p>Không tìm thấy tiết cần sửa. Hãy tải lại dữ liệu Google Sheets.</p><button data-action="close-modal" class="btn soft">Đóng</button></section></div>`;
 if(pasting&&!copy)return `<div class="backdrop"><section class="modal"><p>Chưa chọn tiết để sao chép.</p><button data-action="close-modal" class="btn soft">Đóng</button></section></div>`;
 const initial=pasting?{...copy,shift:$state.edit.shift,period:Number($state.edit.period)}:adding?{classId:'7F38',subject:'Toán',stream:'',shift:$state.edit.shift||'S',period:Number($state.edit.period)||1} :{...(stored||onceSource),...(event||{})};
 const oneOnly=Boolean(onceSource);
 const days=DAYS.map(d=>[addDays(monday(date),d.n-2),`${d.label} · ${fmt(addDays(monday(date),d.n-2))}`]);
 const action=adding?'ADD':pasting?'COPY':'EDIT';
 return `<div class="backdrop" data-action="close-modal"><section class="modal move-editor" role="dialog" aria-modal="true" aria-label="${adding?'Thêm':pasting?'Dán':'Sửa'} tiết chính khóa"><div class="modalhead"><h3>${adding?'Thêm tiết chính khóa':pasting?'Dán tiết đã sao chép':'Sửa / chuyển tiết chính khóa'}</h3><button data-action="close-modal" class="icon-btn">×</button></div>
 ${adding?'<p>Thêm tiết mới vào một ô trống.</p>':pasting?`<p>Dán bản sao <strong>${esc(copy.subject)} ${esc(className(copy.classId))}</strong> vào ô mới. <strong>Tiết gốc vẫn được giữ.</strong></p>`:`<p><strong>Tiết đang chọn:</strong> ${esc(event.subject)} ${esc(className(event.classId))} ${esc(event.stream||'')} · ${shiftLabel(event.shift)} tiết ${esc(event.period)}.</p><p class="formhint">Sửa tiết này, không tác động các lớp khác trong ô trùng.</p>`}
 <form id="move-form" data-main-action="${action}"><div class="formgrid">${!adding&&!pasting?'<div class="wide"><label for="move-action">Thao tác với tiết</label><select id="move-action"><option value="REPLACE">Thay bằng tiết mới (một lần ghi nguyên tử, ID mới)</option><option value="EDIT">Chỉ sửa thông tin/di chuyển tiết hiện có</option></select><small class="formhint">Khi thay tiết, không cần xóa trước: dữ liệu cũ được thay thế trong cùng một giao dịch Google Sheets.</small></div>':''}
 <div class="wide"><label for="move-scope">Phạm vi áp dụng</label><select id="move-scope">${mainScopeOptions(oneOnly)}</select><small class="formhint">Một tuần: chỉ thay đổi tuần hiện tại. Đến khi có TKB mới: lưu trên Google Sheets và tự lặp mỗi tuần, dừng khi nhập TKB chính thức mới.</small></div>
 <div><label for="move-class">Lớp</label><select id="move-class">${options(($state.data.classes||[]).map(c=>[c.id,`${c.name} (${c.id})`]),initial.classId)}</select></div>
 <div><label for="move-subject">Môn học</label><select id="move-subject">${options([['Toán','Toán'],['Tin','Tin']],initial.subject)}</select></div>
 <div><label for="move-stream">Mạch Toán</label><select id="move-stream">${options([['','Tự phân bổ theo PPCT'],['ĐS','Đại số'],['HH','Hình học']],initial.subject==='Toán'?initial.stream||'':'')}</select></div>
 <div><label for="move-date">Thứ</label><select id="move-date">${options(days,date)}</select></div>
 <div><label for="move-shift">Buổi</label><select id="move-shift">${options([['S','Sáng'],['C','Chiều'],['T','Tối']],initial.shift)}</select></div>
 <div><label for="move-period">Tiết / suất</label><select id="move-period">${options([[1,'1'],[2,'2'],[3,'3'],[4,'4'],[5,'5']],Number(initial.period))}</select></div>
 <div class="wide"><label for="move-reason">Lý do</label><input id="move-reason" placeholder="Ví dụ: Điều chỉnh do trùng tiết" maxlength="220" value="${adding?'Thêm tiết chính khóa':pasting?'Sao chép tiết chính khóa':'Sửa thời khóa biểu chính khóa'}"></div>
 <div class="wide"><p class="formhint">Nếu không sửa bất kỳ thông tin nào, không cần bấm Lưu. Muốn loại bỏ tiết đã chọn, dùng nút <strong>Xóa tiết</strong>.</p></div>
 </div><p id="main-error" class="extra-server-alert" hidden role="alert"></p><div class="modalactions"><button class="btn ghost" type="button" data-action="close-modal">Hủy</button>${!adding&&!pasting?`<button class="btn soft" type="button" data-action="copy-main" data-date="${esc(date)}" data-id="${esc(sourceSlotId)}">⧉ Sao chép</button><button class="btn danger" type="button" data-action="start-delete-main" data-date="${esc(date)}" data-id="${esc(sourceSlotId)}">🗑 Xóa tiết</button>`:''}<button class="btn primary" type="submit">${adding?'Thêm và lưu':pasting?'Dán và lưu':'✓ Lưu thay đổi'}</button></div></form></section></div>`;
}
function deleteMainModal(){
 const {date,sourceSlotId}=$state.edit;
 const event=chosenMainEvent(date,sourceSlotId),onceSource=($state.data.changes||[]).find(x=>x.id===sourceSlotId&&x.action==='MAIN_ADD_ONCE');
 if(!event)return `<div class="backdrop"><section class="modal"><p>Tiết này không còn trong lịch. Hãy đồng bộ lại.</p><button class="btn soft" data-action="close-modal">Đóng</button></section></div>`;
 return `<div class="backdrop" data-action="close-modal"><section class="modal move-editor" role="dialog" aria-modal="true" aria-label="Xóa một tiết chính khóa"><div class="modalhead"><h3>🗑 Xóa đúng tiết đã chọn</h3><button class="icon-btn" data-action="close-modal">×</button></div>
 <div class="current-lesson"><strong>${esc(event.subject)} · ${esc(className(event.classId))}</strong><span>${esc(date)} · ${shiftLabel(event.shift)} · tiết ${esc(event.period)}</span><small>Chỉ xóa tiết này; nếu bị trùng, tiết còn lại vẫn giữ nguyên.</small></div>
 <div class="formgrid"><div class="wide"><label for="delete-scope">Phạm vi xóa</label><select id="delete-scope">${mainScopeOptions(Boolean(onceSource))}</select><small class="formhint">Xóa một tuần: tuần sau tiết cũ vẫn còn. Xóa đến khi có TKB mới: tuần tiếp theo cũng bỏ tiết, nhưng TKB mới của trường sẽ thay thế.</small></div><div class="wide"><label for="delete-reason">Lý do (tùy chọn)</label><input id="delete-reason" maxlength="220" value="Xử lý tiết chính khóa trùng hoặc không còn dạy"></div></div>
 <div class="modalactions"><button class="btn ghost" data-action="close-modal">Hủy</button><button class="btn danger" data-action="confirm-delete-main">Xác nhận xóa tiết</button></div></section></div>`;
}
async function sendMainMutation(action,scope,sourceSlotId,patch,reason){
 if($state.mode!=='google')throw Error('Chỉ có thể ghi khi đã kết nối Google Sheets.');
 if($state.mainServerReady!==true){
  const capability=await probeExtraServer();
  if(!capability.verifiedMainWrites||!capability.supportedMainActions?.includes('DELETE'))throw Error(`Apps Script đang chạy bản ${capability.gasVersion||capability.apiVersion||'cũ'} chưa hỗ trợ sửa/xóa/sao chép TKB. Cần cập nhật gas/Code.gs V1.8.0 và triển khai Phiên bản mới trong Apps Script (dùng bút chì để giữ nguyên GAS_URL).`);
 }
 const fromDate=monday($state.edit.date);
 const initial=scope==='future'?previewMainRevision($state.data,{action,sourceSlotId,fromDate,...patch}):previewMainOnce($state.data,{action,sourceSlotId,fromDate,...patch});
 const target=patch?` ${className(patch.classId)} ${patch.subject} · ${dayLabel(patch.day)} ${shiftLabel(patch.shift)} tiết ${patch.period}`:'';
 const scopeName=scope==='one'?'CHỈ TUẦN ĐANG XEM':'TỪ TUẦN NÀY ĐẾN KHI CÓ TKB MỚI';
 if(!window.confirm(`${action==='DELETE'?'XÓA':action==='COPY'?'SAO CHÉP':action==='ADD'?'THÊM':action==='REPLACE'?'THAY THẾ':'SỬA'} TIẾT CHÍNH KHÓA — ${scopeName}?\n${action==='DELETE'?`${className(initial.origin?.classId)} ${initial.origin?.subject}`:target}\nCác tuần trước không thay đổi. Dữ liệu ghi trực tiếp Google Sheets.`))return;
 const requestId=$state.edit.requestId||newRequestId();$state.edit.requestId=requestId;
 const result=await callApi({op:'mutateMainSchedule',action,scope,fromDate,expectedVersionId:initial.version.id,sourceSlotId,patch:patch||{},requestId,reason});
 if(!result.verified)throw Error('Google Sheets chưa xác nhận ghi dữ liệu, hãy kiểm tra trước khi thử lại.');
 try{await pullGoogle();}catch(e){throw Error('Máy chủ đã ghi nhưng chưa đọc lại được Google Sheets: '+e.message);}
 if(scope==='future'){
  const active=activeVersion($state.data,fromDate);
  if(active?.id!==result.versionId)throw Error('Dữ liệu được ghi nhưng chưa tải đúng phiên bản TKB mới. Hãy bấm đồng bộ.');
  const saved=$state.data.slots.find(s=>s.versionId===result.versionId&&s.id===result.sourceSlotId);
  if(action==='DELETE'&&saved)throw Error('Tiết chưa được xóa trên dữ liệu mới. Hãy tải lại.');
  if(action!=='DELETE'&&(!saved||saved.classId!==patch.classId||saved.subject!==patch.subject||Number(saved.day)!==patch.day||saved.shift!==patch.shift||Number(saved.period)!==patch.period))throw Error('Tiết mới chưa khớp bản lưu Google Sheets. Hãy tải lại.');
 }else{
  const saved=$state.data.changes.find(x=>x.id===result.changeId);
  if(!saved)throw Error('Chưa đọc lại được bản ghi ngoại lệ một tuần. Hãy đồng bộ trước khi thử lại.');
  if(action==='DELETE'&&!['MAIN_DELETE_ONCE','MAIN_VOID_ONCE'].includes(saved.action))throw Error('Chưa xác nhận xóa tiết một tuần.');
  if(action!=='DELETE'){
   const targetDate=addDays(fromDate,Number(patch.day)-2);
   const visible=eventsForWeek($state.data,fromDate).some(x=>x.kind==='MAIN'&&x.date===targetDate&&x.shift===patch.shift&&Number(x.period)===patch.period&&x.classId===patch.classId&&x.subject===patch.subject);
   if(!visible)throw Error('Chưa thấy tiết đã sửa trên lịch của tuần này. Hãy tải lại.');
  }
 }
 $state.edit=null;
 if(action==='COPY')$state.clipboardMain=null;
 return notify(`✓ Đã ${action==='DELETE'?'xóa':action==='COPY'?'dán bản sao':action==='ADD'?'thêm':'sửa'} tiết trên Google Sheets, phạm vi: ${scope==='one'?'chỉ tuần '+schoolWeek(fromDate):'từ tuần '+schoolWeek(fromDate)+' đến khi có TKB mới'}.`);
}
async function saveMove(){
 const {date,sourceSlotId=''}=$state.edit;
 const action=$('#move-action')?.value||$('#move-form')?.dataset.mainAction||(!sourceSlotId?'ADD':'EDIT');
 const toDate=$('#move-date')?.value,shift=$('#move-shift')?.value,period=Number($('#move-period')?.value);
 const scope=$('#move-scope')?.value||'future',classId=$('#move-class')?.value,subject=$('#move-subject')?.value,stream=$('#move-stream')?.value||'';
 const reason=($('#move-reason')?.value||'Điều chỉnh TKB').trim();
 if(!toDate)throw Error('Chưa chọn ngày đích');
 return sendMainMutation(action,scope,['EDIT','REPLACE'].includes(action)?sourceSlotId:'',{day:dayNumber(toDate),shift,period,classId,subject,stream},reason);
}
async function saveMainDelete(){
 const scope=$('#delete-scope')?.value||'future',reason=($('#delete-reason')?.value||'Xóa tiết chính khóa').trim();
 return sendMainMutation('DELETE',scope,$state.edit.sourceSlotId,null,reason);
}
function extraModal(){
 const {date,shift,period}=$state.edit;
 const current=tutoringForWeek($state.data,monday(date)).find(e=>e.date===date&&e.shift===shift&&Number(e.period)===Number(period));
 const groups=parseGroups(current?.groups),known=new Set([...($state.data.classes||[]).map(c=>c.id),...EXTRA_CLASSES]);
 const gradeGroups=Array.from({length:7},(_,i)=>i+6).flatMap(g=>['A','B','C'].map(letter=>`${g}${letter}`));
 const groupChoices=gradeGroups.filter(name=>!($state.data.classes||[]).some(c=>c.id===name));
 const classIds=groups.filter(g=>known.has(g)),custom=groups.filter(g=>!known.has(g));
 const repeatRule=current?.recurring?(current.toDate?'until':'weekly'):current?'once':'weekly';
 return `<div class="backdrop" data-action="close-modal"><section class="modal extra-editor v16-modal" role="dialog" aria-modal="true" aria-label="${current?'Chỉnh sửa':'Thêm'} suất dạy thêm"><div class="modalhead"><div><div class="eyebrow">DẠY THÊM · LƯU TRÊN GOOGLE SHEETS</div><h3>${current?'Chỉnh sửa suất dạy thêm':'Thêm suất dạy thêm'}</h3><p>${fmt(date)} · ${dayLabel(dayNumber(date))} · ${shiftLabel(shift)} · ${shift==='T'?'Suất':'Tiết'} ${period}</p></div><button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng cửa sổ">×</button></div>
 ${$state.mode!=='google'?'<div class="editor-warning">⚠ Đang xem bản TKB đã lưu, không thể chỉnh sửa khi chưa đăng nhập và kết nối Google Sheets.</div>':$state.extraServerReady===false?`<div class="editor-warning"><b>Máy chủ lưu dạy thêm chưa đồng bộ.</b><p>${esc($state.extraServerError)}</p><p>Hãy triển khai Apps Script bản mới rồi bấm Kiểm tra máy chủ trong mục Cấu hình.</p></div>`:''}
 <form id="extra-form"><div class="formgrid">
 <div><label for="extra-subject">Môn học</label><select id="extra-subject">${options([['Toán','Toán'],['Tin','Tin']],current?.subject||'Toán')}</select></div>
 <div><label for="extra-start-lesson">Buổi thứ</label><input id="extra-start-lesson" type="number" min="1" max="9999" value="${esc(current?.lessonNumber||1)}"></div>
 <div class="wide"><label>Chọn lớp dạy thêm nhanh (2 chạm)</label><div class="extra-filter-bar" aria-label="Chọn khối">${[6,7,8,9,10,11,12].map(n=>`<button type="button" class="btn ${$state.extraPickerGrade===n?'primary':'soft'}" data-pick-grade="${n}">Khối ${n}</button>`).join('')}</div><div class="extra-filter-bar" aria-label="Chọn lớp">${['A','B','C'].map(letter=>`<button type="button" class="btn soft" data-pick-letter="${letter}">${$state.extraPickerGrade}${letter}</button>`).join('')}</div><small class="formhint">Chọn khối, sau đó chọn A/B/C. Có thể chọn nhiều lớp.</small></div>
 <div class="wide"><label>Chọn nhiều lớp đang quản lý</label><div class="extra-class-picks">${[...($state.data.classes||[]).map(c=>({id:c.id,name:c.name})),...groupChoices.map(id=>({id,name:id}))].map(c=>`<label class="extra-class-option"><input type="checkbox" data-extra-class="${esc(c.id)}" ${groups.includes(c.id)?'checked':''}><span>${esc(c.name)}</span></label>`).join('')}</div></div>
 <div class="wide"><label for="extra-free-classes">+ Thêm tên lớp / nhóm khác</label><textarea id="extra-free-classes" rows="2" placeholder="Ví dụ: Toán 7A, Toán 7B, Nhóm nâng cao 9">${esc(custom.join(', '))}</textarea><small class="formhint">Nhập mỗi tên trên một dòng hoặc ngăn bằng dấu phẩy. Một suất hỗ trợ tối đa 60 lớp/nhóm.</small><div class="group-preview" id="group-preview" aria-live="polite"></div></div>
 <div class="wide"><label for="extra-lesson-title">Nội dung bài học</label><input id="extra-lesson-title" maxlength="350" value="${esc(current?.lessonTitle||'')}" placeholder="Ví dụ: Luyện tập phương trình"></div>
 <div><label for="extra-start-time">Giờ bắt đầu (không bắt buộc)</label><input id="extra-start-time" type="time" value="${esc(current?.startTime||'')}"></div>
 <div><label for="extra-end-time">Giờ kết thúc (không bắt buộc)</label><input id="extra-end-time" type="time" value="${esc(current?.endTime||'')}"></div>
 <div class="wide"><label for="extra-notes">Ghi chú</label><textarea id="extra-notes" rows="2" placeholder="Ghi chú cho buổi học">${esc(current?.notes||'')}</textarea></div>
 ${current?.recurring?`<div class="wide extra-rule"><strong>↻ Lịch dạy thêm lặp theo tuần</strong><p>Đang xem buổi thứ ${esc(current.lessonNumber)} · Thay đổi không ảnh hưởng chính khóa và PPCT.</p><label for="extra-scope">Phạm vi sửa</label><select id="extra-scope">${options([['one','Chỉ ngày này'],['future','Từ ngày này trở đi'],['all','Toàn bộ chuỗi lịch']], 'one')}</select></div>`:
 `<div class="wide extra-rule"><label for="extra-frequency">Lịch lặp</label><select id="extra-frequency">${options([['weekly','↻ Lặp hàng tuần (mặc định)'],['once','Chỉ một tuần'],['until','Lặp đến ngày được chọn']],repeatRule)}</select><div id="extra-end-wrap" class="extra-end-wrap"><label for="extra-end-date">Ngày kết thúc lặp</label><input type="date" id="extra-end-date" min="${date}" value="${esc(current?.toDate||'')}"></div></div>`}
 <div class="wide"><label for="extra-teaching-status">Trạng thái ca dạy thêm (không tính PPCT)</label><select id="extra-teaching-status">${options([['PLANNED','Chưa dạy'],['DONE','Đã dạy'],['OFF','Nghỉ'],['MAKEUP','Bù']],current?.status||'PLANNED')}</select><input type="checkbox" id="extra-completed" ${current?.completed?'checked':''} hidden></div>
 </div><div class="editor-error" id="extra-error" role="alert" hidden></div><div class="editor-status" id="extra-status" role="status" aria-live="polite"></div>
 <div class="modalactions"><button type="button" class="btn ghost" data-action="close-modal">Đóng</button>${current?`<button type="button" class="btn danger" data-action="delete-extra">${current.recurring?'Nghỉ / dừng lịch':'Xóa suất'}</button>`:''}<button type="submit" class="btn primary extra-save">${current?'Lưu thay đổi':'Lưu suất dạy thêm'}</button></div></form></section></div>`;
}
function updateExtraFormUI(){
 const select=$('#extra-frequency'),end=$('#extra-end-wrap');if(end)end.hidden=select?.value!=='until';
 const items=[...document.querySelectorAll('[data-extra-class]:checked')].map(el=>className(el.dataset.extraClass)).concat(parseGroups($('#extra-free-classes')?.value));
 const view=$('#group-preview');if(view)view.innerHTML=`<b>${items.length} lớp/nhóm</b> ${items.map(x=>`<span>${esc(x)}</span>`).join('')}`;
}
function officialModal(){
 const {date,shift,period}= $state.edit;
 const events=eventsForWeek($state.data,monday(date)).filter(e=>e.kind!=='EXTRA'&&e.date===date&&e.shift===shift&&e.period===Number(period));
 const e=events[0],ch=($state.data.changes||[]).find(x=>x.kind!=='EXTRA'&&x.date===date&&x.shift===shift&&x.period===Number(period));
 const action=ch?.action||(!e?'ADD':e.kind!=='MAIN'?'ADD':'EDIT');
 const classId=ch?.classId||e?.classId||'7F38',subject=ch?.subject||e?.subject||'Toán',stream=ch?.stream||e?.stream||'ĐS';
 const lessons=ppctSequence($state.data,classById($state.data,classId)?.grade||7,subject,subject==='Tin'?'TIN':stream,classId);
 return `<div class="backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><div class="modalhead"><div><div class="eyebrow">CHÍNH KHÓA / DẠY BÙ</div><h3>${fmt(date)} · ${shiftLabel(shift)} · ${shift==='T'?'Suất':'Tiết'} ${period}</h3></div><button class="icon-btn" data-action="close-modal">×</button></div>
 ${e?`<div class="current-lesson"><strong>${esc(e.subject)} ${esc(className(e.classId))} ${esc(e.stream||'')}</strong><span>${esc(e.ppct?.title||'Chưa có nội dung PPCT')}</span><small>${e.kind==='MAIN'?'Chính khóa':'Dạy bù'}</small></div>`:'<div class="current-lesson">Ô trống: thêm tiết dạy bù chính khóa. Dạy thêm được nhập ở tab riêng.</div>'}
 <div class="row-buttons manual-main-action"><button type="button" class="btn soft" data-action="${e&&e.kind==='MAIN'?'start-move':'start-main-add'}" ${e&&e.kind==='MAIN'?`data-id="${esc(e.id)}"`:''} data-date="${esc(date)}" data-shift="${esc(shift)}" data-period="${period}">${e&&e.kind==='MAIN'?'✎ Sửa tiết cố định cho các tuần sau':'＋ Thêm tiết chính khóa cố định hàng tuần'}</button></div>
 ${e&&e.kind==='MAIN'?`<div class="row-buttons main-entry-actions"><button class="btn danger" type="button" data-action="start-delete-main" data-date="${esc(date)}" data-id="${esc(e.id)}">🗑 Xóa tiết này</button><button class="btn soft" type="button" data-action="copy-main" data-date="${esc(date)}" data-id="${esc(e.id)}">⧉ Sao chép tiết</button></div>`:''}
 ${!e&&$state.clipboardMain?`<div class="row-buttons"><button class="btn primary" type="button" data-action="start-paste-main" data-date="${esc(date)}" data-shift="${esc(shift)}" data-period="${period}">📋 Dán ${esc($state.clipboardMain.subject)} ${esc(className($state.clipboardMain.classId))} vào ô này</button></div>`:''}
 <form id="edit-form"><div class="formgrid"><div class="wide"><label>Hành động</label><select id="edit-action">${options([...(e&&e.kind==='MAIN'?[['EDIT','Chỉnh nội dung / số tiết PPCT (chưa xác nhận đã dạy)'],['DONE','Đã dạy và hoàn thành PPCT'],['OFF','Nghỉ tiết (không tăng PPCT)']]:[]),['ADD','Thêm tiết dạy bù']],action)}</select></div>
 <div><label>Lớp chính khóa</label><select id="edit-class">${options(($state.data.classes||[]).map(c=>[c.id,`${c.name} (${c.id})`]),classId)}</select></div>
 <div><label>Môn</label><select id="edit-subject">${options([['Toán','Toán'],['Tin','Tin']],subject)}</select></div>
 <div><label>Mạch PPCT</label><select id="edit-stream">${options([['ĐS','Đại số'],['HH','Hình học'],['TIN','Tin học']],stream)}</select></div>
 <div class="wide"><label>Nội dung PPCT (không bắt buộc)</label><select id="edit-ppct"><option value="">Tự đề xuất theo tiến độ</option>${lessons.map(p=>`<option value="${esc(p.id)}" ${(ch?.ppctId||e?.ppct?.id)===p.id?'selected':''}>Tiết ${p.period}: ${esc(p.title).slice(0,86)}</option>`).join('')}</select></div>
 <div class="wide"><label>Tên bài hiển thị (để trống = tên trong PPCT)</label><input id="edit-title" maxlength="350" value="${esc(ch?.titleOverride||'')}" placeholder="Sửa tên bài nếu cần, không làm thay đổi tài liệu PPCT gốc"></div>
 <div class="wide"><label>Phạm vi điều chỉnh</label><select id="edit-scope">${options([['one','A. Chỉ tiết này'],['following','B. Tính lại các tiết chưa dạy tiếp theo cùng lớp/mạch'],['future','C. Ghi nhớ quy tắc ĐS/HH cho các tuần sau']],ch?.scope||'following')}</select></div>
 <div class="wide"><label>Quy tắc ĐS/HH cho tuần sau (nếu chọn C, ví dụ: ĐS,ĐS,HH,ĐS)</label><input id="edit-pattern" placeholder="ĐS,ĐS,HH,ĐS" value="${esc(($state.data.ppct_overrides||[]).find(r=>r.classId===classId&&r.fromDate===addDays(monday(date),7))?.pattern?.join(',')||'')}" /><small class="formhint">Chỉ áp dụng khi số tiết từng mạch phù hợp PPCT của tuần. Không tự thay đổi các tiết đã xác nhận.</small></div>
 <div class="wide"><label>Lý do điều chỉnh</label><input id="edit-reason" maxlength="2000" placeholder="Ví dụ: Tiết đã hoàn thành trước kế hoạch"></div>
 <div class="wide"><label><input type="checkbox" id="edit-completed" ${ch?.completed?'checked':''}> Đã thực sự dạy và hoàn thành tiết PPCT này</label></div>
 <div class="wide"><label>Ghi chú</label><textarea id="edit-notes" rows="2">${esc(ch?.notes||'')}</textarea></div></div>
 <div class="modalactions"><button type="button" class="btn ghost" data-action="close-modal">Đóng</button>${ch?`<button type="button" class="btn ghost" data-action="undo-official" data-id="${esc(ch.id)}">↶ Hoàn tác gần nhất</button><button type="button" class="btn danger" data-action="clear-change">Hủy điều chỉnh</button>`:''}<button type="submit" class="btn primary">Lưu điều chỉnh</button></div></form></section></div>`;
}
function fitWeekTable(){
 const focus=$state.fitWeek&&['calendar','extra','overview'].includes($state.view);document.body.classList.toggle('week-focus',focus);
 const scroller=$('.week-scroller');if(!scroller)return;
 scroller.style.height='';document.documentElement.style.removeProperty('--tkb-row-height');
 if(window.matchMedia('(max-width:760px)').matches||!focus||$state.calendarLayout==='day')return;
 // Calculate the actual available height after toolbar/filters. Never crop the week.
 const top=scroller.getBoundingClientRect().top;
 const available=Math.max(210,window.innerHeight-top-7);
 scroller.style.height=available+'px';
 document.documentElement.style.setProperty('--tkb-row-height',Math.max(18,(available-39)/($state.filterShift==='all'?($state.view==='calendar'?10:12):$state.filterShift==='T'?2:5))+'px');
}
function updateEditorFields(){
 const scope=$('#edit-scope')?.value||'following';const pattern=$('#edit-pattern');if(pattern){const group=pattern.closest('.wide');if(group)group.hidden=scope!=='future';pattern.required=scope==='future';}
}
function updateMainFormUI(changed=''){
 const classSelect=$('#move-class'),subjectSelect=$('#move-subject'),streamSelect=$('#move-stream'),shiftSelect=$('#move-shift'),periodSelect=$('#move-period');
 if(!classSelect)return;
 const cls=classById($state.data,classSelect.value);
 if(subjectSelect&&changed==='move-class'&&cls){const keep=subjectSelect.value;const allowed=cls.subjects.filter(x=>['Toán','Tin'].includes(x));subjectSelect.innerHTML=options(allowed.map(x=>[x,x]),allowed.includes(keep)?keep:allowed[0]);}
 if(streamSelect){const isTin=subjectSelect?.value==='Tin';streamSelect.disabled=isTin;streamSelect.title=isTin?'Môn Tin học dùng mạch TIN tự động':'Chọn Đại số/Hình học hoặc tự phân bổ';if(isTin)streamSelect.value='';}
 if(periodSelect&&shiftSelect){const count=shiftSelect.value==='T'?2:5;const current=Math.min(Number(periodSelect.value)||1,count);if(periodSelect.options.length!==count)periodSelect.innerHTML=options(Array.from({length:count},(_,i)=>[i+1,String(i+1)]),current);}
}
function render(){
 document.body.classList.toggle('mobile-week-locked',['calendar','extra','overview'].includes($state.view)&&$state.calendarLayout==='week'&&['google','cached'].includes($state.mode));
 document.body.classList.toggle('drawer-active',$state.drawerOpen);
 if(!['google','cached'].includes($state.mode)){document.body.classList.remove('week-focus');$('#app').innerHTML=connectionPage();return;}
 if(!$state.data)return;
 $('#app').innerHTML=showTop()+modal();fitWeekTable();updateEditorFields();updateExtraFormUI();updateMainFormUI('move-class');
}
window.addEventListener('resize',()=>fitWeekTable());
window.addEventListener('orientationchange',()=>fitWeekTable());
document.addEventListener('fullscreenchange',()=>fitWeekTable());
function saveFile(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),300);}
async function exportCsv(){const events=[...eventsForWeek($state.data,$state.week).filter(e=>e.kind!=='EXTRA'),...tutoringForWeek($state.data,$state.week)];const headers=['Ngày','Buổi','Tiết / Suất','Lớp','Môn','Mạch','Loại','Trạng thái','Tiết PPCT','Bài học','Ghi chú'];const csv=[headers,...events.map(e=>[e.date,shiftLabel(e.shift),e.period,e.kind==='EXTRA'?parseGroups(e.groups).map(className).join(' + '):className(e.classId),e.subject,e.stream,e.kind,e.status,e.ppct?.period||'',e.ppct?.title||'',e.notes||''])].map(a=>a.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');saveFile(`SmartTKB_Tuan${schoolWeek($state.week)}.csv`,'\ufeff'+csv,'text/csv;charset=utf-8');}
async function prepareDraft(){const date=$('#new-version-date')?.value||'2026-12-14';const name=$('#new-version-name')?.value.trim()||'TKB mới';const best=activeVersion($state.data,date)||$state.data.versions[0];const id=`ver-${date}-${Date.now()}`;const slots=($state.data.slots||[]).filter(s=>s.versionId===best?.id).map((x,i)=>({...x,id:`${id}-s${i}`,versionId:id}));$state.pendingImport={id,name,fromDate:date,slots,imported:0,warnings:[]};render();}
async function importExcel(){const files=[...($('#excel-file')?.files||[])];if(!files.length)throw Error('Hãy chọn 1–3 file Excel trước');if(files.length>3)throw Error('Chỉ chọn tối đa 3 file Excel mỗi lần');let p=$state.pendingImport;
 if(!p) {await prepareDraft();p=$state.pendingImport;}
 const results=await Promise.all(files.map(extractTeacherSchedule));
 if(results.some(x=>!x.slots.length))throw Error(results.filter(x=>!x.slots.length).map(x=>x.warnings.join('; ')).join(' | ')||'Có file không nhận diện được tiết của thầy Đức');
 const sourceTypes=results.map(x=>x.type==='ict'?'ict':x.slots.some(s=>s.classId==='7F38')?'grade7':'grade9');
 if(new Set(sourceTypes).size!==sourceTypes.length)throw Error('Hai file cùng một nguồn TKB; cần tải khối 7, khối 9, Tin học khác nhau.');
 const dates=[...new Set(results.map(x=>x.fromDate).filter(Boolean))];
 if(dates.length>1)throw Error('Ba file có ngày áp dụng không thống nhất: '+dates.join(', '));
 if(dates.length&&p.fromDate!==dates[0]){p.fromDate=dates[0];p.name='TKB áp dụng '+dates[0];}
 if(files.length===3){
  if(new Set(sourceTypes).size!==3)throw Error('Để khởi tạo lịch sạch phải có khối 7, khối 9 và Tin học.');
  const counts=results.map(x=>x.slots.length).sort((a,b)=>a-b);
  if(JSON.stringify(counts)!=='[4,6,8]')throw Error('Ba file cần cho đủ 4 tiết Toán 7, 8 tiết Toán 9 và 6 tiết Tin; nhận được '+counts.join(', '));
  p.slots=[];p.imported=0;p.warnings=[];p.cleanImport=true;
 }else{
  const scopes=new Set(results.flatMap(r=>r.slots.map(x=>`${classById($state.data,x.classId)?.grade}|${x.subject}`)));
  p.slots=p.slots.filter(x=>!scopes.has(`${classById($state.data,x.classId)?.grade}|${x.subject}`));
 }
 for(const parsed of results){
  const base=p.slots.length;
  p.slots.push(...parsed.slots.map((x,i)=>({...x,id:`${p.id}-import-${base+i}`,versionId:p.id})));
  p.imported+=parsed.slots.length;p.warnings.push(...parsed.warnings);
 }
 const errors=previewConflicts(p.slots);
 if(errors.length)throw Error('Excel còn '+errors.length+' vị trí trùng: '+errors.map(([key])=>key).join(', ')+'. Hãy xử lý trước khi lưu.');
 $state.pendingImport=p;
 notify(`Đã đọc ${files.length} file, ${p.imported} tiết mới; bản nháp có ${p.slots.length} tiết/tuần. ${p.cleanImport?'TKB sạch, PPCT lịch sử bảo lưu.':''}`);
}
async function confirmDraft(){const p=$state.pendingImport;if(!p?.slots.length)throw Error('Chưa có lịch mới');if(previewConflicts(p.slots).length)throw Error('Phải xử lý trùng tiết trước khi lưu');
 const version={id:p.id,name:p.name,fromDate:p.fromDate,toDate:'',notes:'Tạo trên Smart TKB'};
 if($state.mode==='google'){const result=await callApi({op:'replaceVersion',version,slots:p.slots});if(!result.verified||result.count!==p.slots.length)throw Error('Google Sheets chưa xác nhận nhập đủ số tiết');await pullGoogle();const stored=$state.data.slots.filter(x=>x.versionId===version.id);if(stored.length!==p.slots.length||activeVersion($state.data,p.fromDate)?.id!==version.id)throw Error('Đã ghi nhưng kiểm tra lại phiên bản TKB chưa khớp');}else{$state.data.versions.push(version);$state.data.slots.push(...p.slots);cacheDemo();}
 $state.week=monday(p.fromDate);$state.pendingImport=null;$state.view='calendar';notify('Đã lưu phiên bản TKB mới. Tiến độ PPCT tiếp tục độc lập với phiên bản lịch.');
}
/** A selection only changes read-only preview. Explicit save creates a week-scoped revision. */
async function saveBaseline(id){
 const old=$state.data.baselines.find(b=>b.id===id);if(!old||$state.baselineSavingId)return;
 const cls=classById($state.data,old.classId);if(!cls)throw Error('Không tìm thấy lớp.');
 const seq=ppctSequence($state.data,cls.grade,old.subject,old.stream,old.classId);
 const nextIndex=Number(document.getElementById(`base-${id}`)?.value);
 const fromDate=document.getElementById(`base-week-${id}`)?.value||'';
 if(!Number.isInteger(nextIndex)||nextIndex<0||nextIndex>=seq.length)throw Error('Hãy chọn tiết PPCT hợp lệ.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)||monday(fromDate)!==fromDate)throw Error('Ngày áp dụng phải là Thứ Hai đầu tuần.');
 if(fromDate<old.fromDate)throw Error('Không được chọn trước tuần bắt đầu theo dõi.');
 const lesson=seq[nextIndex];
 if($state.mode!=='google')throw Error('Cần kết nối Google Sheets để lưu mốc PPCT.');
 if(!window.confirm(`Lưu ${className(old.classId)} · ${old.subject} ${old.stream} bắt đầu Tiết ${lesson.period} từ tuần ${fmt(fromDate)}?\nCác tuần trước sẽ giữ nguyên. Tên bài lấy từ PPCT, không chỉnh sửa.`))return;
 const existing=($state.data.baseline_revisions||[]).find(r=>r.baselineId===id&&r.fromDate===fromDate);
 const btn=document.querySelector(`[data-action="save-baseline"][data-id="${CSS.escape(id)}"]`);
 $state.baselineSavingId=id;if(btn){btn.disabled=true;btn.textContent='Đang lưu & xác minh...';}
 try{
  const saved=await callApi({op:'saveBaselineRevision',baselineId:id,fromDate,nextIndex,ppctId:lesson.id,
   expectedBaselineIndex:Number(old.nextIndex),expectedUpdatedAt:existing?.updatedAt||''});
  if(saved.verified!==true)throw Error('Google Sheets chưa xác nhận lưu mốc theo tuần.');
  try{await pullGoogle();}catch(err){throw Error('Đã ghi nhưng chưa đọc lại được: '+err.message);}
  const row=($state.data.baseline_revisions||[]).find(r=>r.baselineId===id&&r.fromDate===fromDate);
  if(!row||Number(row.nextIndex)!==nextIndex||row.ppctId!==lesson.id)throw Error('Dữ liệu tải lại chưa khớp; cần kiểm tra Sheet baseline_revisions.');
  notify(`Đã lưu ${className(old.classId)} – ${old.subject} ${old.stream}, từ tuần ${fmt(fromDate)} bắt đầu T${lesson.period}. Các tuần trước giữ nguyên.`);
 }catch(err){
  const field=document.querySelector(`[data-baseline-id="${CSS.escape(id)}"]`);
  if(field){let error=field.querySelector('.baseline-error');if(!error){error=document.createElement('p');error.className='baseline-error';error.setAttribute('role','alert');field.appendChild(error);}
   error.textContent='Chưa lưu: '+err.message+' Lựa chọn đang hiển thị vẫn được giữ.';}
  console.error('BASELINE_WEEK_SAVE_FAILED',err);
 }finally{$state.baselineSavingId='';const button=document.querySelector(`[data-action="save-baseline"][data-id="${CSS.escape(id)}"]`);if(button){button.disabled=false;button.textContent='Lưu áp dụng từ tuần này';}}
}
function updateBaselineEditor(id){
 const b=$state.data.baselines.find(x=>x.id===id),c=classById($state.data,b?.classId);if(!b||!c)return;
 const seq=ppctSequence($state.data,c.grade,b.subject,b.stream,b.classId),n=Number(document.getElementById(`base-${id}`)?.value);
 const selected=seq[n];
 const preview=document.getElementById(`base-preview-${id}`);
 if(preview)preview.textContent=selected?`Tiết ${selected.period} – ${selected.title}`:'Không tìm thấy bài PPCT';
 const forecast=document.getElementById(`base-forecast-${id}`);
 if(forecast)forecast.textContent='Tiếp theo: '+(seq.slice(n+1,n+3).map(x=>`T${x.period}: ${x.title}`).join(' → ')||'Đã hết chuỗi PPCT');
 // Never change $state.data, PPCT catalog, baseline or Google Sheets on select.
}
function updateBaselineWeek(id){
 const b=$state.data.baselines.find(x=>x.id===id),c=classById($state.data,b?.classId);
 if(!b||!c)return;
 const week=document.getElementById(`base-week-${id}`)?.value;
 const field=document.querySelector(`[data-baseline-id="${CSS.escape(id)}"]`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week||'')||monday(week)!==week||week<b.fromDate){
  if(field){let error=field.querySelector('.baseline-error');if(!error){error=document.createElement('p');error.className='baseline-error';field.appendChild(error);}error.textContent='Hãy chọn Thứ Hai không trước ngày bắt đầu theo dõi.';}
  return;
 }
 field?.querySelector('.baseline-error')?.remove();
 const seq=ppctSequence($state.data,c.grade,b.subject,b.stream,b.classId);
 const rev=($state.data.baseline_revisions||[]).find(x=>x.baselineId===id&&x.fromDate===week);
 const event=eventsForWeek($state.data,week).find(e=>e.kind!=='EXTRA'&&e.classId===b.classId&&e.subject===b.subject&&e.stream===b.stream&&e.ppct);
 const candidate=rev?Number(rev.nextIndex):event?seq.findIndex(x=>x.id===event.ppct.id):Number(effectiveBaseline($state.data,b.classId,b.subject,b.stream,week)?.nextIndex??b.nextIndex);
 const select=document.getElementById(`base-${id}`);
 if(select)select.value=String(Math.max(0,Math.min(seq.length-1,candidate)));
 updateBaselineEditor(id);
 const reference=week<=b.fromDate?seq[Math.max(0,Number(b.nextIndex)||0)]:progressAt($state.data,b.classId,b.subject,b.stream,addDays(week,-1)).next;
 const help=document.getElementById(`base-progress-ref-${id}`);
 if(help)help.textContent='Theo tiến độ trước tuần này: '+(reference?`T${reference.period}: ${reference.title}`:'Chưa có bài kế tiếp');
 const weekHelp=field?.querySelector('.baseline-help');if(weekHelp)weekHelp.textContent=`Các tuần trước ${fmt(week)} không bị thay đổi.`;
}

async function writeOfficial(row,existing,rule=null,reason=''){
 if($state.mode==='google'){
  await callApi({op:'saveOfficialChange',row,expectedUpdatedAt:existing?.updatedAt||'',rule,reason});await pullGoogle();
 }else{
  const arr=$state.data.changes;const i=arr.findIndex(x=>x.id===row.id),old=i>=0?structuredClone(arr[i]):null;
  row.updatedAt=new Date().toISOString();if(i>=0)arr[i]=row;else arr.push(row);
  if(rule){const rs=$state.data.ppct_overrides;const j=rs.findIndex(x=>x.id===rule.id);if(j>=0)rs[j]=rule;else rs.push(rule);}
  $state.data.audit_log.push({id:`AUD-${Date.now()}`,at:new Date().toISOString(),actor:'Lê Hoàng Ngọc Đức',action:'SAVE',entityType:'changes',entityId:row.id,oldValue:JSON.stringify({change:old,rule:null}),newValue:JSON.stringify({change:row,rule}),reason});cacheDemo();
 }
}
async function saveEdit(){
 if($state.mode!=='google')throw Error('Chỉ xem bản lưu. Cần đăng nhập để sửa chính khóa.');
 const {date,shift,period}=$state.edit,get=id=>$('#'+id)?.value;
 const action=get('edit-action'),scope=get('edit-scope')||'following';
 validateOfficialScope(scope,get('edit-pattern'));
 const existing=($state.data.changes||[]).find(x=>x.kind!=='EXTRA'&&x.date===date&&x.shift===shift&&Number(x.period)===Number(period));
 const subject=get('edit-subject'),stream=subject==='Tin'?'TIN':get('edit-stream'),classId=get('edit-class');
 const cls=classById($state.data,classId);
 if(!cls||!cls.subjects.includes(subject))throw Error('Lớp không được phân công môn này');
 const before=eventsForWeek($state.data,monday(date)).filter(e=>e.kind!=='EXTRA'&&e.date===date&&e.shift===shift&&Number(e.period)===Number(period));
 if(action==='ADD'&&before.some(e=>e.status!=='OFF'&&e.changeId!==existing?.id))throw Error('Ô đã có tiết chính khóa');
 if(action!=='ADD'&&!before.some(e=>e.kind==='MAIN'))throw Error('Chỉ điều chỉnh nội dung tiết chính khóa đã có');
 if(action!=='OFF'&&tutoringForWeek($state.data,monday(date)).some(e=>e.date===date&&e.shift===shift&&Number(e.period)===Number(period)))throw Error('Trùng với suất dạy thêm. Chọn thời gian khác');
 const ppctId=get('edit-ppct')||before[0]?.ppct?.id||'';
 const completed=action==='DONE'||(action==='ADD'&&Boolean($('#edit-completed')?.checked))||(action==='EDIT'&&Boolean($('#edit-completed')?.checked));
 if(completed&&!ppctId)throw Error('Tiết đã dạy phải chọn số tiết PPCT để thống kê chính xác');
 const seq=ppctSequence($state.data,cls.grade,subject,stream,classId),chosen=seq.find(p=>p.id===ppctId);
 if(ppctId&&!chosen)throw Error('Số tiết PPCT không thuộc môn/mạch/lớp đã chọn');
 const row={id:existing?.id||`C-${date}-${shift}${period}`,date,shift,period:Number(period),action,classId,subject,stream,kind:action==='ADD'?'MAKEUP':'MAIN',notes:get('edit-notes')||'',ppctId:action==='OFF'?'':ppctId,completed:action==='OFF'?false:completed,updatedAt:existing?.updatedAt||'',scope,titleOverride:get('edit-title')||''};
 const reason=get('edit-reason')||'';
 // Apply the weekly stream rule from NEXT Monday only. It never modifies confirmed historical cells.
 let rule=null;
 if(scope==='future'&&subject==='Toán'){
  const fromDate=addDays(monday(date),7),pattern=validateOfficialScope(scope,get('edit-pattern'));
  const existingRule=($state.data.ppct_overrides||[]).find(r=>r.classId===classId&&r.fromDate===fromDate);
  rule={id:existingRule?.id||`RULE-${classId}-${fromDate}`,classId,subject:'Toán',fromDate,toDate:'',pattern,notes:reason,updatedAt:new Date().toISOString()};
  // Preview next week's schedule. The app checks exact counts at render and safely falls back when counts change.
  const nextWeek=eventsForWeek($state.data,fromDate).filter(e=>e.classId===classId&&e.subject==='Toán'&&e.kind==='MAIN');
  if(nextWeek.length&&pattern.length!==nextWeek.length)throw Error(`Tuần kế tiếp có ${nextWeek.length} tiết Toán; quy tắc vừa nhập có ${pattern.length} tiết`);
  if(nextWeek.length){const ds=nextWeek.filter(e=>e.stream==='ĐS').length,hh=nextWeek.length-ds;if(pattern.filter(x=>x==='ĐS').length!==ds||pattern.filter(x=>x==='HH').length!==hh)throw Error(`Tuần kế tiếp theo PPCT có ${ds} ĐS + ${hh} HH. Hãy nhập đúng số lượng.`);}
 }
 const previous=$state.data.changes||[];
 const duplicated=previous.some(x=>x.id!==existing?.id&&x.classId===classId&&x.subject===subject&&x.stream===stream&&x.ppctId===ppctId&&x.completed&&completed&&ppctId);
 if(duplicated&&!window.confirm(`CẢNH BÁO: PPCT ${chosen?.period} đã được xác nhận ở tiết khác. Tiếp tục lưu nhưng thống kê chỉ tính một lần?`))return;
 const baseline=$state.data.baselines.find(b=>b.classId===classId&&b.subject===subject&&b.stream===stream);
 const idx=seq.findIndex(x=>x.id===ppctId);
 const gap=completed&&baseline?.confirmed&&idx>Number(baseline.nextIndex)+previous.filter(x=>x.classId===classId&&x.subject===subject&&x.stream===stream&&x.completed).length;
 const forecastBefore=eventsForWeek($state.data,addDays(monday(date),7)).filter(e=>e.classId===classId&&e.subject===subject&&e.stream===stream).slice(0,4).map(e=>`T${e.ppct?.period||'—'}`).join(', ');
 const simulation=structuredClone($state.data),oldIndex=simulation.changes.findIndex(x=>x.id===row.id);
 if(oldIndex>=0)simulation.changes[oldIndex]=row;else simulation.changes.push(row);
 if(rule){const i=simulation.ppct_overrides.findIndex(x=>x.id===rule.id);if(i>=0)simulation.ppct_overrides[i]=rule;else simulation.ppct_overrides.push(rule);}
 const forecastAfter=eventsForWeek(simulation,addDays(monday(date),7)).filter(e=>e.classId===classId&&e.subject===subject&&e.stream===stream).slice(0,4).map(e=>`T${e.ppct?.period||'—'}`).join(', ');
 const preview=`XEM TRƯỚC CHỈNH SỬA\nLớp ${className(classId)} · ${subject} ${stream}\n${fmt(date)}, ${shiftLabel(shift)} tiết ${period}\nPPCT: ${chosen?`tiết ${chosen.period} - ${chosen.title}`:'tự xác định'}\nTrạng thái: ${completed?'ĐÃ DẠY':action==='OFF'?'NGHỈ':'DỰ KIẾN'}\nPhạm vi: ${{one:'Chỉ tiết này',following:'Tính lại các tiết dự kiến tiếp theo',future:'Tính lại tiếp theo và ghi nhớ quy tắc từ tuần sau'}[scope]}\nTuần sau trước sửa: ${forecastBefore||'Không có'}\nTuần sau sau sửa: ${forecastAfter||'Không có'}${gap?'\n⚠ Chọn PPCT cách xa mốc đã xác nhận; cần kiểm tra các tiết còn thiếu.':''}\n\nCác tiết đã xác nhận của lớp khác/mạch khác không thay đổi. Xác nhận lưu?`;
 if(!window.confirm(preview))return;
 await writeOfficial(row,existing,rule,reason);$state.edit=null;notify('Đã lưu điều chỉnh và cập nhật đề xuất cho các tiết chưa dạy. Vào Thống kê tiến độ để xem nhanh/chậm.');
}
async function sendExtraMutation(action,row,current,form,extra={}){
 if($state.mode!=='google')throw Error('Google Sheets chưa kết nối. Vui lòng đăng nhập hoặc đồng bộ trước khi lưu.');
 const requestId=form.dataset.requestId||(form.dataset.requestId=newRequestId());
 if($state.mode==='google'){
  if($state.extraServerReady!==true)await probeExtraServer();
  const pending={requestId,action,row,date:row.date,createdAt:new Date().toISOString()};
  localStorage.setItem(PENDING_EXTRA_KEY,JSON.stringify(pending));
  let answer;
  try{
   answer=await callApi({op:'mutateExtra',action,row,entityId:current?.recurring?current.patternId:current?.id||'',date:row?.date||$state.edit.date,
    requestId,expectedRevision:current?.revision||0,expectedOccurrenceRevision:current?.occurrenceRevision||0,...extra});
  }catch(err){
   // Known rejection is final; querying request status cannot repair an incompatible GAS deployment.
   if(['INCOMPATIBLE_GAS','UNSUPPORTED_ACTION','GAS_AUTH_FAILED','INVALID_ORIGIN','AUTH_NOT_CONFIGURED','BACKEND_NOT_CONFIGURED','WRITE_NOT_VERIFIED'].includes(err.code)){
     localStorage.removeItem(PENDING_EXTRA_KEY);throw err;
   }
   // Only a transport error is ambiguous: the server may have committed already.
   const status=await checkPendingExtra();
   if(!status?.verified){throw Error(`Không xác nhận được trạng thái ghi: ${err.message}. Giữ nguyên nội dung; bấm Kiểm tra lại trước khi gửi yêu cầu mới.`);}
   answer={ok:true,verified:true,requestId,entityId:status.entityId,table:status.table||'',recovered:true};
  }
  if(!answer.ok||answer.verified!==true||!answer.entityId)throw Error('Máy chủ chưa xác nhận đầy đủ bản ghi dạy thêm. Kiểm tra đồng bộ trước khi thử lại.');
  try{await pullGoogle();}
  catch(err){throw Error(`Đã ghi vào Google Sheets (${answer.entityId}), nhưng chưa đồng bộ được giao diện: ${err.message}. Không nhập lại suất mới.`);}
  if(!extraOccurrenceVisible(answer,action,row)){
    $state.extraPending={...pending,status:{verified:true,entityId:answer.entityId,state:'COMMITTED'},visible:false};
    throw Error(`Đã ghi vào Google Sheets (${answer.entityId}), nhưng chưa đồng bộ được giao diện. Hãy mở Danh sách lịch đã lưu hoặc Kiểm tra đồng bộ.`);
  }
  localStorage.removeItem(PENDING_EXTRA_KEY);$state.extraPending=null;
  return answer;
 }
 // Preview-only mode. It must never be described as durable Google Sheets storage.
 const data=$state.data,id=current?.patternId||current?.id||`DEMO-${requestId}`;
 if(action==='CREATE'){
  if(row.repeatRule==='once')data.extra_sessions.push({...row,id,action:'EDIT',patternId:'',revision:1});
  else data.extra_patterns.push({...row,id,day:dayNumber(row.date),fromDate:row.date,toDate:row.repeatRule==='until'?row.endDate:'',startLesson:row.lessonNumber,active:true,revision:1});
 }else if(action==='EDIT_ONCE'&&current){
  if(current.recurring){const target=data.extra_sessions.find(x=>x.patternId===current.patternId&&x.date===row.date);const next={...row,id:target?.id||`EXO-${id}-${row.date}`,action:'EDIT',patternId:id};if(target)Object.assign(target,next);else data.extra_sessions.push(next);}
  else Object.assign(data.extra_sessions.find(x=>x.id===id),row);
 }else if(action==='CONVERT_ONCE'&&current&&!current.recurring){data.extra_sessions.find(x=>x.id===id).action='CANCEL';data.extra_patterns.push({...row,id:`DEMO-${requestId}`,day:dayNumber(row.date),fromDate:row.date,toDate:row.repeatRule==='until'?row.endDate:'',startLesson:row.lessonNumber,active:true});}
 else if(action==='EDIT_ALL'&&current?.recurring){Object.assign(data.extra_patterns.find(x=>x.id===id),row);}
 else if(action==='EDIT_FUTURE'&&current?.recurring){const target=data.extra_patterns.find(x=>x.id===id);if(row.date===target.fromDate)Object.assign(target,row);else{target.toDate=addDays(row.date,-1);data.extra_patterns.push({...target,...row,id:`DEMO-${requestId}`,fromDate:row.date,toDate:current.toDate||'',startLesson:row.lessonNumber,active:true});}}
 else if(action==='CANCEL_ONCE'&&current?.recurring)data.extra_sessions.push({...row,id:`EXC-${id}-${row.date}`,patternId:id,action:'CANCEL'});
 else if(action==='STOP_FUTURE'&&current?.recurring){const target=data.extra_patterns.find(x=>x.id===id);if(target.fromDate===row.date)target.active=false;else target.toDate=addDays(row.date,-1);}
 else if(action==='DELETE_SERIES'&&current?.recurring)data.extra_patterns.find(x=>x.id===id).active=false;
 else if(action==='DELETE_ONE'&&current&&!current.recurring)data.extra_sessions.find(x=>x.id===id).action='CANCEL';
 cacheDemo();return {ok:true,entityId:id};
}
async function saveExtra(){
 if($state.mode!=='google')throw Error('Chỉ xem bản lưu. Cần đăng nhập để lưu Dạy thêm.');
 const form=$('#extra-form');if(!form||$state.savingExtra)return;
 const {date,shift,period}=$state.edit;
 const classIds=[...document.querySelectorAll('[data-extra-class]:checked')].map(el=>el.dataset.extraClass);
 const customGroups=parseGroups($('#extra-free-classes')?.value);
 const groups=parseGroups([...classIds,...customGroups]);
 if(!groups.length)throw Error('Hãy chọn hoặc nhập ít nhất một lớp/nhóm dạy thêm.');
 if(groups.length>60)throw Error('Một suất hỗ trợ tối đa 60 lớp/nhóm.');
 const lessonNumber=Number($('#extra-start-lesson')?.value);
 if(!Number.isInteger(lessonNumber)||lessonNumber<1||lessonNumber>9999)throw Error('Số buổi phải từ 1 đến 9999.');
 const startTime=$('#extra-start-time')?.value||'',endTime=$('#extra-end-time')?.value||'';
 if(startTime&&endTime&&startTime>=endTime)throw Error('Giờ kết thúc phải sau giờ bắt đầu.');
 const all=[...eventsForWeek($state.data,monday(date)).filter(e=>e.kind!=='EXTRA'),...tutoringForWeek($state.data,monday(date))];
 const current=tutoringForWeek($state.data,monday(date)).find(e=>e.date===date&&e.shift===shift&&Number(e.period)===Number(period));
 const other=all.filter(e=>e.status!=='OFF'&&e.id!==current?.id&&extraSlotOverlap({date,shift,period,startTime,endTime},e));
 if(other.length&&!window.confirm('⚠ Có '+other.length+' tiết hoặc suất khác trùng thời gian. Hệ thống sẽ giữ nguyên lịch cũ và hiển thị cảnh báo. Vẫn lưu?'))return;
 const repeatRule=current?.recurring?'weekly':$('#extra-frequency')?.value||'weekly';
 const endDate=repeatRule==='until'?$('#extra-end-date')?.value||'':'';
 if(repeatRule==='until'&&(!endDate||endDate<date))throw Error('Hãy chọn ngày kết thúc không trước ngày bắt đầu.');
 const row={date,shift,period:Number(period),subject:$('#extra-subject').value,groups,classIds,customGroups,
  lessonTitle:$('#extra-lesson-title').value.trim(),notes:$('#extra-notes').value.trim(),startTime,endTime,
  repeatRule,endDate,lessonNumber,teachingStatus:$('#extra-teaching-status')?.value||'PLANNED',completed:$('#extra-teaching-status')?.value==='DONE'};
 let action='CREATE';
 if(!current){
  const matches=($state.data.extra_patterns||[]).filter(p=>p.active!==false&&Number(p.day)===dayNumber(date)&&p.shift===shift&&Number(p.period)===Number(period)&&(!p.toDate||p.toDate>=date));
  const existing=matches.find(p=>p.fromDate>date);
  if(existing){
   throw Error(`Suất này đã có lịch lặp bắt đầu ${fmt(existing.fromDate)} (${parseGroups(existing.groups).join(', ')||'chưa có nhóm'}). Không thể tạo thêm lịch lặp chồng thời gian. Hãy mở Danh sách dạy thêm để sửa lịch cũ hoặc chọn Chỉ một tuần.`);
  }
 }
 if(current)action=current.recurring?({one:'EDIT_ONCE',future:'EDIT_FUTURE',all:'EDIT_ALL'}[$('#extra-scope')?.value||'one']):(repeatRule==='once'?'EDIT_ONCE':'CONVERT_ONCE');
 const saveBtn=form.querySelector('[type=submit]'),status=$('#extra-status');
 $state.savingExtra=true;saveBtn.disabled=true;saveBtn.textContent='Đang ghi & xác nhận...';status.textContent='Đang lưu lên máy chủ và kiểm tra bản ghi.';
 try{
  const response=await sendExtraMutation(action,row,current,form);
  $state.edit=null;
  notify(($state.mode==='google'?'✓ Đã lưu và xác nhận trên Google Sheets. ':'⚠ Chỉ lưu thử trên thiết bị này. ')+`Mã: ${response.entityId}. Lịch dạy thêm độc lập PPCT.`);
 }finally{$state.savingExtra=false;if(saveBtn.isConnected){saveBtn.disabled=false;saveBtn.textContent='Lưu suất dạy thêm';}}
}
async function deleteExtra(){
 const form=$('#extra-form')||{dataset:{}},{date,shift,period}=$state.edit;
 const current=tutoringForWeek($state.data,monday(date)).find(e=>e.date===date&&e.shift===shift&&Number(e.period)===Number(period));
 if(!current)throw Error('Không tìm thấy suất học, hãy tải lại dữ liệu.');
 let action;
 if(!current.recurring){action='DELETE_ONE';}
 else{
  const choice=window.prompt('Chọn cách xử lý: 1 = Nghỉ riêng ngày này; 2 = Dừng từ ngày này; 3 = Xóa toàn bộ chuỗi lịch (giữ nhật ký).','1');
  if(choice===null)return;
  action=({'1':'CANCEL_ONCE','2':'STOP_FUTURE','3':'DELETE_SERIES'})[choice];
  if(!action)throw Error('Hãy chọn 1, 2 hoặc 3.');
 }
 if(!window.confirm('Xác nhận: '+({CANCEL_ONCE:'Nghỉ riêng buổi này',STOP_FUTURE:'Dừng lặp từ ngày này',DELETE_SERIES:'Ẩn toàn bộ chuỗi lịch',DELETE_ONE:'Xóa suất chỉ một lần'}[action])+'?'))return;
 const row={date,shift,period,subject:current.subject,groups:parseGroups(current.groups),lessonNumber:current.lessonNumber||1};
 await sendExtraMutation(action,row,current,form);
 $state.edit=null;notify('Đã ghi thay đổi lịch dạy thêm. Lịch chính khóa và PPCT không bị ảnh hưởng.');
}
async function clearEdit(){const {date,shift,period}=$state.edit;const existing=($state.data.changes||[]).find(x=>x.kind!=='EXTRA'&&x.date===date&&x.shift===shift&&x.period===Number(period));if(!existing)return;
 const row={...existing,action:'CLEAR',completed:false,notes:'Đã hủy điều chỉnh',ppctId:'',scope:'one',titleOverride:''};
 if(!window.confirm('Trả ô này về lịch chính khóa gốc? Lịch sử điều chỉnh sẽ được giữ lại.'))return;
 await writeOfficial(row,existing,null,'Hủy điều chỉnh');$state.edit=null;notify('Đã trả ô về lịch gốc, có thể hoàn tác trong lịch sử.');}
async function undoOfficial(id){
 if(!window.confirm('Hoàn tác lần chỉnh sửa gần nhất của ô này?'))return;
 if($state.mode==='google'){await callApi({op:'undoOfficialChange',id});await pullGoogle();}
 else{const log=[...$state.data.audit_log].reverse().find(x=>x.entityId===id);if(!log||log.action!=='SAVE')throw Error('Không có thay đổi để hoàn tác');const old=JSON.parse(log.oldValue),current=$state.data.changes.findIndex(x=>x.id===id);if(current>=0)$state.data.changes.splice(current,1);if(old.change)$state.data.changes.push(old.change);if(JSON.parse(log.newValue).rule){const rule=JSON.parse(log.newValue).rule;$state.data.ppct_overrides=$state.data.ppct_overrides.filter(x=>x.id!==rule.id);if(old.rule)$state.data.ppct_overrides.push(old.rule);}log.action='UNDO';cacheDemo();}
 $state.edit=null;notify('Đã hoàn tác thao tác gần nhất.');}
async function doAction(target){const a=target.dataset.action;if(!a)return;
 // Menu selections close immediately even for async actions such as Sheet refresh.
 if(target.closest('#side-menu') && a!=='toggle-drawer' && a!=='close-drawer'){
  $state.drawerOpen=false;
  document.querySelector('#side-menu')?.classList.remove('drawer-open');
  document.querySelector('.drawer-scrim')?.remove();
  document.body.classList.remove('drawer-active');
 }
 try{
 if(a==='login'){await loginAndSync();$state.edit=null;return render();}
 if(a==='show-cache-login'){$state.edit={type:'login'};return render();}
 if(a==='recheck-session'){await init();if($state.mode==='google'&&$state.view==='extraList')await refreshExtraList();return;}
 if(a==='refresh-app'){location.reload();return;}
 if(a==='verify-release'){
   const version=await serverRequest('/api/tkb?action=version');
   const session=await getSession();
   if(!session.authenticated)throw Object.assign(new Error('Cần đăng nhập trên thiết bị này để kiểm tra Apps Script.'),{code:'UNAUTHENTICATED'});
   const probe=await probeExtraServer();
   const matches=version.apiVersion===(probe.gasVersion||probe.apiVersion)&&$state.mainServerReady;
   const label=`Web ${FRONTEND_VERSION} / API ${version.apiVersion} / GAS ${probe.gasVersion||probe.apiVersion||'?'}`;
   const commit=version.commit||'?';
   return notify((matches?'✓ API và Apps Script tương thích, hỗ trợ lưu TKB; Web sử dụng bản tối ưu giao diện. ':'⚠ API và GAS chưa đồng bộ; cần cập nhật Apps Script (bút chì → Phiên bản mới) và Vercel. ')+label+` · Commit ${commit} · Sheet ${$state.extraSourceSheet||'?'} (...${$state.extraSourceTail||'?'})`);
 }
 if(a==='diagnose-system'){const previous=$state.apiVersion;const session=await getSession();if(!session.authenticated)throw Object.assign(new Error('Phiên không hợp lệ, đăng nhập lại.'),{code:session.code||'UNAUTHENTICATED'});await pullGoogle();const details=`Frontend ${FRONTEND_VERSION}, API ${$state.apiVersion}, Apps Script ${$state.extraServerVersion||'chưa kiểm tra'}; ${$state.data.extra_patterns.length} lịch lặp và ${$state.data.extra_sessions.length} ngoại lệ.`;return notify('Đã kiểm tra: '+details+(previous&&previous!==$state.apiVersion?' Phiên bản API đã đổi.':''));}
 if(a==='refresh-google'){
  if($state.mode!=='google')throw Error('Ứng dụng đang ở chế độ dùng thử, không phải Google Sheets. Vào Cấu hình & dữ liệu để đăng nhập máy chủ Production.');
  await pullGoogle();
  const count=eventsForWeek($state.data,$state.week).length;
  return notify(`Đồng bộ thành công: ${$state.data.slots.length} tiết gốc, tuần 10 hiển thị ${count} tiết. ${count===0?'Cần kiểm tra phiên bản hoặc định dạng dữ liệu.':''}`);
 }
 if(a==='toggle-drawer'){$state.drawerOpen=!$state.drawerOpen;return render();}
 if(a==='close-drawer'){$state.drawerOpen=false;return render();}
 if(a==='reset-filters'){$state.filterClass='all';$state.filterShift='all';$state.filterSubject='all';$state.filterStream='all';$state.drawerOpen=false;return render();}
 if(a==='fit-week'){$state.fitWeek=!$state.fitWeek;localStorage.setItem('smart-tkb-focus-v14',$state.fitWeek?'on':'off');return render();}
 if(a==='fullscreen-week'){if(!document.fullscreenElement){await document.documentElement.requestFullscreen?.();try{await screen.orientation?.lock?.('landscape')}catch{}}else{await document.exitFullscreen?.();}return fitWeekTable();}
 if(a==='cycle-calendar-view'){$state.view=$state.view==='overview'?'calendar':$state.view==='calendar'?'extra':'overview';$state.drawerOpen=false;$state.calendarLayout='week';return render();}
 if(a==='layout-week'){$state.calendarLayout='week';$state.drawerOpen=false;return render();}
 if(a==='layout-day'){$state.calendarLayout='day';$state.drawerOpen=false;return render();}
 if(a==='select-day'){$state.dayIndex=Number(target.dataset.day);return render();}
 if(a==='prev-day'||a==='next-day'){$state.dayIndex=$state.dayIndex+(a==='prev-day'?-1:1);if($state.dayIndex<2){$state.week=addDays($state.week,-7);$state.dayIndex=8;}if($state.dayIndex>8){$state.week=addDays($state.week,7);$state.dayIndex=2;}return render();}
 if(a==='clear-notice'){$state.notice='';return render();}
 if(a==='open-settings'){$state.view='settings';return render();}
 if($state.mode==='cached'&&['delete-extra','save-baseline','save-version','clear-change','undo-official','bootstrap','prepare-version','parse-excel','remove-draft-slot'].includes(a))throw Error('Chỉ được xem bản lưu. Hãy đăng nhập để chỉnh sửa.');
 if(a==='prev-week'||a==='next-week'){$state.week=addDays($state.week,a==='prev-week'?-7:7);return render();}
 if(a==='today'){$state.week=monday(new Date().toISOString().slice(0,10));return render();}
 if(a==='start-main-add'){if($state.mode!=='google')throw Error('Cần đăng nhập để thêm tiết cố định');$state.edit={type:'addMain',date:target.dataset.date,shift:target.dataset.shift,period:Number(target.dataset.period),sourceSlotId:'',requestId:newRequestId()};return render();}
 if(a==='start-move'){if($state.mode!=='google')throw Error('Cần đăng nhập Google Sheets để sửa tiết');$state.edit={type:'move',date:target.dataset.date,sourceSlotId:target.dataset.id,requestId:newRequestId()};return render();}
 if(a==='start-delete-main'){if($state.mode!=='google')throw Error('Cần đăng nhập Google Sheets để xóa tiết');$state.edit={type:'deleteMain',date:target.dataset.date,sourceSlotId:target.dataset.id,requestId:newRequestId()};return render();}
 if(a==='confirm-delete-main')return await saveMainDelete();
 if(a==='copy-main'){
  const event=chosenMainEvent(target.dataset.date,target.dataset.id);
  if(!event)throw Error('Không tìm thấy đúng tiết muốn sao chép');
  $state.clipboardMain={classId:event.classId,subject:event.subject,stream:event.subject==='Tin'?'TIN':event.stream||'',sourceDate:event.date};
  $state.edit=null;return notify(`📋 Đã sao chép ${event.subject} ${className(event.classId)}. Chạm vào ô đích để dán; tiết nguồn được giữ nguyên.`);
 }
 if(a==='cancel-copy-main'){$state.clipboardMain=null;return render();}
 if(a==='start-paste-main'){
  if($state.mode!=='google')throw Error('Cần đăng nhập để dán tiết');
  if(!$state.clipboardMain)throw Error('Chưa sao chép tiết học');
  $state.edit={type:'pasteMain',date:target.dataset.date,shift:target.dataset.shift,period:Number(target.dataset.period),sourceSlotId:'',requestId:newRequestId()};return render();
 }
 if(a==='open-cell'){const date=target.dataset.date,shift=target.dataset.shift,period=Number(target.dataset.period),editor=target.dataset.editor||'official';
 const same=eventsForWeek($state.data,monday(date)).filter(x=>x.kind==='MAIN'&&x.date===date&&x.shift===shift&&Number(x.period)===period);
 $state.edit={date,shift,period,type:editor==='official'&&same.length>1?'conflict':editor};return render();}
 if(a==='close-modal'){$state.edit=null;return render();}
 if(a==='choose-extra'){if($state.mode!=='google')throw Error('Cần đăng nhập để thêm Dạy thêm');$state.edit.type='extra';return render();}
 if(a==='choose-official'){if($state.mode!=='google')throw Error('Cần đăng nhập để chỉnh sửa Chính khóa');$state.edit.type='official';return render();}
 if(a==='delete-extra')return await deleteExtra();
 if(a==='print')return window.print();
 if(a==='export')return exportCsv();
 if(a==='open-extra-list'){$state.view='extraList';await refreshExtraList();return;}
 if(a==='refresh-extra-list'){if($state.mode!=='google')return await init();await refreshExtraList();return;}
 if(['quick-extra-status','clone-extra-next','remove-extra-card'].includes(a)){
  if($state.mode!=='google')throw Error('Cần đăng nhập Google Sheets để chỉnh sửa');
  const date=target.dataset.date;
  const current=tutoringForWeek($state.data,monday(date)).find(x=>x.id===target.dataset.id&&x.date===date);
  if(!current)throw Error('Không còn ca dạy này trong dữ liệu, vui lòng đồng bộ');
  if(a==='remove-extra-card'){$state.view='extra';$state.week=monday(date);$state.edit={date,shift:current.shift,period:Number(current.period),type:'extra'};return await deleteExtra();}
  const nextDate=a==='clone-extra-next'?addDays(date,7):date;
  if(a==='clone-extra-next'&&tutoringForWeek($state.data,monday(nextDate)).some(x=>x.date===nextDate&&x.shift===current.shift&&Number(x.period)===Number(current.period)))throw Error('Tuần sau đã có lịch tại vị trí này. Hãy mở lịch tuần sau để sửa ca có sẵn, tránh tạo trùng.');
  const status=a==='clone-extra-next'?'PLANNED':target.dataset.status;
  if(status===current.status&&a!=='clone-extra-next')return;
  const row={date:nextDate,shift:current.shift,period:Number(current.period),subject:current.subject,
   groups:parseGroups(current.groups),classIds:parseGroups(current.classIds),customGroups:parseGroups(current.customGroups),
   lessonTitle:current.lessonTitle||'',notes:current.notes||'',startTime:current.startTime||'',endTime:current.endTime||'',
   lessonNumber:a==='clone-extra-next'?Number(current.lessonNumber||1)+1:Number(current.lessonNumber||1),repeatRule:'once',
   teachingStatus:status,completed:status==='DONE'};
  const action=a==='clone-extra-next'?'CREATE':'EDIT_ONCE';
  await sendExtraMutation(action,row,a==='clone-extra-next'?null:current,{dataset:{}});
  if(a==='clone-extra-next')$state.week=monday(nextDate);
  return notify(a==='clone-extra-next'?'Đã nhân bản buổi dạy sang tuần sau.':'Đã cập nhật trạng thái dạy thêm; số liệu đã đồng bộ lại.');
 }
 if(a==='open-saved-extra'){if($state.mode!=='google')throw Error('Đang xem bản lưu: cần đăng nhập trước khi chỉnh sửa');$state.view='extra';$state.week=monday(target.dataset.date);$state.edit={type:'extra',date:target.dataset.date,shift:target.dataset.shift,period:Number(target.dataset.period)};return render();}
 if(a==='diagnose-sync'){
  if($state.mode!=='google')throw Error('Chưa kết nối Google Sheets');
  await probeExtraServer();const r=await callApi({op:'listExtra',week:$state.week});
  const data=normalizeSheetData({extra_patterns:r.patterns,extra_sessions:r.sessions});
  $state.syncDiagnostics={...r,weekCount:tutoringForWeek(data,$state.week).length,readAt:new Date().toISOString()};
  await checkPendingExtra();return render();
 }
 if(a==='check-pending-extra'){await pullGoogle();await checkPendingExtra();return notify($state.extraPending?'Yêu cầu đã ghi hoặc đang chờ xác minh; kiểm tra chi tiết trên danh sách dạy thêm.':'Đã đồng bộ xong yêu cầu dạy thêm.');}
 if(a==='probe-extra'){if($state.mode!=='google')throw Error('Hãy kết nối Google Sheets trước.');await probeExtraServer();return notify(`✓ Apps Script ${$state.extraServerVersion} đã hỗ trợ lưu dạy thêm. Có thể nhập và chỉnh sửa suất.`);}
 if(a==='diagnose-extra'){if($state.mode!=='google')throw Error('Chưa kết nối Google Sheets');const r=await callApi({op:'diagnoseExtra'});return notify(`Google Sheets đang lưu ${r.patternCount} mẫu dạy thêm lặp và ${r.sessionCount} buổi/ngoại lệ. Yêu cầu ghi nhận: ${r.requestCount}.`);}
 if(a==='backup')return saveFile(`SmartTKB_sao_luu_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify($state.data,null,2),'application/json');
 if(a==='save-baseline')return await saveBaseline(target.dataset.id);
 if(a==='save-math-rule'){
  if($state.mode!=='google')throw Error('Cần kết nối Google Sheets');
  const id=target.dataset.class,value=$('#math-rule-'+id)?.value||'';
  const rule=$state.data.ppct_overrides.find(x=>x.classId===id&&x.fromDate===$state.week);
  const next={id:rule?.id||`MATH-${id}-${$state.week}`,classId:id,subject:'Toán',fromDate:$state.week,toDate:'',pattern:value?value.split(','):[],notes:value?'Giáo viên chọn mẫu phân môn':'Theo PPCT',updatedAt:new Date().toISOString()};
  // Empty pattern means inherit PPCT; do not write an invalid backend rule.
  if(!value)throw Error('Hãy chọn mẫu 2Đ–2H hoặc 3Đ–1H. Mẫu PPCT là chế độ mặc định khi chưa đặt quy tắc.');
  if(!window.confirm('Áp dụng cách phân môn từ tuần '+schoolWeek($state.week)+'? Chỉ phân bổ tiết dự kiến; lịch sử xác nhận đã dạy vẫn được giữ.'))return;
  await persist('ppct_overrides',next);
  return notify('Đã lưu mẫu Toán '+className(id)+' trên Google Sheets từ tuần '+schoolWeek($state.week)+'.');
 }
 if(a==='prepare-version')return await prepareDraft();
 if(a==='parse-excel')return await importExcel();
 if(a==='discard-version'){$state.pendingImport=null;return render();}
 if(a==='remove-draft-slot'){$state.pendingImport.slots=$state.pendingImport.slots.filter(s=>s.id!==target.dataset.id);return render();}
 if(a==='save-version')return await confirmDraft();
 if(a==='clear-change')return await clearEdit();
 if(a==='undo-official')return await undoOfficial(target.dataset.id);
 if(a==='export-statistics')return exportStatistics();
 
 if(a==='logout'){await callApi({op:'logout'});localStorage.removeItem(SNAPSHOT_KEY);location.reload();return;}
 if(a==='clear-local-snapshot'){if(!window.confirm('Xóa cache TKB trên thiết bị này? Không xóa PPCT và lịch sử trên Google Sheets.'))return;localStorage.removeItem(SNAPSHOT_KEY);localStorage.removeItem('smart-tkb-demo-v1');localStorage.removeItem(PENDING_EXTRA_KEY);return notify('Đã xóa cache trên thiết bị. Google Sheets và toàn bộ PPCT được giữ nguyên.');}
 if(a==='bootstrap'){if($state.mode!=='google')throw Error('Chưa kết nối Google');if(!window.confirm('Chỉ khởi tạo trên Google Sheets mới trống. Dữ liệu hiện có sẽ không được ghi đè. Tiếp tục?'))return;const seed=await fetch('/seed.json').then(r=>r.json());await callApi({op:'bootstrap',seed});await pullGoogle();return notify('Đã khởi tạo đầy đủ lớp, lịch và PPCT trên Google Sheets.');}
 }catch(e){console.error(e.code||'ACTION_ERROR',e.message);if($state.mode==='unauthenticated'||$state.mode==='connection-error'){ $state.authError=e.message;render();}else notify('Lỗi: '+e.message);}
}
document.addEventListener('click',e=>{
 const target=e.target.closest('[data-view], [data-action]');if(!target)return;
 if(target.dataset.view){$state.view=target.dataset.view;$state.drawerOpen=false;$state.notice='';if($state.view==='calendar')$state.filterShift='all';render();if($state.view==='extraList'&&$state.mode==='google')refreshExtraList().catch(err=>notify('Không tải được danh sách: '+err.message));return;}
 // backdrop click only when clicking backdrop itself, not its descendants
 if(target.classList.contains('backdrop')&&e.target!==target)return;
 doAction(target);
});
// Accessible mobile drawer: edge-swipe to open, left-swipe to close, Escape to dismiss.
let drawerTouchStart=null;
document.addEventListener('touchstart',e=>{
 if(window.innerWidth>760||$state.edit||e.touches.length!==1)return;
 const touch=e.touches[0];
 if((!$state.drawerOpen&&touch.clientX<=26)||($state.drawerOpen&&touch.clientX<=340))drawerTouchStart={x:touch.clientX,y:touch.clientY,opened:$state.drawerOpen};
 else drawerTouchStart=null;
},{passive:true});
document.addEventListener('touchend',e=>{
 if(!drawerTouchStart||e.changedTouches.length!==1)return;
 const delta=e.changedTouches[0].clientX-drawerTouchStart.x;
 const v=Math.abs(e.changedTouches[0].clientY-drawerTouchStart.y);
 if(Math.abs(delta)>65&&Math.abs(delta)>v*1.4){
  if(!drawerTouchStart.opened&&delta>0){$state.drawerOpen=true;render();}
  if(drawerTouchStart.opened&&delta<0){$state.drawerOpen=false;render();}
 }
 drawerTouchStart=null;
},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$state.drawerOpen){$state.drawerOpen=false;render();}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='login-pass'){e.preventDefault();loginAndSync().catch(err=>{$state.authError=err.message;$state.lastApiError=err.code||'';render();});}});
document.addEventListener('change',e=>{
 if(e.target.id?.startsWith('base-week-')){updateBaselineWeek(e.target.id.slice(10));return;}
 if(e.target.id?.startsWith('base-')){updateBaselineEditor(e.target.id.slice(5));return;}
 const table={'f-class':'filterClass','f-shift':'filterShift','f-subject':'filterSubject','f-kind':'filterKind','f-stream':'filterStream','ppct-grade':'ppctGrade','ppct-subject':'ppctSubject','ppct-stream':'ppctStream','stats-class':'statsClass','stats-subject':'statsSubject','stats-stream':'statsStream','stats-date':'statsDate','stats-period':'statsPeriod'};
 if(table[e.target.id]){$state[table[e.target.id]]=e.target.value;if(e.target.id.startsWith('f-'))$state.drawerOpen=false;render();}
 const drawerStats={'drawer-stats-period':'statsPeriod','drawer-stats-date':'statsDate','drawer-stats-class':'statsClass','drawer-stats-subject':'statsSubject','drawer-stats-stream':'statsStream'};
 const drawerExtra={'drawer-extra-grade':'extraGrade','drawer-extra-letter':'extraLetter','drawer-extra-period':'extraPeriod','drawer-extra-day':'extraDay','drawer-extra-shift':'extraShift'};
 if(drawerStats[e.target.id]||drawerExtra[e.target.id]){$state[drawerStats[e.target.id]||drawerExtra[e.target.id]]=e.target.value;$state.drawerOpen=false;render();return;}
 if(e.target.id==='extra-period'){$state.extraPeriod=e.target.value;return render();}
 if(e.target.id==='extra-day'){$state.extraDay=e.target.value;return render();}
 if(e.target.id==='extra-shift'){$state.extraShift=e.target.value;return render();}
 if(['move-class','move-subject','move-shift'].includes(e.target.id))updateMainFormUI(e.target.id);
 if(e.target.closest('#extra-form')){delete e.target.form.dataset.requestId;updateExtraFormUI();}
 if(e.target.id==='extra-frequency')updateExtraFormUI();
 if(e.target.id==='only-extra'){$state.onlyExtra=e.target.checked;$state.drawerOpen=false;render();}
 if(['edit-action','edit-kind','edit-scope'].includes(e.target.id))updateEditorFields();
 if(e.target.id==='edit-class'||e.target.id==='edit-subject'||e.target.id==='edit-stream'){
  // The next render refreshes PPCT choices for the selected class/subject/stream; preserve edited selections.
  const classId=$('#edit-class').value,subject=$('#edit-subject').value,stream=subject==='Tin'?'TIN':$('#edit-stream').value;
  const cls=classById($state.data,classId),seq=ppctSequence($state.data,cls?.grade,subject,stream,classId);
  const dropdown=$('#edit-ppct');dropdown.innerHTML='<option value="">Tự đề xuất theo tiến độ</option>'+seq.map(p=>`<option value="${esc(p.id)}">Tiết ${p.period}: ${esc(p.title)}</option>`).join('');
 }
});
document.addEventListener('input',e=>{if(e.target.closest('#extra-form')){delete e.target.form.dataset.requestId;updateExtraFormUI();}if(['extra-list-search','drawer-extra-list-search'].includes(e.target.id)){$state.extraListQuery=e.target.value;const id=e.target.id;const pos=e.target.selectionStart;render();const input=$('#'+id);input?.focus();input?.setSelectionRange(pos,pos);}if(e.target.id==='ppct-query'){$state.ppctQuery=e.target.value;const pos=e.target.selectionStart;render();const input=$('#ppct-query');input?.focus();input?.setSelectionRange(pos,pos);}});
document.addEventListener('submit',async e=>{if(!['edit-form','extra-form','move-form'].includes(e.target.id))return;e.preventDefault();try{if(e.target.id==='extra-form')await saveExtra();else if(e.target.id==='move-form')await saveMove();else await saveEdit();}catch(err){console.error(err);if(e.target.id==='extra-form'){const box=$('#extra-error');if(box){box.hidden=false;box.textContent='Không thể lưu dạy thêm'+(err.code?' ['+err.code+']':'')+': '+err.message+' (Web '+FRONTEND_VERSION+' / API '+($state.apiVersion||'?')+' / GAS '+($state.extraServerVersion||'?')+').';}const state=$('#extra-status');if(state)state.textContent='Nội dung thầy vừa nhập vẫn được giữ nguyên để sửa hoặc thử lại.';}else if(e.target.id==='move-form'){const box=$('#main-error');if(box){box.hidden=false;box.textContent='Không lưu được: '+err.message+' (Web '+FRONTEND_VERSION+', API '+($state.apiVersion||'?')+'). Nội dung đã nhập được giữ nguyên.';}else notify('Lỗi: '+err.message);}else notify('Lỗi: '+err.message);}});
init().catch(err=>{$('#app').innerHTML=`<p class="fatal">Không khởi động được ứng dụng: ${esc(err.message)}</p>`;});

// V1.7.3: selectors are delegated so they survive rerenders.
document.addEventListener('click',e=>{
 const grade=e.target.closest('[data-extra-grade]');if(grade){$state.extraGrade=grade.dataset.extraGrade;$state.drawerOpen=false;render();return;}
 const letter=e.target.closest('[data-extra-letter]');if(letter){$state.extraLetter=letter.dataset.extraLetter;$state.drawerOpen=false;render();return;}
 const pick=e.target.closest('[data-pick-grade]');if(pick){$state.extraPickerGrade=Number(pick.dataset.pickGrade);document.querySelectorAll('[data-pick-grade]').forEach(b=>{b.classList.toggle('primary',Number(b.dataset.pickGrade)===$state.extraPickerGrade);b.classList.toggle('soft',Number(b.dataset.pickGrade)!==$state.extraPickerGrade);});document.querySelectorAll('[data-pick-letter]').forEach(b=>b.textContent=`${$state.extraPickerGrade}${b.dataset.pickLetter}`);return;}
 const chosen=e.target.closest('[data-pick-letter]');if(chosen){const id=`${$state.extraPickerGrade}${chosen.dataset.pickLetter}`;const input=[...document.querySelectorAll('[data-extra-class]')].find(x=>x.dataset.extraClass===id);if(input){input.checked=!input.checked;updateExtraFormUI();}return;}
});
document.addEventListener('change',e=>{if(e.target.id==='extra-period'){$state.extraPeriod=e.target.value;render();}});
