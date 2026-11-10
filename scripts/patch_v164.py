from pathlib import Path
p=Path('/mnt/data/tkb_v164_work')
core=p/'src/core.js'; main=p/'src/main.js'; api=p/'api/_auth.js'; gas=p/'gas/Code.gs'
def rep(text,old,new,name):
    if old not in text:raise Exception('Missing '+name+' : '+old[:90])
    return text.replace(old,new,1)
s=core.read_text()
s=rep(s,"out.changes.forEach(x=>{x.date=toIso(x.date);x.period=Number(x.period);", "out.changes.forEach(x=>{x.date=toIso(x.date);x.moveDate=toIso(x.moveDate);x.movePeriod=x.movePeriod?Number(x.movePeriod):0;x.period=Number(x.period);",'change normalization')
start=s.index('export function scheduleForDate(');end=s.index('export function conflicts(',start)
s=s[:start]+'''export function scheduleForDate(state,date){
 const ver=activeVersion(state,date);
 const day=dayNumber(date);
 const base=ver&&schoolWeek(date)!==0?(state.slots||[]).filter(x=>String(x.versionId).trim()===String(ver.id).trim()&&Number(x.day)===day).map(s=>({...s,date,changeId:'',status:'PLANNED'})):[];
 // A MOVE selects an exact original slot id, not an arbitrary occupant of a conflicting cell.
 // Keep the original TKB version untouched: moving a single occurrence must not shift the following weeks.
 const sourceMoves=(state.changes||[]).filter(ch=>ch.action==='MOVE'&&ch.date===date);
 for(const mv of sourceMoves){const ix=base.findIndex(x=>x.id===mv.sourceSlotId);if(ix>=0)base.splice(ix,1);}
 for(const ch of (state.changes||[]).filter(x=>x.date===date&&x.action!=='MOVE')){
  const index=base.findIndex(x=>x.shift===ch.shift&&Number(x.period)===Number(ch.period)&&(!ch.sourceSlotId||x.id===ch.sourceSlotId));
  if(ch.action==='CLEAR')continue;
  if(ch.action==='OFF'||ch.action==='DONE'||ch.action==='EDIT'){
   if(index>=0){const was=base[index];base[index]={...was,...(ch.action==='EDIT'?{classId:ch.classId||was.classId,subject:ch.subject||was.subject,stream:ch.stream||was.stream}:{}),status:ch.action==='OFF'?'OFF':(ch.action==='DONE'||ch.completed)?'DONE':'PLANNED',notes:ch.notes||was.notes,ppctId:ch.ppctId||'',scope:ch.scope||'following',titleOverride:ch.titleOverride||'',changeId:ch.id};}
  }else if(ch.action==='ADD'){
   base.push({id:ch.id,versionId:ver?.id||'',date,day,shift:ch.shift,period:Number(ch.period),classId:ch.classId,subject:ch.subject,stream:ch.stream||'',kind:ch.kind||'MAKEUP',notes:ch.notes||'',status:ch.completed?'DONE':'PLANNED',ppctId:ch.ppctId||'',scope:ch.scope||'following',titleOverride:ch.titleOverride||'',changeId:ch.id});
  }
 }
 for(const mv of (state.changes||[]).filter(x=>x.action==='MOVE'&&x.moveDate===date)){
  const sourceVersion=activeVersion(state,mv.date);
  const slot=(state.slots||[]).find(x=>x.id===mv.sourceSlotId&&x.versionId===sourceVersion?.id);
  if(slot)base.push({...slot,id:slot.id+'@'+date,date,day,shift:mv.moveShift,period:Number(mv.movePeriod),changeId:mv.id,kind:'MAIN',status:'PLANNED',notes:mv.notes||slot.notes||'',originalSlotId:slot.id});
 }
 return base.sort((a,b)=>'SCT'.indexOf(a.shift)-'SCT'.indexOf(b.shift)||a.period-b.period);
}
''' + s[end:]
s+='''\n/** Prepare an unambiguous one-off MOVE without touching PPCT progress. */
export function moveCollision(state,sourceSlotId,sourceDate,targetDate,targetShift,targetPeriod){
 const ver=activeVersion(state,sourceDate);
 const slot=(state.slots||[]).find(x=>x.id===sourceSlotId&&x.versionId===ver?.id);
 if(!slot)throw Error('Không tìm thấy tiết chính khóa trong phiên bản đang áp dụng');
 if(dayNumber(sourceDate)!==Number(slot.day))throw Error('Ngày nguồn không thuộc tiết đã chọn');
 if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(targetDate)||!['S','C','T'].includes(targetShift)||!Number.isInteger(Number(targetPeriod))||Number(targetPeriod)<1||Number(targetPeriod)>(targetShift==='T'?2:5))throw Error('Vị trí đích không hợp lệ');
 if(targetDate===sourceDate&&targetShift===slot.shift&&Number(targetPeriod)===Number(slot.period))throw Error('Chưa thay đổi vị trí');
 const used=[...eventsForWeek(state,monday(targetDate)).filter(e=>e.kind!=='EXTRA'),...tutoringForWeek(state,monday(targetDate))];
 if(used.some(e=>e.date===targetDate&&e.shift===targetShift&&Number(e.period)===Number(targetPeriod)&&e.status!=='OFF'))throw Error('Ô đích đã có tiết; hãy chọn một ô trống');
 return {id:`MOVE-${sourceDate}-${sourceSlotId}`,date:sourceDate,shift:slot.shift,period:Number(slot.period),action:'MOVE',classId:slot.classId,subject:slot.subject,stream:slot.stream||'ĐS',kind:'MAIN',notes:'Dời một tiết bị trùng lịch',ppctId:'',completed:false,updatedAt:'',scope:'one',titleOverride:'',sourceSlotId,moveDate:targetDate,moveShift:targetShift,movePeriod:Number(targetPeriod)};
}
export function validateOfficialScope(scope, pattern){
 if(!['one','following','future'].includes(scope))throw Error('Phạm vi điều chỉnh không hợp lệ');
 if(scope!=='future')return [];
 const parsed=parseStreamPattern(pattern);
 if(!parsed.length)throw Error('Chọn C cần nhập mẫu ĐS/HH, ví dụ ĐS,ĐS,HH,ĐS');
 return parsed;
}
'''
core.write_text(s)

