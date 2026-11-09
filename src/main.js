
import {DAYS,SHIFTS,addDays,monday,schoolWeek,classById,activeVersion,eventsForWeek,conflicts,ppctSequence,parseDate} from './core.js';
import {extractTeacherSchedule} from './importExcel.js';

const $=s=>document.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $state={data:null,mode:'demo',view:'calendar',week:monday('2026-11-09'),filterClass:'all',filterShift:'all',filterSubject:'all',filterKind:'all',filterStream:'all',notice:'',edit:null,pendingImport:null,ppctGrade:'7',ppctSubject:'Toán',ppctStream:'all',ppctQuery:'',loggedIn:false};
const shiftLabel=s=>({S:'Sáng',C:'Chiều',T:'Tối'})[s]||s;
const dayLabel=n=>DAYS.find(d=>d.n===n)?.label||n;
const className=id=>classById($state.data,id)?.name||id;
const options=(values,current)=>values.map(([value,label])=>`<option value="${esc(value)}" ${current===value?'selected':''}>${esc(label)}</option>`).join('');
const CLASS_OPTS=()=>[['all','Tất cả lớp'],...($state.data?.classes||[]).map(c=>[c.id,`${c.name} (${c.id})`])];
const weekEnd=()=>addDays($state.week,6);
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
async function pullGoogle(){const r=await fetch('/api/tkb');const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'Không thể đọc dữ liệu Google');$state.data=j.data;$state.mode='google';$state.loggedIn=true;}
async function init(){
 try{const sess=await fetch('/api/tkb?action=session').then(r=>r.json());if(sess.authenticated&&sess.backendConfigured)await pullGoogle();}catch(e){console.info('Đang dùng chế độ demo:',e.message);}
 if(!$state.data){const seed=await fetch('/seed.json').then(r=>r.json());const saved=localStorage.getItem('smart-tkb-demo-v1');try{$state.data=saved?JSON.parse(saved):seed;}catch{$state.data=seed;} $state.mode='demo';}
 render();
}
function showTop(){const d=$state.data;const events=eventsForWeek(d,$state.week),err=conflicts(events);
 return `<header class="topbar"><div class="brandmark">TK</div><div class="brandtext"><h1>Smart TKB<span>·</span> Giáo viên</h1><p>THCS Nam Nha Trang – Phân hiệu Vĩnh Trường</p></div><div class="topright"><span class="pill ${$state.mode==='google'?'good':'muted'}">${$state.mode==='google'?'● Google Sheets':'○ Chế độ dùng thử'}</span><button class="btn ghost" data-action="open-settings">${$state.mode==='google'?'Đã kết nối':'Kết nối Google'}</button></div></header>
 <div class="shell"><aside class="sidebar"><div class="navtitle">QUẢN LÝ GIẢNG DẠY</div>
 ${[['calendar','▦','Thời khóa biểu'],['progress','◷','PPCT & tiến độ'],['versions','⇄','Phiên bản TKB'],['settings','⚙','Cấu hình & dữ liệu']].map(([k,icon,label])=>`<button class="navitem ${$state.view===k?'selected':''}" data-view="${k}"><span class="navicon">${icon}</span>${label}</button>`).join('')}
 <div class="sidefooter"><div class="stat-label">Năm học 2026 – 2027</div><div class="stat-desc">7 lớp · 4 PPCT · 7 ngày/tuần<br>Sáng 5 tiết · Chiều 5 tiết · Tối 2 suất</div></div></aside><main class="content">${$state.notice?`<div class="notice">${esc($state.notice)}<button data-action="clear-notice">×</button></div>`:''}
 ${$state.view==='calendar'?calendarPage(events,err):$state.view==='progress'?progressPage():$state.view==='versions'?versionsPage():settingsPage()}
 </main></div>`;
}
function calendarPage(events,error){
 const version=activeVersion($state.data,$state.week);
 const filtered=events.filter(e=>($state.filterClass==='all'||$state.filterClass===e.classId)&&($state.filterShift==='all'||$state.filterShift===e.shift)&&($state.filterSubject==='all'||$state.filterSubject===e.subject)&&($state.filterKind==='all'||($state.filterKind==='MAIN'?(e.kind==='MAIN'):e.kind!=='MAIN'))&&($state.filterStream==='all'||e.stream===$state.filterStream));
 const activeShifts=SHIFTS.filter(s=>$state.filterShift==='all'||s.id===$state.filterShift);
 const conflictKeys=new Set(conflicts(events).map(c=>c.key));
 const occupied=events.filter(e=>e.status!=='OFF').length,completed=events.filter(e=>e.status==='DONE').length;
 const renderCell=(day,s,p)=>{
  const date=addDays($state.week,day-2);const all=filtered.filter(e=>e.date===date&&e.shift===s&&e.period===p);
  const hasConflict=conflictKeys.has(`${date}|${s}|${p}`);
  return `<td><button class="cell ${all.length?'filled':''} ${hasConflict?'conflict':''}" title="${esc(dayLabel(day)+' '+shiftLabel(s)+' '+p)}" data-action="edit" data-date="${date}" data-shift="${s}" data-period="${p}">
    ${all.map(e=>`<span class="lesson ${e.subject==='Toán'?'math':'ict'} ${e.status==='OFF'?'off':''}">
     <span class="lesson-name">${esc(e.subject)} ${esc(className(e.classId))}</span>
     <span class="lesson-sub">${e.subject==='Toán'?`<b>${esc(e.stream||'ĐS/HH?')}</b> · `:''}${e.status==='OFF'?'NGHỈ':e.status==='DONE'?'ĐÃ DẠY':e.ppct?`Tiết ${esc(e.ppct.period)}`:e.kind==='EXTRA'?'Dạy thêm':'Chưa gán PPCT'}</span>
     <span class="lesson-title">${esc(e.notes&&e.kind==='EXTRA'?e.notes:(e.ppct?.title||''))}</span>
    </span>`).join('')||'<span class="addmark">+</span>'}
    ${hasConflict?'<span class="alert-dot" title="Trùng tiết">!</span>':''}</button></td>`;
 };
 return `<div class="pagehead"><div><div class="eyebrow">THỜI KHÓA BIỂU CÁ NHÂN</div><h2>Lịch dạy của thầy</h2><p>Tự động kế thừa lịch chính khóa theo phiên bản; dạy thêm và dạy bù nhập riêng từng ngày.</p></div><div class="actions"><button class="btn soft" data-action="print">⎙ In lịch</button><button class="btn primary" data-action="export">↓ Xuất CSV</button></div></div>
 <div class="metrics"><div class="metric"><span>Tiết có lịch</span><strong>${occupied}</strong><small>Trong tuần đang xem</small></div><div class="metric"><span>Đã xác nhận dạy</span><strong>${completed}</strong><small>Cần thầy xác nhận từng tiết</small></div><div class="metric"><span>Phiên bản áp dụng</span><strong class="metric-version">${esc(version?.name||'Chưa có TKB')}</strong><small>Tuần ${schoolWeek($state.week)}</small></div><div class="metric ${error.length?'metric-warn':''}"><span>Trùng tiết</span><strong>${error.length}</strong><small>${error.length?'Cần kiểm tra trước khi chốt':'Lịch hiện không bị trùng'}</small></div></div>
 <section class="panel"><div class="weekbar"><div class="weekchange"><button class="arrow" data-action="prev-week" aria-label="Tuần trước">‹</button><div><strong>Tuần ${schoolWeek($state.week)} · ${fmt($state.week)} – ${fmt(weekEnd())}</strong><span>Năm học 2026–2027 · từ Thứ 2 đến Chủ nhật</span></div><button class="arrow" data-action="next-week" aria-label="Tuần sau">›</button></div><button class="btn soft" data-action="today">Tuần hiện tại</button></div>
 <div class="filters"><div><label>Lớp</label><select id="f-class">${options(CLASS_OPTS(),$state.filterClass)}</select></div><div><label>Buổi</label><select id="f-shift">${options([['all','Cả ngày'],['S','Buổi sáng'],['C','Buổi chiều'],['T','Buổi tối']],$state.filterShift)}</select></div><div><label>Môn</label><select id="f-subject">${options([['all','Cả hai môn'],['Toán','Toán'],['Tin','Tin']],$state.filterSubject)}</select></div><div><label>Loại lịch</label><select id="f-kind">${options([['all','Tất cả'],['MAIN','Chính khóa'],['OTHER','Dạy thêm / bù']],$state.filterKind)}</select></div><div><label>Mạch Toán</label><select id="f-stream">${options([['all','ĐS + HH'],['ĐS','Đại số'],['HH','Hình học'],['TIN','Tin học']],$state.filterStream)}</select></div></div>
 ${error.length?`<div class="warning">⚠ Phát hiện ${error.length} ô trùng tiết: ${error.map(c=>{const e=c.items[0];return `${fmt(e.date)} ${shiftLabel(e.shift)} ${e.period} (${c.items.map(x=>`${x.subject} ${className(x.classId)}`).join(' / ')})`}).join('; ')}. Ứng dụng không tự ý đổi lịch.</div>`:''}
 <div class="table-scroller"><table class="timetable"><thead><tr><th class="sidecol">Ca</th>${DAYS.map(d=>`<th>${d.label}<small>${fmt(addDays($state.week,d.n-2))}</small></th>`).join('')}</tr></thead><tbody>
 ${activeShifts.map(sh=>Array.from({length:sh.count},(_,i)=>`<tr><th class="period-label"><span>${sh.label}</span><strong>${sh.id==='T'?'Suất':'Tiết'} ${i+1}</strong></th>${DAYS.map(d=>renderCell(d.n,sh.id,i+1)).join('')}</tr>`).join('')).join('')}
 </tbody></table></div><div class="legend"><span><i class="dot blue"></i> Toán</span><span><i class="dot green"></i> Tin</span><span><i class="dot red"></i> Trùng tiết</span><span>Nhấn vào ô để nghỉ / dạy bù / thêm tiết</span></div></section>`;
}
function fmt(date){const [y,m,d]=date.split('-');return `${d}/${m}`;}
function progressPage(){const d=$state.data;const list=(d.ppct||[]).filter(e=>String(e.grade)===$state.ppctGrade&&e.subject===$state.ppctSubject&&($state.ppctStream==='all'||e.stream===$state.ppctStream)&&e.title.toLowerCase().includes($state.ppctQuery.toLowerCase())).sort((a,b)=>a.week-b.week||a.period-b.period);
 const bs=(d.baselines||[]).filter(b=>{const c=classById(d,b.classId);return String(c?.grade)===$state.ppctGrade&&b.subject===$state.ppctSubject;});
 return `<div class="pagehead"><div><div class="eyebrow">PHÂN PHỐI CHƯƠNG TRÌNH</div><h2>PPCT & tiến độ lớp học</h2><p>Toán chia thành Đại số và Hình học; Tin học dùng chuỗi bài riêng. Dữ liệu trích từ 4 file gốc.</p></div></div>
 <section class="panel"><div class="panelheading"><h3>Thiết lập điểm bắt đầu theo từng lớp</h3><p>Vì ứng dụng bắt đầu từ tuần 10, phải xác nhận tiết PPCT tiếp theo thực tế của từng lớp trước khi tự động dồn bài.</p></div><div class="baseline-grid">${bs.map(b=>{const c=classById(d,b.classId);const seq=ppctSequence(d,c.grade,b.subject,b.stream);return `<div class="baseline-item"><div class="base-header"><strong>${esc(c.name)} · ${esc(b.stream)}</strong><span class="state ${b.confirmed?'ok':'pending'}">${b.confirmed?'Đã xác nhận':'Cần xác nhận'}</span></div><select id="base-${esc(b.id)}">${seq.map((p,i)=>`<option value="${i}" ${i===Number(b.nextIndex)?'selected':''}>Tiết ${p.period} · ${esc(p.title).slice(0,65)}</option>`).join('')}</select><button class="btn small" data-action="save-baseline" data-id="${esc(b.id)}">Lưu & xác nhận</button></div>`;}).join('')}</div></section>
 <section class="panel"><div class="panelheading"><h3>Danh mục PPCT đã nhập</h3><p>Có thể tìm theo tên bài hoặc lọc theo mạch ĐS / HH.</p></div><div class="filters ppct-filters"><div><label>Khối</label><select id="ppct-grade">${options([['7','Khối 7'],['9','Khối 9']],$state.ppctGrade)}</select></div><div><label>Môn</label><select id="ppct-subject">${options([['Toán','Toán'],['Tin','Tin']],$state.ppctSubject)}</select></div><div><label>Mạch</label><select id="ppct-stream">${options([['all','Tất cả'],['ĐS','Đại số'],['HH','Hình học'],['TIN','Tin học']],$state.ppctStream)}</select></div><div class="searchfield"><label>Tìm bài học</label><input id="ppct-query" placeholder="Ví dụ: căn bậc hai" value="${esc($state.ppctQuery)}"/></div></div>
 <div class="table-scroller"><table class="data-table"><thead><tr><th>Tuần</th><th>Mạch</th><th>Tiết PPCT</th><th>Tên bài học / chủ đề</th></tr></thead><tbody>${list.slice(0,350).map(e=>`<tr><td>${esc(e.week)}</td><td><span class="tag">${esc(e.stream)}</span></td><td>${esc(e.period)}</td><td>${esc(e.title)}</td></tr>`).join('')}</tbody></table></div><p class="caption">Hiển thị ${list.length} mục. Thầy cần kiểm tra kết quả đọc PDF/Word, đặc biệt các mốc kiểm tra và PPCT Tin 9 không tuần tự.</p></section>`;
}
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
 <section class="panel"><div class="panelheading"><h3>Sao lưu</h3><p>Xuất toàn bộ dữ liệu để lưu an toàn; có thể mở bằng trình soạn thảo JSON.</p></div><button class="btn soft full" data-action="backup">↓ Tải bản sao JSON</button><button class="btn ghost full" data-action="print">⎙ In thời khóa biểu hiện tại</button></section></div>
 <section class="panel"><div class="panelheading"><h3>Lớp đang phụ trách</h3></div><div class="class-grid">${$state.data.classes.map(c=>`<div class="class-card"><div class="class-symbol">${esc(c.grade)}</div><div><strong>${esc(c.name)} <small>${esc(c.id)}</small></strong><div>${esc(c.subjects.join(' · '))}</div></div></div>`).join('')}</div></section>`;
}
function modal(){if(!$state.edit)return '';
 const {date,shift,period}= $state.edit;
 const events=eventsForWeek($state.data,monday(date)).filter(e=>e.date===date&&e.shift===shift&&e.period===Number(period));
 const e=events[0],ch=($state.data.changes||[]).find(x=>x.date===date&&x.shift===shift&&x.period===Number(period));
 const action=ch?.action||(!e?'ADD':e.kind!=='MAIN'?'ADD':'DONE');const classId=ch?.classId||e?.classId||'7F38';const subject=ch?.subject||e?.subject||'Toán';const stream=ch?.stream||e?.stream||'ĐS';
 const lessons=ppctSequence($state.data,classById($state.data,classId)?.grade||7,subject,subject==='Tin'?'TIN':stream);
 const suggested=e?.ppct?.id||'';
 return `<div class="backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading"><div class="modalhead"><div><div class="eyebrow">CHỈNH SỬA TIẾT HỌC</div><h3 id="modal-heading">${fmt(date)} · ${shiftLabel(shift)} · ${shift==='T'?'Suất':'Tiết'} ${period}</h3></div><button class="icon-btn" data-action="close-modal" aria-label="Đóng">×</button></div>
 ${e?`<div class="current-lesson"><strong>${esc(e.subject)} ${esc(className(e.classId))} ${esc(e.stream||'')}</strong><span>${esc(e.ppct?.title||'Chưa có nội dung PPCT')}</span><small>${e.kind==='MAIN'?'Chính khóa':e.kind==='MAKEUP'?'Dạy bù':'Dạy thêm'}</small></div>`:'<div class="current-lesson">Ô hiện đang trống. Có thể thêm buổi dạy thêm hoặc dạy bù.</div>'}
 <form id="edit-form"><div class="formgrid"><div class="wide"><label>Hành động</label><select id="edit-action">${options([...(e&&e.kind==='MAIN'?[['DONE','Đã dạy theo PPCT'],['OFF','Nghỉ tiết (không tăng PPCT)'],['EDIT','Điều chỉnh bài / lớp trong ngày']]:[]),['ADD','Thêm tiết dạy thêm / dạy bù']],action)}</select></div>
 <div><label>Lớp</label><select id="edit-class">${options(CLASS_OPTS().slice(1),classId)}</select></div>
 <div><label>Môn</label><select id="edit-subject">${options([['Toán','Toán'],['Tin','Tin']],subject)}</select></div>
 <div><label>Mạch kiến thức</label><select id="edit-stream">${options([['ĐS','Đại số'],['HH','Hình học'],['TIN','Tin học']],stream)}</select></div>
 <div><label>Loại tiết thêm</label><select id="edit-kind">${options([['EXTRA','Dạy thêm'],['MAKEUP','Dạy bù chính khóa']],ch?.kind||'EXTRA')}</select></div>
 <div class="wide"><label>Nội dung PPCT (tùy chọn)</label><select id="edit-ppct"><option value="">Tự đề xuất theo tiến độ</option>${lessons.map(p=>`<option value="${esc(p.id)}" ${(ch?.ppctId||suggested)===p.id?'selected':''}>Tiết ${p.period}: ${esc(p.title).slice(0,86)}</option>`).join('')}</select></div>
 <div class="wide"><label><input type="checkbox" id="edit-completed" ${ch?.completed?'checked':''} /> Đã thực hiện tiết dạy thêm / dạy bù (chỉ áp dụng khi chọn Thêm tiết)</label></div>
 <div class="wide"><label>Ghi chú (dạy thêm có thể ghi tên chủ đề)</label><textarea id="edit-notes" rows="2" placeholder="Ví dụ: nghỉ họp hội đồng, dạy bù tiết HH...">${esc(ch?.notes||'')}</textarea></div></div>
 <div class="modalactions"><button type="button" class="btn ghost" data-action="close-modal">Đóng</button>${ch?'<button type="button" class="btn danger" data-action="clear-change">Xóa điều chỉnh</button>':''}<button type="submit" class="btn primary">Lưu thay đổi</button></div></form></section></div>`;
}
function render(){if(!$state.data)return;$('#app').innerHTML=showTop()+modal();}
function saveFile(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),300);}
async function exportCsv(){const events=eventsForWeek($state.data,$state.week);const headers=['Ngày','Buổi','Tiết / Suất','Lớp','Môn','Mạch','Loại','Trạng thái','Tiết PPCT','Bài học','Ghi chú'];const csv=[headers,...events.map(e=>[e.date,shiftLabel(e.shift),e.period,className(e.classId),e.subject,e.stream,e.kind,e.status,e.ppct?.period||'',e.ppct?.title||'',e.notes||''])].map(a=>a.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');saveFile(`SmartTKB_Tuan${schoolWeek($state.week)}.csv`,'\ufeff'+csv,'text/csv;charset=utf-8');}
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
async function saveEdit(){const {date,shift,period}=$state.edit;const get=id=>$('#'+id)?.value;const action=get('edit-action');const existing=($state.data.changes||[]).find(x=>x.date===date&&x.shift===shift&&x.period===Number(period));
 const classId=get('edit-class'),subject=get('edit-subject'),stream=subject==='Tin'?'TIN':get('edit-stream');const cls=classById($state.data,classId);if(!cls||!cls.subjects.includes(subject))throw Error('Lớp được chọn không học môn này với thầy');
 const before=eventsForWeek($state.data,monday(date)).filter(e=>e.date===date&&e.shift===shift&&e.period===Number(period));
 if(action==='ADD'&&before.some(e=>e.status!=='OFF'&&e.changeId!==existing?.id))throw Error('Ô đã có lịch. Không thể thêm một lớp mới vào cùng thời điểm.');
 if(action!=='ADD'&&!before.length)throw Error('Ô trống; hãy chọn Thêm tiết');
 const row={id:existing?.id||`C-${date}-${shift}${period}`,date,shift,period:Number(period),action,classId,subject,stream,kind:action==='ADD'?get('edit-kind'):(before[0]?.kind||'MAIN'),notes:get('edit-notes')||'',ppctId:get('edit-ppct')||'',completed:action==='DONE'||(action==='ADD'&&Boolean($('#edit-completed')?.checked)),updatedAt:new Date().toISOString()};
 if(action==='ADD'&&row.kind==='MAKEUP'&&!row.stream)throw Error('Chọn mạch PPCT cần dạy bù');
 await persist('changes',row);$state.edit=null;notify('Đã ghi nhận thay đổi. Nội dung PPCT của các tiết sau được tính lại theo mạch môn học.');
}
async function clearEdit(){const {date,shift,period}=$state.edit;const existing=($state.data.changes||[]).find(x=>x.date===date&&x.shift===shift&&x.period===Number(period));if(!existing)return;
 // Clearing overrides is represented by CLEAR (kept for audit history); merge logic skips CLEAR.
 await persist('changes',{...existing,action:'CLEAR',notes:'Đã xóa điều chỉnh',ppctId:'',updatedAt:new Date().toISOString()});$state.edit=null;notify('Đã xóa điều chỉnh, trả ô về lịch chính khóa gốc (nếu có).');
}
async function doAction(target){const a=target.dataset.action;if(!a)return;
 try{
 if(a==='clear-notice'){$state.notice='';return render();}
 if(a==='open-settings'){$state.view='settings';return render();}
 if(a==='prev-week'||a==='next-week'){$state.week=addDays($state.week,a==='prev-week'?-7:7);return render();}
 if(a==='today'){$state.week=monday(new Date().toISOString().slice(0,10));return render();}
 if(a==='edit'){$state.edit={date:target.dataset.date,shift:target.dataset.shift,period:Number(target.dataset.period)};return render();}
 if(a==='close-modal'){$state.edit=null;return render();}
 if(a==='print')return window.print();
 if(a==='export')return exportCsv();
 if(a==='backup')return saveFile(`SmartTKB_sao_luu_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify($state.data,null,2),'application/json');
 if(a==='save-baseline')return await saveBaseline(target.dataset.id);
 if(a==='prepare-version')return await prepareDraft();
 if(a==='parse-excel')return await importExcel();
 if(a==='discard-version'){$state.pendingImport=null;return render();}
 if(a==='remove-draft-slot'){$state.pendingImport.slots=$state.pendingImport.slots.filter(s=>s.id!==target.dataset.id);return render();}
 if(a==='save-version')return await confirmDraft();
 if(a==='clear-change')return await clearEdit();
 if(a==='login'){const password=$('#login-pass')?.value;if(!password)throw Error('Nhập mật khẩu');const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const j=await r.json();if(!r.ok)throw Error(j.error||'Không đăng nhập được');try{await pullGoogle();notify('Đã kết nối Google Sheets.');}catch(e){notify('Đăng nhập thành công nhưng chưa đọc được dữ liệu. '+e.message);}return;}
 if(a==='logout'){await callApi({op:'logout'});location.reload();return;}
 if(a==='bootstrap'){if($state.mode!=='google')throw Error('Chưa kết nối Google');if(!window.confirm('Chỉ khởi tạo trên Google Sheets mới trống. Dữ liệu hiện có sẽ không được ghi đè. Tiếp tục?'))return;const seed=await fetch('/seed.json').then(r=>r.json());await callApi({op:'bootstrap',seed});await pullGoogle();return notify('Đã khởi tạo đầy đủ lớp, lịch và PPCT trên Google Sheets.');}
 }catch(e){console.error(e);notify('Lỗi: '+e.message);}
}
document.addEventListener('click',e=>{
 const target=e.target.closest('[data-view], [data-action]');if(!target)return;
 if(target.dataset.view){$state.view=target.dataset.view;$state.notice='';render();return;}
 // backdrop click only when clicking backdrop itself, not its descendants
 if(target.classList.contains('backdrop')&&e.target!==target)return;
 doAction(target);
});
document.addEventListener('change',e=>{
 const table={'f-class':'filterClass','f-shift':'filterShift','f-subject':'filterSubject','f-kind':'filterKind','f-stream':'filterStream','ppct-grade':'ppctGrade','ppct-subject':'ppctSubject','ppct-stream':'ppctStream'};
 if(table[e.target.id]){$state[table[e.target.id]]=e.target.value;render();}
 if(e.target.id==='edit-class'||e.target.id==='edit-subject'||e.target.id==='edit-stream'){
  // The next render refreshes PPCT choices for the selected class/subject/stream; preserve edited selections.
  const classId=$('#edit-class').value,subject=$('#edit-subject').value,stream=subject==='Tin'?'TIN':$('#edit-stream').value;
  const cls=classById($state.data,classId),seq=ppctSequence($state.data,cls?.grade,subject,stream);
  const dropdown=$('#edit-ppct');dropdown.innerHTML='<option value="">Tự đề xuất theo tiến độ</option>'+seq.map(p=>`<option value="${esc(p.id)}">Tiết ${p.period}: ${esc(p.title)}</option>`).join('');
 }
});
document.addEventListener('input',e=>{if(e.target.id==='ppct-query'){$state.ppctQuery=e.target.value;const pos=e.target.selectionStart;render();const input=$('#ppct-query');input?.focus();input?.setSelectionRange(pos,pos);}});
document.addEventListener('submit',async e=>{if(e.target.id!=='edit-form')return;e.preventDefault();try{await saveEdit()}catch(err){notify('Lỗi: '+err.message)}});
init().catch(err=>{$('#app').innerHTML=`<p class="fatal">Không khởi động được ứng dụng: ${esc(err.message)}</p>`;});
