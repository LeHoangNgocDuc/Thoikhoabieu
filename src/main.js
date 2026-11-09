
import {DAYS,SHIFTS,addDays,monday,dayNumber,schoolWeek,classById,activeVersion,eventsForWeek,conflicts,ppctSequence,parseDate,normalizeSheetData,tutoringForWeek,parseGroups,extraSlotOverlap,parseStreamPattern,progressAt,progressSummary,mathStreamPattern,applyStreamAssignments} from './core.js';
import {extractTeacherSchedule} from './importExcel.js';

const $=s=>document.querySelector(s);
const newRequestId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $state={data:null,mode:'demo',view:'calendar',week:monday('2026-11-09'),filterClass:'all',filterShift:'all',filterSubject:'all',filterKind:'all',filterStream:'all',notice:'',edit:null,pendingImport:null,ppctGrade:'7',ppctSubject:'Toán',ppctStream:'all',ppctQuery:'',loggedIn:false,fitWeek:localStorage.getItem('smart-tkb-focus-v14')!=='off',calendarLayout:'week',dayIndex:2,backendConfigured:false,remoteError:'',savingExtra:false,drawerOpen:false,onlyExtra:false,statsClass:'all',statsSubject:'all',statsDate:'',statsPeriod:'week'};
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
async function callApi(body){const url='/api/tkb';const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({error:'Máy chủ trả dữ liệu không hợp lệ'}));if(!r.ok||j.ok===false)throw Error(j.error||'Không thể lưu');return j;}
async function persist(table,row){
 if($state.mode==='google'){
  await callApi({op:'save',table,row});await pullGoogle();
 }else{
  const arr=$state.data[table]||[];const index=arr.findIndex(x=>x.id===row.id);if(index>=0)arr[index]=row;else arr.push(row);cacheDemo();
 }
}
function cacheDemo(){localStorage.setItem('smart-tkb-demo-v1',JSON.stringify($state.data));}
async function pullGoogle(){const r=await fetch('/api/tkb',{cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'Không thể đọc dữ liệu Google');$state.data=normalizeSheetData(j.data);$state.mode='google';$state.loggedIn=true;$state.remoteError='';}
async function init(){
 try{const sess=await fetch('/api/tkb?action=session').then(r=>r.json());{ $state.backendConfigured=Boolean(sess.backendConfigured);if(sess.authenticated&&sess.backendConfigured)await pullGoogle(); }}catch(e){console.info('Chưa tải được Google Sheets:',e.message);$state.remoteError=e.message;$state.notice='Không tải được Google Sheets: '+e.message;}
 if(!$state.data){const seed=await fetch('/seed.json').then(r=>r.json());const saved=localStorage.getItem('smart-tkb-demo-v1');try{$state.data=normalizeSheetData(saved?JSON.parse(saved):seed);}catch{$state.data=normalizeSheetData(seed);} $state.mode='demo';}
 render();
}
function sideFilters(){
 if(!['calendar','extra','overview'].includes($state.view))return '';
 return `<div class="side-filter-section"><div class="navtitle">BỘ LỌC LỊCH</div>
 <label>Lớp / nhóm</label><select id="f-class">${options(CLASS_OPTS(),$state.filterClass)}</select>
 <label>Buổi</label><select id="f-shift">${options([['all','Cả ngày'],['S','Sáng'],['C','Chiều'],['T','Tối']],$state.filterShift)}</select>
 <label>Môn học</label><select id="f-subject">${options([['all','Toán + Tin'],['Toán','Toán'],['Tin','Tin']],$state.filterSubject)}</select>
 <label>Mạch Toán</label><select id="f-stream">${options([['all','ĐS + HH'],['ĐS','Đại số'],['HH','Hình học']],$state.filterStream)}</select>
 <button class="btn ghost full" data-action="reset-filters">Xóa bộ lọc</button>
 <div class="side-legend"><strong>Màu nhận diện lớp</strong>${($state.data?.classes||[]).map(c=>`<div><i style="background:${colorFor(c.id)[1]}"></i>${esc(c.name)} <small>${esc(c.id)}</small></div>`).join('')}</div></div>`;
}
function showTop(){
 const d=$state.data;
 const official=eventsForWeek(d,$state.week).filter(e=>e.kind!=='EXTRA');
 const extras=tutoringForWeek(d,$state.week);
 const all=[...official,...extras];
 const combined=conflicts(all);
 const err=['extra','overview'].includes($state.view)?combined:conflicts(official);
 const events=['extra','overview'].includes($state.view)?all:official;
 return `<header class="topbar"><button class="top-menu-toggle" data-action="toggle-drawer" aria-label="Mở thanh menu">☰</button><div class="brandmark">TK</div><div class="brandtext"><h1>Smart TKB<span>·</span> Lê Hoàng Ngọc Đức</h1><p>THCS Nam Nha Trang – Phân hiệu Vĩnh Trường</p></div><div class="topright"><span class="pill ${$state.mode==='google'?'good':'muted'}">${$state.mode==='google'?'● Google Sheets':'○ Chế độ dùng thử'}</span><button class="btn ghost" data-action="refresh-google">↻ Tải lại Google Sheets</button><button class="btn ghost" data-action="open-settings">${$state.mode==='google'?'Đã kết nối':'Kết nối Google'}</button></div></header>
 <div class="shell">${$state.drawerOpen?'<button class="drawer-scrim" data-action="close-drawer" aria-label="Đóng bộ lọc"></button>':''}<aside class="sidebar ${$state.drawerOpen?'drawer-open':''}" id="side-menu"><div class="side-mobilehead"><strong>☰ Lê Hoàng Ngọc Đức</strong><button class="icon-btn" data-action="close-drawer">×</button></div><div class="navtitle">QUẢN LÝ GIẢNG DẠY</div>
 ${[['calendar','▦','Chính khóa'],['extra','◈','Dạy thêm'],['overview','◫','TKB đầy đủ'],['statistics','▥','Thống kê tiến độ'],['progress','◷','PPCT & tiến độ'],['versions','⇄','Phiên bản TKB'],['settings','⚙','Cấu hình & dữ liệu']].map(([k,icon,label])=>`<button class="navitem ${$state.view===k?'selected':''}" data-view="${k}"><span class="navicon">${icon}</span>${label}</button>`).join('')}
 ${sideFilters()}<div class="sidefooter"><div class="stat-label">Năm học 2026 – 2027</div><div class="stat-desc">7 lớp chính khóa · 7 ngày/tuần<br>Sáng 5 tiết · Chiều 5 tiết · Tối 2 suất</div></div></aside><main class="content">${$state.notice?`<div class="notice">${esc($state.notice)}<button data-action="clear-notice">×</button></div>`:''}
 ${['calendar','extra','overview'].includes($state.view)?calendarPage(events,err):$state.view==='statistics'?statisticsPage():$state.view==='progress'?progressPage():$state.view==='versions'?versionsPage():settingsPage()}
 </main></div>`;
}
function dayBoard(events,conflictKeys,page){
 const day=$state.dayIndex,date=addDays($state.week,day-2);
 const slots=SHIFTS.filter(s=>page!=='calendar'||s.id!=='T').flatMap(s=>Array.from({length:s.count},(_,i)=>({shift:s.id,period:i+1,label:`${s.label} · ${s.id==='T'?'Suất':'Tiết'} ${i+1}`})));
 return `<div class="day-board"><div class="day-switch"><button data-action="prev-day" aria-label="Ngày trước">‹</button><strong>${dayLabel(day)} · ${fmt(date)}</strong><button data-action="next-day" aria-label="Ngày sau">›</button></div><div class="day-chips">${DAYS.map(d=>`<button type="button" data-action="select-day" data-day="${d.n}" class="${d.n===day?'selected':''}">${d.n===8?'CN':`T${d.n}`}<small>${fmt(addDays($state.week,d.n-2))}</small></button>`).join('')}</div><div class="day-events">${slots.map(s=>{
  const matches=events.filter(x=>x.date===date&&x.shift===s.shift&&Number(x.period)===s.period&&(page!=='extra'||!$state.onlyExtra||x.kind==='EXTRA'));
  const editType=page==='extra'?'extra':page==='calendar'?'official':matches.length?(matches[0].kind==='EXTRA'?'extra':'official'):'choose';
  const conflict=conflictKeys.has(`${date}|${s.shift}|${s.period}`);
  return `<button class="day-event ${matches.length?'has-events':''} ${conflict?'day-conflict':''}" data-action="open-cell" data-date="${date}" data-shift="${s.shift}" data-period="${s.period}" data-editor="${editType}"><span class="day-time">${s.label}</span><span class="day-contents">${matches.length?matches.map(x=>`<span class="day-entry" style="${styleFor(x.kind==='EXTRA'?parseGroups(x.groups)[0]:x.classId)}"><b>${esc(x.kind==='EXTRA'?`Dạy thêm · ${parseGroups(x.groups).length} nhóm`:className(x.classId))}</b><small>${esc(x.subject)} · ${x.kind==='EXTRA'?`Buổi ${x.lessonNumber||1}`:`${esc(x.stream||'')} · PPCT ${esc(x.ppct?.period||'—')}`}</small>${x.kind==='EXTRA'&&x.lessonTitle?`<small>${esc(x.lessonTitle)}</small>`:''}</span>`).join(''):'<span class="day-empty">+ Chưa có lịch · Nhấn để thêm</span>'}</span></button>`;
 }).join('')}</div></div>`;
}
function calendarPage(events,error){
 const page=$state.view,extraMode=page==='extra',overview=page==='overview';
 const heading=extraMode?'Lịch dạy thêm':overview?'Toàn bộ lịch dạy':'Thời khóa biểu chính khóa';
 const version=activeVersion($state.data,$state.week);
 const filtered=events.filter(e=>{
  const matchesClass=$state.filterClass==='all'||($state.filterClass===e.classId)||(e.kind==='EXTRA'&&parseGroups(e.groups).includes($state.filterClass));
  return matchesClass&&($state.filterShift==='all'||$state.filterShift===e.shift)&&($state.filterSubject==='all'||$state.filterSubject===e.subject)&&($state.filterStream==='all'||e.subject==='Tin'||e.kind==='EXTRA'||e.stream===$state.filterStream);
 });
 const activeShifts=SHIFTS.filter(s=>($state.filterShift==='all'||s.id===$state.filterShift)&&(page!=='calendar'||$state.filterShift==='T'||s.id!=='T'));
 const allOfficial=eventsForWeek($state.data,$state.week).filter(e=>e.kind!=='EXTRA');
 const allExtras=tutoringForWeek($state.data,$state.week);
 const conflictKeys=new Set(error.map(c=>c.key));
 const occupied=events.filter(e=>e.status!=='OFF'&&(!extraMode||e.kind==='EXTRA')).length;
 const completed=events.filter(e=>e.status==='DONE'&&(!extraMode||e.kind==='EXTRA')).length;
 const renderCell=(day,s,p)=>{
  const date=addDays($state.week,day-2);
  const shown=filtered.filter(e=>e.date===date&&e.shift===s&&Number(e.period)===p&&(!extraMode||!$state.onlyExtra||e.kind==='EXTRA'));
  const main=allOfficial.some(e=>e.date===date&&e.shift===s&&Number(e.period)===p);
  const ex=allExtras.some(e=>e.date===date&&e.shift===s&&Number(e.period)===p);
  const editor=extraMode?'extra':overview?(main?'official':ex?'extra':'choose'):'official';
  const conflict=conflictKeys.has(`${date}|${s}|${p}`);
  const hint=shown.map(e=>e.kind==='EXTRA'?`${e.subject}: ${parseGroups(e.groups).map(className).join(' + ')}`:`${e.subject} ${className(e.classId)} (${e.stream||''})`).join(' | ')||'Nhấn để thêm hoặc điều chỉnh';
  return `<td><button class="cell ${shown.length?'filled':''} ${conflict?'conflict':''}" data-action="open-cell" data-editor="${editor}" data-date="${date}" data-shift="${s}" data-period="${p}" title="${esc(hint)}">
    ${shown.map(e=>{const groupNames=parseGroups(e.groups);const short=e.kind==='EXTRA'?(groupNames.length===1?className(groupNames[0]):`DT ${groupNames.length} lớp`):className(e.classId);const colors=styleFor(e.kind==='EXTRA'?(groupNames[0]||'extra'):e.classId);
     return `<span class="lesson ${e.kind==='EXTRA'?'tutor':e.subject==='Toán'?'math':'ict'} ${e.status==='OFF'?'off':''} ${extraMode&&e.kind!=='EXTRA'?'official-muted':''}" style="${colors}">
     <span class="lesson-name lesson-full">${esc(e.subject)} · ${esc(e.kind==='EXTRA'?groupNames.map(className).join(' + '):className(e.classId))}</span>
     <span class="lesson-name lesson-short">${esc(short)}</span>
     <span class="lesson-sub lesson-sub-full">${e.kind==='EXTRA'?`<b>Suất ${esc(p)}</b> · Buổi ${esc(e.lessonNumber||1)}${e.recurring?' ↻':''}`:`<b>${esc(e.stream||'')}</b> · ${e.status==='OFF'?'NGHỈ · ':''}${e.ppct?`PPCT ${esc(e.ppct.period)}`:'Chưa gán PPCT'}`}</span><span class="lesson-sub lesson-sub-mobile">${e.kind==='EXTRA'?`S${esc(p)} · B${esc(e.lessonNumber||1)}`:`${esc(e.stream||'')} · ${e.ppct?`T${esc(e.ppct.period)}`:'—'}`}</span>
     ${e.kind==='EXTRA'&&(e.lessonTitle||e.notes)?`<span class="lesson-title">${esc(e.lessonTitle||e.notes)}</span>`:e.ppct?.title?`<span class="lesson-title">${esc(e.ppct.title)}</span>`:''}</span>`;
    }).join('')||'<span class="addmark">+</span>'}
    ${conflict?'<span class="alert-dot" title="Cần kiểm tra lịch trùng">!</span>':''}</button></td>`;
 };
 return `<div class="pagehead"><div><div class="eyebrow">SMART TKB V1.6 · LÊ HOÀNG NGỌC ĐỨC</div><h2>${heading}</h2><p>${extraMode?'Dạy thêm độc lập với PPCT. Mỗi suất có thể chọn nhiều lớp hoặc nhóm tự đặt tên.':overview?'Xem cả chính khóa và dạy thêm nhưng lưu dữ liệu hoàn toàn riêng biệt.':'Chính khóa theo phiên bản TKB; nghỉ/dạy bù theo PPCT từng lớp.'}</p></div><div class="actions"><button class="btn soft" data-action="print">⎙ In</button><button class="btn primary" data-action="export">↓ Xuất CSV</button></div></div>
 <div class="metrics"><div class="metric"><span>${extraMode?'Suất dạy thêm':'Tiết có lịch'}</span><strong>${occupied}</strong><small>Trong tuần đang xem</small></div><div class="metric"><span>Đã hoàn thành</span><strong>${completed}</strong><small>Đã xác nhận</small></div><div class="metric"><span>Phiên bản chính khóa</span><strong class="metric-version">${esc(version?.name||'Chưa có TKB')}</strong><small>Tuần ${schoolWeek($state.week)}</small></div><div class="metric ${error.length?'metric-warn':''}"><span>Trùng thời điểm</span><strong>${error.length}</strong><small>Kiểm tra trước khi xếp lịch</small></div></div>
 <section class="panel"><div class="weekbar"><button class="menu-toggle" data-action="toggle-drawer" aria-label="Mở danh mục và bộ lọc">☰<small>Bộ lọc</small></button><div class="weekchange"><button class="arrow" data-action="prev-week">‹</button><div><strong>Tuần ${schoolWeek($state.week)} · ${fmt($state.week)} – ${fmt(weekEnd())}</strong><span>${page==='calendar'?'Chính khóa · sáng 1–5 · chiều 1–5':'Đầy đủ 7 ngày · sáng 1–5 · chiều 1–5 · tối suất 1–2'}</span><em class="teacher-byline">GV: Lê Hoàng Ngọc Đức</em></div><button class="arrow" data-action="next-week">›</button></div><div class="weektools"><button class="btn soft" data-action="today">Tuần hiện tại</button><button class="btn fit-toggle" data-action="fit-week">${$state.fitWeek?'▣ Mở giao diện đầy đủ':'▣ Xem vừa màn hình'}</button><button class="btn soft" data-action="fullscreen-week">⛶ Toàn màn hình</button></div></div>
 <div class="view-layout-toolbar"><div class="layout-choice" role="group" aria-label="Cách xem lịch"><button type="button" data-action="layout-week" class="layout-button ${$state.calendarLayout==='week'?'on':''}">▦ Toàn tuần</button><button type="button" data-action="layout-day" class="layout-button ${$state.calendarLayout==='day'?'on':''}">☷ Theo ngày</button></div><span class="layout-info">Chạm ô để xem chi tiết · ${$state.mode==='google'?'Đã kết nối Sheets':'Chế độ dùng thử'}</span></div><div class="week-view-tabs"><button data-view="calendar" class="week-tab ${page==='calendar'?'active':''}">Chính khóa</button><button data-view="extra" class="week-tab ${page==='extra'?'active':''}">Dạy thêm</button><button data-view="overview" class="week-tab ${page==='overview'?'active':''}">Tổng hợp</button></div>
 
 ${page==='calendar'?'<button class="btn soft compact-full-toggle" data-view="overview">▣ Xem TKB đầy đủ (cả dạy thêm)</button>':page==='extra'?`<label class="extra-only-toggle"><input type="checkbox" id="only-extra" ${$state.onlyExtra?'checked':''}> Chỉ hiện dạy thêm (mặc định xem cả chính khóa)</label>`:''}
 ${error.length?`<details class="warning compact-warning"><summary>⚠ Có ${error.length} vị trí trùng lịch (nhấn để xem)</summary><p>${error.map(c=>{const e=c.items[0];return `${fmt(e.date)} ${shiftLabel(e.shift)} ${e.period}: ${c.items.map(x=>x.kind==='EXTRA'?`Dạy thêm ${parseGroups(x.groups).join(', ')}`:`${x.subject} ${className(x.classId)}`).join(' / ')}`}).join('; ')}</p></details>`:''}
 ${$state.calendarLayout==='day'?dayBoard(filtered,conflictKeys,page):`<div class="table-scroller week-scroller"><table class="timetable"><thead><tr><th class="sidecol">Ca</th>${DAYS.map(d=>`<th><span class="day-long">${d.label}</span><span class="day-short">${d.n===8?'CN':`T${d.n}`}</span><small>${fmt(addDays($state.week,d.n-2))}</small></th>`).join('')}</tr></thead><tbody>
 ${activeShifts.map(sh=>Array.from({length:sh.count},(_,i)=>`<tr><th class="period-label"><span>${sh.label}</span><strong>${sh.id==='T'?'Suất':'Tiết'} ${i+1}</strong></th>${DAYS.map(d=>renderCell(d.n,sh.id,i+1)).join('')}</tr>`).join('')).join('')}
 </tbody></table></div>`}<div class="legend"><span>Mỗi lớp một màu · Chọn ô để xem chi tiết</span><span><i class="dot red"></i> Trùng thời điểm</span><span>↻ Dạy thêm lặp hàng tuần</span></div></section>`;
}
function fmt(date){const [y,m,d]=date.split('-');return `${d}/${m}`;}
function progressPage(){const d=$state.data;const list=(d.ppct||[]).filter(e=>String(e.grade)===$state.ppctGrade&&e.subject===$state.ppctSubject&&($state.ppctStream==='all'||e.stream===$state.ppctStream)&&e.title.toLowerCase().includes($state.ppctQuery.toLowerCase())).sort((a,b)=>a.week-b.week||a.period-b.period);
 const bs=(d.baselines||[]).filter(b=>{const c=classById(d,b.classId);return String(c?.grade)===$state.ppctGrade&&b.subject===$state.ppctSubject;});
 return `<div class="pagehead"><div><div class="eyebrow">PHÂN PHỐI CHƯƠNG TRÌNH</div><h2>PPCT & tiến độ lớp học</h2><p>Toán chia thành Đại số và Hình học; Tin học dùng chuỗi bài riêng. Dữ liệu trích từ 4 file gốc.</p></div></div>
 <section class="panel"><div class="panelheading"><h3>Thiết lập điểm bắt đầu theo từng lớp</h3><p>Vì ứng dụng bắt đầu từ tuần 10, phải xác nhận tiết PPCT tiếp theo thực tế của từng lớp trước khi tự động dồn bài.</p></div><div class="baseline-grid">${bs.map(b=>{const c=classById(d,b.classId);const seq=ppctSequence(d,c.grade,b.subject,b.stream);return `<div class="baseline-item"><div class="base-header"><strong>${esc(c.name)} · ${esc(b.stream)}</strong><span class="state ${b.confirmed?'ok':'pending'}">${b.confirmed?'Đã xác nhận':'Cần xác nhận'}</span></div><select id="base-${esc(b.id)}">${seq.map((p,i)=>`<option value="${i}" ${i===Number(b.nextIndex)?'selected':''}>Tiết ${p.period} · ${esc(p.title).slice(0,65)}</option>`).join('')}</select><button class="btn small" data-action="save-baseline" data-id="${esc(b.id)}">Lưu & xác nhận</button></div>`;}).join('')}</div></section>
 <section class="panel"><div class="panelheading"><h3>Danh mục PPCT đã nhập</h3><p>Có thể tìm theo tên bài hoặc lọc theo mạch ĐS / HH.</p></div><div class="filters ppct-filters"><div><label>Khối</label><select id="ppct-grade">${options([['7','Khối 7'],['9','Khối 9']],$state.ppctGrade)}</select></div><div><label>Môn</label><select id="ppct-subject">${options([['Toán','Toán'],['Tin','Tin']],$state.ppctSubject)}</select></div><div><label>Mạch</label><select id="ppct-stream">${options([['all','Tất cả'],['ĐS','Đại số'],['HH','Hình học'],['TIN','Tin học']],$state.ppctStream)}</select></div><div class="searchfield"><label>Tìm bài học</label><input id="ppct-query" placeholder="Ví dụ: căn bậc hai" value="${esc($state.ppctQuery)}"/></div></div>
 <div class="table-scroller"><table class="data-table"><thead><tr><th>Tuần</th><th>Mạch</th><th>Tiết PPCT</th><th>Tên bài học / chủ đề</th></tr></thead><tbody>${list.slice(0,350).map(e=>`<tr><td>${esc(e.week)}</td><td><span class="tag">${esc(e.stream)}</span></td><td>${esc(e.period)}</td><td>${esc(e.title)}</td></tr>`).join('')}</tbody></table></div><p class="caption">Hiển thị ${list.length} mục. Thầy cần kiểm tra kết quả đọc PDF/Word, đặc biệt các mốc kiểm tra và PPCT Tin 9 không tuần tự.</p></section>`;
}
function statsEndDate(){return {week:weekEnd(),hk1:'2027-01-09',hk2:'2027-05-22',custom:$state.statsDate||weekEnd()}[$state.statsPeriod]||weekEnd();}
function statisticsPage(){
 const date=statsEndDate(),all=progressSummary($state.data,date),cls=$state.data.classes||[];
 const filtered=all.filter(x=>($state.statsClass==='all'||x.classId===$state.statsClass)&&($state.statsSubject==='all'||x.subject===$state.statsSubject));
 const selected=filtered.filter(x=>x.status==='ready'),pending=filtered.filter(x=>x.status!=='ready');
 const deltaCell=x=>x.status!=='ready'?'<span class="pending-stat">Chưa xác nhận mốc</span>':`<span class="pace ${x.delta<0?'behind':x.delta>0?'ahead':'ontime'}">${x.delta>0?'+':''}${x.delta} tiết ${x.delta>0?'(nhanh)':x.delta<0?'(chậm)':'(đúng)'}</span>`;
 const rows=filtered.map(x=>`<tr><td><b>${esc(className(x.classId))}</b> <small>${esc(x.classId)}</small></td><td>${esc(x.subject)} ${esc(x.stream==='TIN'?'':x.stream)}</td><td>${x.planned??'—'}</td><td>${x.actual??'—'}${x.status==='ready'?`<div class="progress-meter"><i style="width:${Math.min(100,Math.max(0,(x.actual/Math.max(1,x.planned))*100))}%"></i></div>`:''}</td><td>${deltaCell(x)}</td><td>${x.next?`T${esc(x.next.period)} · ${esc(x.next.title)}`:'—'}${x.unlinked?`<span class="pending-stat"> · ${x.unlinked} tiết chưa gắn PPCT</span>`:''}</td></tr>`).join('');
 const total=selected.reduce((sum,x)=>sum+x.delta,0);
 const mathPairs=cls.filter(c=>c.subjects.includes('Toán')).map(c=>{
   const parts=['ĐS','HH'].map(stream=>all.find(x=>x.classId===c.id&&x.subject==='Toán'&&x.stream===stream));
   const valid=parts.every(x=>x?.status==='ready');const value=valid?parts[0].delta+parts[1].delta:null;
   return `<div class="sum-card"><strong>${esc(c.name)} · Toán tổng hợp</strong><span>${value===null?'Chưa đủ dữ liệu':`${value>0?'+':''}${value} tiết`}</span><small>ĐS: ${parts[0]?.delta??'—'} · HH: ${parts[1]?.delta??'—'}</small></div>`;
 }).join('');
 return `<div class="pagehead"><div><div class="eyebrow">SMART TKB V1.6 · LÊ HOÀNG NGỌC ĐỨC</div><h2>Thống kê tiến độ theo PPCT</h2><p>Chỉ tính các tiết có xác nhận thực tế; lịch dự kiến không được coi là đã dạy.</p></div><div class="actions"><button class="btn primary" data-action="export-statistics">↓ Xuất thống kê CSV</button><button class="btn soft" data-action="print">⎙ In báo cáo</button></div></div>
 <section class="panel"><div class="stats-toolbar"><div><label>Khoảng thống kê</label><select id="stats-period">${options([['week','Đến cuối tuần đang xem'],['hk1','Đến hết học kỳ I'],['hk2','Đến hết năm học'],['custom','Chọn ngày cụ thể']],$state.statsPeriod)}</select></div><div><label>Ngày mốc</label><input id="stats-date" type="date" value="${esc(date)}" ${$state.statsPeriod==='custom'?'':'disabled'}></div><div><label>Lớp</label><select id="stats-class">${options([['all','Tất cả lớp'],...cls.map(c=>[c.id,`${c.name} (${c.id})`])],$state.statsClass)}</select></div><div><label>Môn</label><select id="stats-subject">${options([['all','Toán và Tin'],['Toán','Toán'],['Tin','Tin']],$state.statsSubject)}</select></div></div>
 <div class="statistics-summary"><div><small>Đã xác nhận tiến độ</small><strong>${selected.length}/${filtered.length}</strong></div><div><small>Chưa xác nhận mốc</small><strong>${pending.length}</strong></div><div><small>Tổng chênh lệch đã xác nhận</small><strong>${total>0?'+':''}${total} tiết</strong></div></div>
 ${pending.length?`<div class="stats-warning">⚠ Có ${pending.length} mạch/lớp chưa xác nhận mốc PPCT. Vào “PPCT & tiến độ” để xác nhận. Không hiển thị số tiết đã dạy hoặc chênh lệch giả.</div>`:''}
 <div class="table-scroller"><table class="data-table stats-table"><thead><tr><th>Lớp</th><th>Môn/mạch</th><th>Kế hoạch</th><th>Đã dạy</th><th>Nhanh/chậm</th><th>Tiết tiếp theo</th></tr></thead><tbody>${rows}</tbody></table></div>
 <p class="caption">Kế hoạch đếm các mục PPCT đến tuần của ngày chọn. Thực tế = các tiết trước mốc đã xác nhận + các tiết PPCT duy nhất được xác nhận hoàn thành sau mốc. Nếu giáo viên quên đánh dấu đã dạy, kết quả có thể thấp hơn thực tế.</p></section>
 <section class="panel"><div class="panelheading"><h3>Tổng hợp Toán theo từng lớp</h3><p>Mỗi lớp có hai tiến độ ĐS và HH riêng.</p></div><div class="math-summary">${mathPairs}</div></section>`;
}
function exportStatistics(){const d=statsEndDate();const list=progressSummary($state.data,d).filter(x=>($state.statsClass==='all'||x.classId===$state.statsClass)&&($state.statsSubject==='all'||x.subject===$state.statsSubject));const cells=[['Ngày thống kê','Lớp','Môn','Mạch','Kế hoạch','Đã dạy','Chênh lệch','Trạng thái','Tiết tiếp theo'],...list.map(x=>[d,className(x.classId),x.subject,x.stream,x.planned,x.actual??'',x.delta??'',x.status,x.next?.period??''])];const csv=cells.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');saveFile(`SmartTKB_TienDo_${d}.csv`,'\ufeff'+csv,'text/csv;charset=utf-8');}
function versionsPage(){const d=$state.data;const versions=[...d.versions].sort((a,b)=>b.fromDate.localeCompare(a.fromDate));const p=$state.pendingImport;
 return `<div class="pagehead"><div><div class="eyebrow">PHIÊN BẢN THỜI KHÓA BIỂU</div><h2>Nhập lịch mới từ Excel</h2><p>Trường đổi TKB sau khoảng 4 tuần; dùng ngày hiệu lực thực tế, giữ nguyên lịch đã dạy.</p></div></div>
 <section class="panel"><div class="panelheading"><h3>1. Lịch đã lưu</h3></div><div class="version-list">${versions.map(v=>`<div class="version-line"><span class="version-icon">▤</span><div><strong>${esc(v.name)}</strong><small>Từ ${esc(v.fromDate)} đến ${esc(v.toDate||'khi có lịch thay thế')} · ${(d.slots||[]).filter(s=>s.versionId===v.id).length} tiết/tuần</small></div><span class="tag">Đã lưu</span></div>`).join('')}</div></section>
 <section class="panel"><div class="panelheading"><h3>2. Tạo phiên bản mới</h3><p>Chọn ngày áp dụng, tải Excel khối 7, khối 9 hoặc Tin học. Có thể nhập nhiều file, giữ lịch môn/khối chưa thay đổi.</p></div><div class="import-grid"><div><label>Tên phiên bản</label><input id="new-version-name" value="${esc(p?.name||'TKB lần 5')}" /></div><div><label>Bắt đầu áp dụng</label><input type="date" id="new-version-date" value="${esc(p?.fromDate||'2026-12-14')}" /></div><div><label>File Excel (.xlsx)</label><input type="file" id="excel-file" accept=".xlsx" /></div></div>
 <div class="row-buttons"><button class="btn soft" data-action="prepare-version">+ Tạo bản nháp từ lịch hiện tại</button><button class="btn primary" data-action="parse-excel">↥ Đọc file Excel và xem trước</button></div>
 ${p?`<div class="preview"><div class="preview-heading"><h4>Bản nháp: ${esc(p.name)} · ${esc(p.fromDate)}</h4><span class="tag">${p.slots.length} tiết</span></div><p>Đã nhập ${p.imported||0} tiết mới. Các tiết khác được kế thừa để tránh mất lịch chưa thay đổi.</p>
 ${p.warnings?.length?`<div class="warning">${p.warnings.map(esc).join('; ')}</div>`:''}
 ${previewConflicts(p.slots).length?`<div class="warning">Có ${previewConflicts(p.slots).length} ô trùng lịch. Hãy xóa một trong các tiết trùng trước khi áp dụng.</div>`:''}
 <div class="table-scroller"><table class="data-table"><thead><tr><th>Thứ</th><th>Buổi</th><th>Tiết</th><th>Lớp</th><th>Môn</th><th></th></tr></thead><tbody>${[...p.slots].sort((a,b)=>a.day-b.day||'SCT'.indexOf(a.shift)-'SCT'.indexOf(b.shift)||a.period-b.period).map(s=>`<tr><td>${dayLabel(s.day)}</td><td>${shiftLabel(s.shift)}</td><td>${s.period}</td><td>${className(s.classId)}</td><td>${s.subject}</td><td><button class="text-danger" data-action="remove-draft-slot" data-id="${esc(s.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div>
 <div class="row-buttons"><button class="btn primary" data-action="save-version" ${previewConflicts(p.slots).length?'disabled':''}>✓ Xác nhận lưu phiên bản</button><button class="btn ghost" data-action="discard-version">Hủy bản nháp</button></div></div>`:''}</section>`;
}
function previewConflicts(slots){const m={};for(const e of slots){const k=`${e.day}|${e.shift}|${e.period}`;(m[k]||=([])).push(e);}return Object.entries(m).filter(([,x])=>x.length>1);}
function settingsPage(){return `<div class="pagehead"><div><div class="eyebrow">CẤU HÌNH HỆ THỐNG</div><h2>Dữ liệu & kết nối</h2><p>Quản lý quyền truy cập, sao lưu, lớp học và nơi lưu Google Sheets.</p></div></div>
 <div class="setting-grid"><section class="panel"><div class="panelheading"><h3>Google Sheets</h3><p>Chế độ hiện tại: <strong>${$state.mode==='google'?'Đã kết nối':'Dùng thử trong trình duyệt'}</strong></p></div>${$state.mode==='demo'?`<p>Đăng nhập sau khi đã cấu hình API trên Vercel. Dữ liệu demo đang lưu riêng trên máy này.</p><label>Mật khẩu ứng dụng</label><input id="login-pass" type="password" autocomplete="current-password" placeholder="Nhập APP_PASSWORD"/><button class="btn primary full" data-action="login">Kết nối Google Sheets</button><p class="caption">Nếu chưa cấu hình máy chủ, xem hướng dẫn README.</p>`:`<p>Dữ liệu được lưu trong Google Sheets thông qua Apps Script và Vercel API. Khóa API không xuất hiện trong trình duyệt.</p><button class="btn soft" data-action="logout">Đăng xuất</button><button class="btn primary" data-action="bootstrap">Khởi tạo dữ liệu mẫu trên Sheet trống</button>`}</section>
 <section class="panel"><div class="panelheading"><h3>Sao lưu</h3><p>Xuất toàn bộ dữ liệu để lưu an toàn; có thể mở bằng trình soạn thảo JSON.</p></div><button class="btn soft full" data-action="backup">↓ Tải bản sao JSON</button><button class="btn ghost full" data-action="diagnose-extra">⌕ Kiểm tra dạy thêm đã lưu</button><button class="btn ghost full" data-action="print">⎙ In thời khóa biểu hiện tại</button></section></div>
 <section class="panel"><div class="panelheading"><h3>Lớp đang phụ trách</h3></div><div class="class-grid">${$state.data.classes.map(c=>`<div class="class-card"><div class="class-symbol">${esc(c.grade)}</div><div><strong>${esc(c.name)} <small>${esc(c.id)}</small></strong><div>${esc(c.subjects.join(' · '))}</div></div></div>`).join('')}</div></section>`;
}
function modal(){
 if(!$state.edit)return '';
 if($state.edit.type==='choose'){
  const x=$state.edit;
  return `<div class="backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><div class="modalhead"><h3>${fmt(x.date)} · ${shiftLabel(x.shift)} ${x.period}</h3><button class="icon-btn" data-action="close-modal">×</button></div><p>Chọn loại lịch cần thêm. Chính khóa và dạy thêm được lưu riêng.</p><div class="row-buttons"><button class="btn primary" data-action="choose-official">Chính khóa / Dạy bù</button><button class="btn soft" data-action="choose-extra">Dạy thêm</button></div></section></div>`;
 }
 return $state.edit.type==='extra'?extraModal():officialModal();
}
function extraModal(){
 const {date,shift,period}=$state.edit;
 const current=tutoringForWeek($state.data,monday(date)).find(e=>e.date===date&&e.shift===shift&&Number(e.period)===Number(period));
 const groups=parseGroups(current?.groups),known=new Set(($state.data.classes||[]).map(c=>c.id));
 const classIds=groups.filter(g=>known.has(g)),custom=groups.filter(g=>!known.has(g));
 const repeatRule=current?.recurring?(current.toDate?'until':'weekly'):current?'once':'weekly';
 return `<div class="backdrop" data-action="close-modal"><section class="modal extra-editor v16-modal" role="dialog" aria-modal="true" aria-label="${current?'Chỉnh sửa':'Thêm'} suất dạy thêm"><div class="modalhead"><div><div class="eyebrow">DẠY THÊM · LƯU TRÊN GOOGLE SHEETS</div><h3>${current?'Chỉnh sửa suất dạy thêm':'Thêm suất dạy thêm'}</h3><p>${fmt(date)} · ${dayLabel(dayNumber(date))} · ${shiftLabel(shift)} · ${shift==='T'?'Suất':'Tiết'} ${period}</p></div><button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng cửa sổ">×</button></div>
 ${$state.mode!=='google'?'<div class="editor-warning">⚠ Chế độ dùng thử: dữ liệu chỉ nằm trong trình duyệt này. Hãy kết nối Google Sheets để lưu bền vững.</div>':''}
 <form id="extra-form"><div class="formgrid">
 <div><label for="extra-subject">Môn học</label><select id="extra-subject">${options([['Toán','Toán'],['Tin','Tin']],current?.subject||'Toán')}</select></div>
 <div><label for="extra-start-lesson">Buổi thứ</label><input id="extra-start-lesson" type="number" min="1" max="9999" value="${esc(current?.lessonNumber||1)}"></div>
 <div class="wide"><label>Chọn nhiều lớp đang quản lý</label><div class="extra-class-picks">${($state.data.classes||[]).map(c=>`<label class="extra-class-option"><input type="checkbox" data-extra-class="${esc(c.id)}" ${classIds.includes(c.id)?'checked':''}><span>${esc(c.name)} <small>(${esc(c.id)})</small></span></label>`).join('')}</div></div>
 <div class="wide"><label for="extra-free-classes">+ Thêm tên lớp / nhóm khác</label><textarea id="extra-free-classes" rows="2" placeholder="Ví dụ: Toán 7A, Toán 7B, Nhóm nâng cao 9">${esc(custom.join(', '))}</textarea><small class="formhint">Nhập mỗi tên trên một dòng hoặc ngăn bằng dấu phẩy. Một suất hỗ trợ tối đa 60 lớp/nhóm.</small><div class="group-preview" id="group-preview" aria-live="polite"></div></div>
 <div class="wide"><label for="extra-lesson-title">Nội dung bài học</label><input id="extra-lesson-title" maxlength="350" value="${esc(current?.lessonTitle||'')}" placeholder="Ví dụ: Luyện tập phương trình"></div>
 <div><label for="extra-start-time">Giờ bắt đầu (không bắt buộc)</label><input id="extra-start-time" type="time" value="${esc(current?.startTime||'')}"></div>
 <div><label for="extra-end-time">Giờ kết thúc (không bắt buộc)</label><input id="extra-end-time" type="time" value="${esc(current?.endTime||'')}"></div>
 <div class="wide"><label for="extra-notes">Ghi chú</label><textarea id="extra-notes" rows="2" placeholder="Ghi chú cho buổi học">${esc(current?.notes||'')}</textarea></div>
 ${current?.recurring?`<div class="wide extra-rule"><strong>↻ Lịch dạy thêm lặp theo tuần</strong><p>Đang xem buổi thứ ${esc(current.lessonNumber)} · Thay đổi không ảnh hưởng chính khóa và PPCT.</p><label for="extra-scope">Phạm vi sửa</label><select id="extra-scope">${options([['one','Chỉ ngày này'],['future','Từ ngày này trở đi'],['all','Toàn bộ chuỗi lịch']], 'one')}</select></div>`:
 `<div class="wide extra-rule"><label for="extra-frequency">Lịch lặp</label><select id="extra-frequency">${options([['weekly','↻ Lặp hàng tuần (mặc định)'],['once','Chỉ một tuần'],['until','Lặp đến ngày được chọn']],repeatRule)}</select><div id="extra-end-wrap" class="extra-end-wrap"><label for="extra-end-date">Ngày kết thúc lặp</label><input type="date" id="extra-end-date" min="${date}" value="${esc(current?.toDate||'')}"></div></div>`}
 <div class="wide"><label class="inline-check"><input type="checkbox" id="extra-completed" ${current?.completed?'checked':''}> Đã dạy xong buổi này (không tính vào PPCT chính khóa)</label></div>
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
 const lessons=ppctSequence($state.data,classById($state.data,classId)?.grade||7,subject,subject==='Tin'?'TIN':stream);
 return `<div class="backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><div class="modalhead"><div><div class="eyebrow">CHÍNH KHÓA / DẠY BÙ</div><h3>${fmt(date)} · ${shiftLabel(shift)} · ${shift==='T'?'Suất':'Tiết'} ${period}</h3></div><button class="icon-btn" data-action="close-modal">×</button></div>
 ${e?`<div class="current-lesson"><strong>${esc(e.subject)} ${esc(className(e.classId))} ${esc(e.stream||'')}</strong><span>${esc(e.ppct?.title||'Chưa có nội dung PPCT')}</span><small>${e.kind==='MAIN'?'Chính khóa':'Dạy bù'}</small></div>`:'<div class="current-lesson">Ô trống: thêm tiết dạy bù chính khóa. Dạy thêm được nhập ở tab riêng.</div>'}
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
 if(!focus||$state.calendarLayout==='day')return;
 // Calculate the actual available height after toolbar/filters. Never crop the week.
 const top=scroller.getBoundingClientRect().top;
 const available=Math.max(210,window.innerHeight-top-7);
 scroller.style.height=available+'px';
 document.documentElement.style.setProperty('--tkb-row-height',Math.max(18,(available-39)/($state.filterShift==='all'?($state.view==='calendar'?10:12):$state.filterShift==='T'?2:5))+'px');
}
function updateEditorFields(){
 // Dạy thêm sử dụng biểu mẫu riêng, không còn ẩn/hiện các trường chung gây nhầm lẫn.
}
function render(){if(!$state.data)return;$('#app').innerHTML=showTop()+modal();fitWeekTable();updateEditorFields();updateExtraFormUI();}
window.addEventListener('resize',()=>fitWeekTable());
window.addEventListener('orientationchange',()=>fitWeekTable());
document.addEventListener('fullscreenchange',()=>fitWeekTable());
function saveFile(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),300);}
async function exportCsv(){const events=[...eventsForWeek($state.data,$state.week).filter(e=>e.kind!=='EXTRA'),...tutoringForWeek($state.data,$state.week)];const headers=['Ngày','Buổi','Tiết / Suất','Lớp','Môn','Mạch','Loại','Trạng thái','Tiết PPCT','Bài học','Ghi chú'];const csv=[headers,...events.map(e=>[e.date,shiftLabel(e.shift),e.period,e.kind==='EXTRA'?parseGroups(e.groups).map(className).join(' + '):className(e.classId),e.subject,e.stream,e.kind,e.status,e.ppct?.period||'',e.ppct?.title||'',e.notes||''])].map(a=>a.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');saveFile(`SmartTKB_Tuan${schoolWeek($state.week)}.csv`,'\ufeff'+csv,'text/csv;charset=utf-8');}
async function prepareDraft(){const date=$('#new-version-date')?.value||'2026-12-14';const name=$('#new-version-name')?.value.trim()||'TKB mới';const best=[...$state.data.versions].filter(x=>x.fromDate<=date).sort((a,b)=>b.fromDate.localeCompare(a.fromDate))[0]||$state.data.versions[0];const id=`ver-${date}-${Date.now()}`;const slots=($state.data.slots||[]).filter(s=>s.versionId===best?.id).map((x,i)=>({...x,id:`${id}-s${i}`,versionId:id}));$state.pendingImport={id,name,fromDate:date,slots,imported:0,warnings:[]};render();}
async function importExcel(){const file=$('#excel-file')?.files?.[0];if(!file)throw Error('Hãy chọn file Excel trước');let p=$state.pendingImport;
 if(!p) {await prepareDraft();p=$state.pendingImport;}
 const parsed=await extractTeacherSchedule(file);if(!parsed.slots.length)throw Error(parsed.warnings.join('; ')||'Không tìm thấy tiết của thầy Đức');
 const scope=new Set(parsed.slots.map(x=>`${classById($state.data,x.classId)?.grade}|${x.subject}`));
 p.slots=p.slots.filter(s=>!scope.has(`${classById($state.data,s.classId)?.grade}|${s.subject}`));
 const baseCount=p.slots.length;
 p.slots.push(...parsed.slots.map((s,i)=>({...s,id:`${p.id}-import-${baseCount+i}`,versionId:p.id})));
 p.imported+=parsed.slots.length;p.warnings.push(...parsed.warnings);
 $state.pendingImport=p;render();notify(`Đã đọc ${parsed.slots.length} tiết từ ${file.name}. Kiểm tra bảng trước khi lưu.`);
}
async function confirmDraft(){const p=$state.pendingImport;if(!p?.slots.length)throw Error('Chưa có lịch mới');if(previewConflicts(p.slots).length)throw Error('Phải xử lý trùng tiết trước khi lưu');
 const version={id:p.id,name:p.name,fromDate:p.fromDate,toDate:'',notes:'Tạo trên Smart TKB'};
 if($state.mode==='google'){await callApi({op:'replaceVersion',version,slots:p.slots});await pullGoogle();}else{$state.data.versions.push(version);$state.data.slots.push(...p.slots);cacheDemo();}
 $state.week=monday(p.fromDate);$state.pendingImport=null;$state.view='calendar';notify('Đã lưu phiên bản TKB mới. Tiến độ PPCT tiếp tục độc lập với phiên bản lịch.');
}
async function saveBaseline(id){const old=$state.data.baselines.find(b=>b.id===id);if(!old)return;const nextIndex=Number(document.getElementById(`base-${id}`)?.value);const updated={...old,nextIndex,confirmed:true};await persist('baselines',updated);notify(`Đã xác nhận mốc PPCT cho ${className(old.classId)} – ${old.subject} ${old.stream}.`);}
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
 const {date,shift,period}=$state.edit,get=id=>$('#'+id)?.value;
 const action=get('edit-action'),scope=get('edit-scope')||'following';
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
 const seq=ppctSequence($state.data,cls.grade,subject,stream),chosen=seq.find(p=>p.id===ppctId);
 if(ppctId&&!chosen)throw Error('Số tiết PPCT không thuộc môn/mạch/lớp đã chọn');
 const row={id:existing?.id||`C-${date}-${shift}${period}`,date,shift,period:Number(period),action,classId,subject,stream,kind:action==='ADD'?'MAKEUP':'MAIN',notes:get('edit-notes')||'',ppctId:action==='OFF'?'':ppctId,completed:action==='OFF'?false:completed,updatedAt:existing?.updatedAt||'',scope,titleOverride:get('edit-title')||''};
 const reason=get('edit-reason')||'';
 // Apply the weekly stream rule from NEXT Monday only. It never modifies confirmed historical cells.
 let rule=null;
 if(scope==='future'&&subject==='Toán'){
  const fromDate=addDays(monday(date),7),pattern=parseStreamPattern(get('edit-pattern'));
  if(!pattern.length)throw Error('Chọn C cần nhập mẫu ĐS/HH, ví dụ ĐS,ĐS,HH,ĐS');
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
 if($state.backendConfigured&&$state.mode!=='google')throw Error('Google Sheets chưa kết nối. Không được lưu vào dữ liệu mẫu thay cho dữ liệu chính. Vui lòng đăng nhập hoặc tải lại kết nối.');
 const requestId=form.dataset.requestId||(form.dataset.requestId=newRequestId());
 if($state.mode==='google'){
  const answer=await callApi({op:'mutateExtra',action,row,entityId:current?.recurring?current.patternId:current?.id||'',date:row?.date||$state.edit.date,
   requestId,expectedRevision:current?.revision||0,expectedOccurrenceRevision:current?.occurrenceRevision||0,...extra});
  if(!answer.ok||!answer.entityId)throw Error('Máy chủ chưa xác nhận bản ghi dạy thêm');
  // The server has already read the stored row. Refresh the full week view.
  try{await pullGoogle();}catch(err){throw Error(`Máy chủ đã xác nhận lưu (${answer.entityId}) nhưng tải lại chưa thành công: ${err.message}. Thử nút Tải lại Google Sheets, KHÔNG tạo thêm một suất mới.`);}
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
  repeatRule,endDate,lessonNumber,completed:Boolean($('#extra-completed').checked)};
 let action='CREATE';
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
 const form=$('#extra-form'),{date,shift,period}=$state.edit;
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
 try{
 if(a==='refresh-google'){
  if($state.mode!=='google')throw Error('Ứng dụng đang ở chế độ dùng thử, không phải Google Sheets. Vào Cấu hình & dữ liệu để đăng nhập máy chủ Production.');
  await pullGoogle();$state.week=monday('2026-11-09');$state.filterClass='all';$state.filterShift='all';$state.filterSubject='all';$state.filterKind='all';$state.filterStream='all';
  const count=eventsForWeek($state.data,$state.week).length;
  return notify(`Đồng bộ thành công: ${$state.data.slots.length} tiết gốc, tuần 10 hiển thị ${count} tiết. ${count===0?'Cần kiểm tra phiên bản hoặc định dạng dữ liệu.':''}`);
 }
 if(a==='toggle-drawer'){$state.drawerOpen=!$state.drawerOpen;return render();}
 if(a==='close-drawer'){$state.drawerOpen=false;return render();}
 if(a==='reset-filters'){$state.filterClass='all';$state.filterShift='all';$state.filterSubject='all';$state.filterStream='all';return render();}
 if(a==='fit-week'){$state.fitWeek=!$state.fitWeek;localStorage.setItem('smart-tkb-focus-v14',$state.fitWeek?'on':'off');return render();}
 if(a==='fullscreen-week'){if(!document.fullscreenElement){await document.documentElement.requestFullscreen?.();try{await screen.orientation?.lock?.('landscape')}catch{}}else{await document.exitFullscreen?.();}return fitWeekTable();}
 if(a==='layout-week'){$state.calendarLayout='week';return render();}
 if(a==='layout-day'){$state.calendarLayout='day';return render();}
 if(a==='select-day'){$state.dayIndex=Number(target.dataset.day);return render();}
 if(a==='prev-day'||a==='next-day'){$state.dayIndex=$state.dayIndex+(a==='prev-day'?-1:1);if($state.dayIndex<2){$state.week=addDays($state.week,-7);$state.dayIndex=8;}if($state.dayIndex>8){$state.week=addDays($state.week,7);$state.dayIndex=2;}return render();}
 if(a==='clear-notice'){$state.notice='';return render();}
 if(a==='open-settings'){$state.view='settings';return render();}
 if(a==='prev-week'||a==='next-week'){$state.week=addDays($state.week,a==='prev-week'?-7:7);return render();}
 if(a==='today'){$state.week=monday(new Date().toISOString().slice(0,10));return render();}
 if(a==='open-cell'){$state.edit={date:target.dataset.date,shift:target.dataset.shift,period:Number(target.dataset.period),type:target.dataset.editor||'official'};return render();}
 if(a==='close-modal'){$state.edit=null;return render();}
 if(a==='choose-extra'){$state.edit.type='extra';return render();}
 if(a==='choose-official'){$state.edit.type='official';return render();}
 if(a==='delete-extra')return await deleteExtra();
 if(a==='print')return window.print();
 if(a==='export')return exportCsv();
 if(a==='diagnose-extra'){if($state.mode!=='google')throw Error('Chưa kết nối Google Sheets');const r=await callApi({op:'diagnoseExtra'});return notify(`Google Sheets đang lưu ${r.patternCount} mẫu dạy thêm lặp và ${r.sessionCount} buổi/ngoại lệ. Yêu cầu ghi nhận: ${r.requestCount}.`);}
 if(a==='backup')return saveFile(`SmartTKB_sao_luu_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify($state.data,null,2),'application/json');
 if(a==='save-baseline')return await saveBaseline(target.dataset.id);
 if(a==='prepare-version')return await prepareDraft();
 if(a==='parse-excel')return await importExcel();
 if(a==='discard-version'){$state.pendingImport=null;return render();}
 if(a==='remove-draft-slot'){$state.pendingImport.slots=$state.pendingImport.slots.filter(s=>s.id!==target.dataset.id);return render();}
 if(a==='save-version')return await confirmDraft();
 if(a==='clear-change')return await clearEdit();
 if(a==='undo-official')return await undoOfficial(target.dataset.id);
 if(a==='export-statistics')return exportStatistics();
 if(a==='login'){const password=$('#login-pass')?.value;if(!password)throw Error('Nhập mật khẩu');const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const j=await r.json();if(!r.ok)throw Error(j.error||'Không đăng nhập được');try{await pullGoogle();notify('Đã kết nối Google Sheets.');}catch(e){notify('Đăng nhập thành công nhưng chưa đọc được dữ liệu. '+e.message);}return;}
 if(a==='logout'){await callApi({op:'logout'});location.reload();return;}
 if(a==='bootstrap'){if($state.mode!=='google')throw Error('Chưa kết nối Google');if(!window.confirm('Chỉ khởi tạo trên Google Sheets mới trống. Dữ liệu hiện có sẽ không được ghi đè. Tiếp tục?'))return;const seed=await fetch('/seed.json').then(r=>r.json());await callApi({op:'bootstrap',seed});await pullGoogle();return notify('Đã khởi tạo đầy đủ lớp, lịch và PPCT trên Google Sheets.');}
 }catch(e){console.error(e);notify('Lỗi: '+e.message);}
}
document.addEventListener('click',e=>{
 const target=e.target.closest('[data-view], [data-action]');if(!target)return;
 if(target.dataset.view){$state.view=target.dataset.view;$state.drawerOpen=false;$state.notice='';if($state.view==='calendar')$state.filterShift='all';render();return;}
 // backdrop click only when clicking backdrop itself, not its descendants
 if(target.classList.contains('backdrop')&&e.target!==target)return;
 doAction(target);
});
document.addEventListener('change',e=>{
 const table={'f-class':'filterClass','f-shift':'filterShift','f-subject':'filterSubject','f-kind':'filterKind','f-stream':'filterStream','ppct-grade':'ppctGrade','ppct-subject':'ppctSubject','ppct-stream':'ppctStream','stats-class':'statsClass','stats-subject':'statsSubject','stats-date':'statsDate','stats-period':'statsPeriod'};
 if(table[e.target.id]){$state[table[e.target.id]]=e.target.value;render();}
 if(e.target.closest('#extra-form')){delete e.target.form.dataset.requestId;updateExtraFormUI();}
 if(e.target.id==='extra-frequency')updateExtraFormUI();
 if(e.target.id==='only-extra'){$state.onlyExtra=e.target.checked;render();}
 if(['edit-action','edit-kind'].includes(e.target.id))updateEditorFields();
 if(e.target.id==='edit-class'||e.target.id==='edit-subject'||e.target.id==='edit-stream'){
  // The next render refreshes PPCT choices for the selected class/subject/stream; preserve edited selections.
  const classId=$('#edit-class').value,subject=$('#edit-subject').value,stream=subject==='Tin'?'TIN':$('#edit-stream').value;
  const cls=classById($state.data,classId),seq=ppctSequence($state.data,cls?.grade,subject,stream);
  const dropdown=$('#edit-ppct');dropdown.innerHTML='<option value="">Tự đề xuất theo tiến độ</option>'+seq.map(p=>`<option value="${esc(p.id)}">Tiết ${p.period}: ${esc(p.title)}</option>`).join('');
 }
});
document.addEventListener('input',e=>{if(e.target.closest('#extra-form')){delete e.target.form.dataset.requestId;updateExtraFormUI();}if(e.target.id==='ppct-query'){$state.ppctQuery=e.target.value;const pos=e.target.selectionStart;render();const input=$('#ppct-query');input?.focus();input?.setSelectionRange(pos,pos);}});
document.addEventListener('submit',async e=>{if(!['edit-form','extra-form'].includes(e.target.id))return;e.preventDefault();try{if(e.target.id==='extra-form')await saveExtra();else await saveEdit();}catch(err){console.error(err);if(e.target.id==='extra-form'){const box=$('#extra-error');if(box){box.hidden=false;box.textContent='Không thể hoàn tất: '+err.message;}const state=$('#extra-status');if(state)state.textContent='Nội dung thầy vừa nhập vẫn được giữ nguyên để sửa hoặc thử lại.';}else notify('Lỗi: '+err.message);}});
init().catch(err=>{$('#app').innerHTML=`<p class="fatal">Không khởi động được ứng dụng: ${esc(err.message)}</p>`;});