s=api.read_text().replace("export const API_VERSION = '1.6.3';","export const API_VERSION = '1.6.4';")
api.write_text(s)

s=main.read_text()
s=rep(s,"import {extractTeacherSchedule} from './importExcel.js';","import {extractTeacherSchedule} from './importExcel.js';\nimport {SNAPSHOT_KEY,validateSnapshot,snapshotText} from './cache.js';\nimport {moveCollision,validateOfficialScope} from './core.js';",'imports')
s=s.replace("const FRONTEND_VERSION='1.6.3';","const FRONTEND_VERSION='1.6.4';")
s=rep(s,"const PENDING_EXTRA_KEY='smart-tkb-extra-pending-v162';", "const PENDING_EXTRA_KEY='smart-tkb-extra-pending-v162';\nconst getSnapshot=()=>{try{return validateSnapshot(localStorage.getItem(SNAPSHOT_KEY));}catch{return null;}};\nfunction writeSnapshot(data){try{localStorage.setItem(SNAPSHOT_KEY,snapshotText(data));}catch(e){console.warn('Không lưu được bộ nhớ đệm, ứng dụng vẫn dùng dữ liệu trực tuyến.');}}",'cache helpers')
s=rep(s,"updateAvailable:false};", "updateAvailable:false,syncState:'idle',snapshotAt:'',cacheLoginRequired:false};",'state')
s=rep(s,"if(response.status===401){$state.mode='unauthenticated';$state.sessionStatus='expired';$state.sessionCode=code;$state.loggedIn=false;$state.extraList=null;$state.authError=err.message;}","if(response.status===401){$state.mode=$state.data?'cached':'unauthenticated';$state.sessionStatus='expired';$state.cacheLoginRequired=true;$state.sessionCode=code;$state.loggedIn=false;$state.extraList=null;$state.authError=err.message;}",'apiError cache')
s=rep(s,"$state.remoteError='';$state.authError='';$state.extraList=null;$state.lastSyncedAt=new Date().toISOString();\n try{await probeExtraServer();}catch(e){console.warn('Lưu dạy thêm chưa sẵn sàng:',e.code||'BACKEND_NOT_READY');}", "$state.remoteError='';$state.authError='';$state.extraList=null;$state.lastSyncedAt=new Date().toISOString();$state.snapshotAt=$state.lastSyncedAt;$state.syncState='synced';$state.cacheLoginRequired=false;writeSnapshot($state.data);render();\n // The timetable has already rendered. Capability probing must never block the screen.\n probeExtraServer().then(()=>render()).catch(e=>{console.warn('Lưu dạy thêm chưa sẵn sàng:',e.code||'BACKEND_NOT_READY');render();});",'pullGoogle cache')
start=s.index('async function init(){');end=s.index('function connectionPage(){',start)
s=s[:start]+'''async function init(){
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
''' +s[end:]
s=rep(s,"const ready=$state.mode==='google';const data=$state.extraList;", "const ready=$state.mode==='google';const data=$state.extraList||($state.mode==='cached'?{patterns:$state.data?.extra_patterns||[],sessions:$state.data?.extra_sessions||[],readAt:$state.snapshotAt}:null);",'extra list cached')
s=rep(s,"if($state.mode!=='google'){document.body.classList.remove('week-focus');$('#app').innerHTML=connectionPage();return;}","if(!['google','cached'].includes($state.mode)){document.body.classList.remove('week-focus');$('#app').innerHTML=connectionPage();return;}",'render cached')
s=rep(s,"$('#app').innerHTML=showTop()+modal();", "$('#app').innerHTML=showTop()+modal();",'render placeholder')
# Immediate trusted snapshot + badge
s=rep(s,"<div class=\"topright\"><span class=\"pill ${$state.mode==='google'?'good':'muted'}\">${$state.mode==='google'?'● Google Sheets':'○ Chế độ dùng thử'}</span>", "<div class=\"topright\"><span class=\"pill ${$state.mode==='google'?'good':'muted'}\">${$state.mode==='google'?'● Google Sheets':$state.syncState==='login-required'?'🔒 Bản lưu · cần đăng nhập':$state.syncState==='error'?'⚠ Bản lưu · lỗi đồng bộ':'◌ Bản lưu · đang đồng bộ Sheet...'}</span>", 'topbar status')
s=rep(s,"${$state.extraPending?`<div class=\"pending-sync\">", "${$state.mode==='cached'?`<div class=\"cache-notice\" role=\"status\"><strong>📋 Đang xem bản lưu gần nhất (${esc($state.snapshotAt?new Date($state.snapshotAt).toLocaleString('vi-VN'):'không rõ')})</strong> · ${esc($state.syncState==='checking'||$state.syncState==='syncing'?'Đang kiểm tra và đồng bộ Sheet...':$state.authError||'Chưa đồng bộ được')} <button class=\"btn soft\" data-action=\"${$state.cacheLoginRequired?'show-cache-login':'recheck-session'}\">${$state.cacheLoginRequired?'Đăng nhập để đồng bộ':'Thử lại'}</button></div>`:''}\n ${$state.extraPending?`<div class=\"pending-sync\">", 'cache banner')
s=rep(s,"if(!$state.edit)return '';", "if(!$state.edit)return '';\n if($state.edit.type==='login')return `<div class=\"backdrop\"><section class=\"modal cache-login\" role=\"dialog\" aria-modal=\"true\"><div class=\"modalhead\"><h3>Đăng nhập để đồng bộ Google Sheets</h3><button class=\"icon-btn\" data-action=\"close-modal\">×</button></div><p>Bản TKB đang hiển thị chỉ để xem. Dữ liệu mới chỉ được đọc sau khi đăng nhập hợp lệ.</p><label for=\"login-pass\">Mật khẩu Smart TKB</label><input id=\"login-pass\" type=\"password\" autocomplete=\"current-password\"/><button class=\"btn primary\" data-action=\"login\">Đăng nhập và đồng bộ</button></section></div>`;",'modal login')
s=rep(s,"if(a==='login'){await loginAndSync();return;}", "if(a==='login'){await loginAndSync();$state.edit=null;return;}\n if(a==='show-cache-login'){$state.edit={type:'login'};return render();}", 'doAction login')
s=rep(s,"if(a==='logout'){await callApi({op:'logout'});location.reload();return;}","if(a==='logout'){await callApi({op:'logout'});localStorage.removeItem(SNAPSHOT_KEY);location.reload();return;}\n if(a==='clear-local-snapshot'){localStorage.removeItem(SNAPSHOT_KEY);return notify('Đã xóa bản lưu trên thiết bị này; Google Sheets không thay đổi.');}",'logout cache')
s=rep(s,"if(a==='prev-week'||a==='next-week')", "if($state.mode==='cached'&&['delete-extra','save-baseline','save-version','clear-change','undo-official','bootstrap','prepare-version','parse-excel','remove-draft-slot'].includes(a))throw Error('Chỉ được xem bản lưu. Hãy đăng nhập để chỉnh sửa.');\n if(a==='prev-week'||a==='next-week')",'cached mutation guard')
s=rep(s,"async function saveEdit(){", "async function saveEdit(){\n if($state.mode!=='google')throw Error('Chỉ xem bản lưu. Cần đăng nhập để sửa chính khóa.');",'save edit guard')
s=rep(s,"async function saveExtra(){", "async function saveExtra(){\n if($state.mode!=='google')throw Error('Chỉ xem bản lưu. Cần đăng nhập để lưu Dạy thêm.');",'save extra guard')
s=rep(s,"const action=get('edit-action'),scope=get('edit-scope')||'following';", "const action=get('edit-action'),scope=get('edit-scope')||'following';\n validateOfficialScope(scope,get('edit-pattern'));",'validate scope')
s=rep(s,"const fromDate=addDays(monday(date),7),pattern=parseStreamPattern(get('edit-pattern'));\n  if(!pattern.length)throw Error('Chọn C cần nhập mẫu ĐS/HH, ví dụ ĐS,ĐS,HH,ĐS');", "const fromDate=addDays(monday(date),7),pattern=validateOfficialScope(scope,get('edit-pattern'));",'future scope')
s=rep(s,"function updateEditorFields(){\n // Dạy thêm sử dụng biểu mẫu riêng, không còn ẩn/hiện các trường chung gây nhầm lẫn.\n}", "function updateEditorFields(){\n const scope=$('#edit-scope')?.value||'following';const pattern=$('#edit-pattern');if(pattern){const group=pattern.closest('.wide');if(group)group.hidden=scope!=='future';pattern.required=scope==='future';}\n}",'hide pattern')
s=rep(s,"if(['edit-action','edit-kind'].includes(e.target.id))updateEditorFields();", "if(['edit-action','edit-kind','edit-scope'].includes(e.target.id))updateEditorFields();",'scope update')
s=rep(s,"<button class=\"btn soft\" data-action=\"diagnose-sync\">Kiểm tra đồng bộ Sheets</button>", "<button class=\"btn soft\" data-action=\"diagnose-sync\">Kiểm tra đồng bộ Sheets</button><button class=\"btn ghost\" data-action=\"clear-local-snapshot\">Xóa bản TKB lưu trên thiết bị</button>",'clear snapshot button')
main.write_text(s)

s=gas.read_text()
s=s.replace("const SMART_TKB_SERVER_VERSION='1.6.2';","const SMART_TKB_SERVER_VERSION='1.6.4';")
s=rep(s,"'scope','titleOverride'],", "'scope','titleOverride','sourceSlotId','moveDate','moveShift','movePeriod'],",'GAS columns')
s=rep(s,"changes:['period'],", "changes:['period','movePeriod'],",'GAS numeric')
s=rep(s,"assert_(['EDIT','DONE','OFF','ADD','CLEAR'].includes(row.action)","assert_(['EDIT','DONE','OFF','ADD','CLEAR','MOVE'].includes(row.action)",'GAS move action')
# handle move source with exact id; validate target source on server; avoids double booking or modifying historical rows
needle="const cls=read_('classes').find(x=>x.id===row.classId);"
replace="""if(row.action==='MOVE'){
  assert_(row.scope==='one'&&!row.completed&&!row.ppctId,'Dời lịch chỉ áp dụng cho một ngày, không thay đổi tiến độ PPCT');
  assert_(/^\\d{4}-\\d{2}-\\d{2}$/.test(String(row.moveDate||'')),'Ngày đến không hợp lệ');
  assert_(['S','C','T'].includes(row.moveShift),'Buổi đến không hợp lệ');
  assert_(Number.isInteger(Number(row.movePeriod))&&Number(row.movePeriod)>=1&&Number(row.movePeriod)<=(row.moveShift==='T'?2:5),'Tiết đến không hợp lệ');
  const v=read_('versions').filter(x=>x.fromDate<=row.date).sort((a,b)=>b.fromDate.localeCompare(a.fromDate))[0];
  const slot=read_('slots').find(x=>x.id===row.sourceSlotId&&x.versionId===v?.id);
  assert_(slot&&Number(slot.day)===extraNumberDay_(row.date)&&slot.shift===row.shift&&Number(slot.period)===Number(row.period),'Tiết nguồn không khớp lịch gốc');
  assert_(slot.classId===row.classId&&slot.subject===row.subject,'Tiết cần dời không khớp lớp/môn');
  const toVer=read_('versions').filter(x=>x.fromDate<=row.moveDate).sort((a,b)=>b.fromDate.localeCompare(a.fromDate))[0];
  const conflicts=read_('slots').filter(x=>x.versionId===toVer?.id&&Number(x.day)===extraNumberDay_(row.moveDate)&&x.shift===row.moveShift&&Number(x.period)===Number(row.movePeriod));
  const previouslyMoved=read_('changes').filter(x=>x.action==='MOVE'&&x.date===row.moveDate&&x.sourceSlotId);
  assert_(!conflicts.some(x=>!previouslyMoved.some(m=>m.sourceSlotId===x.id)),'Ô đến đang có chính khóa; chọn ô trống');
  assert_(!read_('changes').some(x=>x.id!==row.id&&x.moveDate===row.moveDate&&x.moveShift===row.moveShift&&Number(x.movePeriod)===Number(row.movePeriod)),'Ô đến đang có tiết được dời khác');
  assert_(!read_('changes').some(x=>x.id!==row.id&&x.date===row.moveDate&&x.shift===row.moveShift&&Number(x.period)===Number(row.movePeriod)&&x.action==='ADD'),'Ô đến đã có tiết dạy bù');
 }
 const cls=read_('classes').find(x=>x.id===row.classId);"""
s=rep(s,needle,replace,'gas move validation')
s=rep(s,"assert_(!previous.some(x=>x.id!==row.id&&x.date===row.date&&x.shift===row.shift&&Number(x.period)===Number(row.period)),'Có điều chỉnh khác cùng ô');", "assert_(!previous.some(x=>x.id!==row.id&&x.date===row.date&&x.shift===row.shift&&Number(x.period)===Number(row.period)&&(row.action!=='MOVE'||x.action!=='MOVE')),'Có điều chỉnh khác cùng ô');",'gas duplicate move same cell')
gas.write_text(s)
print('Patched core/main/api/gas')
