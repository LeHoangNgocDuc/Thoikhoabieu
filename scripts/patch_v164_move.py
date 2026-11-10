from pathlib import Path
p=Path('/mnt/data/tkb_v164_work'); f=p/'src/main.js'; s=f.read_text()
# Add source-specific conflict editor.
s=s.replace("if($state.edit.type==='choose'){", "if($state.edit.type==='move')return moveModal();\n if($state.edit.type==='choose'){",1)
needle='function extraModal(){'
insert='''function moveModal(){
 const {date,sourceSlotId}=$state.edit;
 const event=eventsForWeek($state.data,monday(date)).find(e=>e.date===date&&e.id===sourceSlotId);
 if(!event)return `<div class="backdrop"><section class="modal"><p>Không tìm thấy tiết nguồn. Hãy tải lại dữ liệu.</p><button data-action="close-modal" class="btn soft">Đóng</button></section></div>`;
 const days=DAYS.map(d=>[addDays(monday(date),d.n-2),`${d.label} · ${fmt(addDays(monday(date),d.n-2))}`]);
 return `<div class="backdrop" data-action="close-modal"><section class="modal move-editor" role="dialog" aria-modal="true" aria-label="Dời một tiết bị trùng lịch"><div class="modalhead"><h3>Dời đúng tiết chính khóa</h3><button data-action="close-modal" class="icon-btn">×</button></div>
 <p>Tiết được chọn: <strong>${esc(event.subject)} ${esc(className(event.classId))} ${esc(event.stream||'')} · PPCT ${esc(event.ppct?.period||'—')}</strong>.</p><p>Vị trí cũ: ${fmt(date)}, ${shiftLabel(event.shift)} tiết ${event.period}. Chỉ dời một lần; không tự cộng hoặc xóa PPCT.</p>
 <form id="move-form"><div class="formgrid"><div><label for="move-date">Ngày mới</label><select id="move-date">${options(days,date)}</select></div>
 <div><label for="move-shift">Buổi mới</label><select id="move-shift">${options([['S','Sáng'],['C','Chiều'],['T','Tối']],event.shift)}</select></div>
 <div><label for="move-period">Tiết / Suất mới</label><select id="move-period">${options([[1,'1'],[2,'2'],[3,'3'],[4,'4'],[5,'5']],1)}</select></div>
 <div class="wide"><p class="formhint">Chọn một ô trống trong tuần. Hệ thống kiểm tra xung đột trước khi lưu vào Google Sheets.</p></div></div><div class="modalactions"><button class="btn ghost" type="button" data-action="close-modal">Hủy</button><button class="btn primary" type="submit">Dời sang ô đã chọn</button></div></form></section></div>`;
}
async function saveMove(){
 if($state.mode!=='google')throw Error('Cần đăng nhập Google Sheets trước khi dời tiết chính khóa.');
 const {date,sourceSlotId}=$state.edit;
 const toDate=$('#move-date')?.value,shift=$('#move-shift')?.value,period=Number($('#move-period')?.value);
 const row=moveCollision($state.data,sourceSlotId,date,toDate,shift,period);
 if(!window.confirm(`Dời đúng lớp ${className(row.classId)}: ${fmt(date)}, ${shiftLabel(row.shift)} tiết ${row.period} → ${fmt(toDate)}, ${shiftLabel(shift)} tiết ${period}?\\nCác tuần sau và PPCT đã xác nhận không thay đổi.`))return;
 const existing=$state.data.changes.find(x=>x.id===row.id);
 await callApi({op:'saveOfficialChange',row:{...row,updatedAt:existing?.updatedAt||''},expectedUpdatedAt:existing?.updatedAt||'',reason:'Điều chỉnh xung đột thời khóa biểu'});
 await pullGoogle();$state.edit=null;notify('Đã dời riêng tiết được chọn, giữ nguyên vị trí các tiết khác và tiến độ PPCT.');
}
'''
if needle not in s:raise Exception('No extra modal');s=s.replace(needle,insert+needle,1)
# enrich conflict details with precise ids and per row UI
start=s.index('${error.length?`<details class="warning compact-warning">');end=s.index('${$state.calendarLayout',start)
s=s[:start]+'''${error.length?`<details class="warning compact-warning"><summary>⚠ Có ${error.length} vị trí trùng lịch (nhấn để chọn tiết cần dời)</summary>
 ${error.map(c=>{const e=c.items[0];return `<div class="conflict-resolve"><strong>${fmt(e.date)} ${shiftLabel(e.shift)} tiết ${e.period}</strong><div class="conflict-options">${c.items.map(x=>`<div>${esc(x.kind==='EXTRA'?'Dạy thêm '+parseGroups(x.groups).join(', '):x.subject+' '+className(x.classId)+' '+(x.stream||''))} ${x.kind==='MAIN'?`<button class="btn soft" data-action="start-move" data-id="${esc(x.id)}" data-date="${esc(x.date)}">Dời tiết này</button>`:'<span class="caption">Sửa trong Dạy thêm</span>'}</div>`).join('')}</div></div>`}).join('')}</details>`:''}
 '''+s[end:]
# enforce cached status and proper selection when opening collision cell
s=s.replace("if(a==='open-cell'){$state.edit={date:target.dataset.date", "if(a==='start-move'){if($state.mode!=='google')throw Error('Cần đăng nhập để dời tiết');$state.edit={type:'move',date:target.dataset.date,sourceSlotId:target.dataset.id};return render();}\n if(a==='open-cell'){$state.edit={date:target.dataset.date",1)
# submit handler: add move-form and error handling
s=s.replace("if(!['edit-form','extra-form'].includes(e.target.id))return;", "if(!['edit-form','extra-form','move-form'].includes(e.target.id))return;",1)
s=s.replace("if(e.target.id==='extra-form')await saveExtra();else await saveEdit();", "if(e.target.id==='extra-form')await saveExtra();else if(e.target.id==='move-form')await saveMove();else await saveEdit();",1)
# Extra no demo, correct no fake save: make direct requirement, not local fallback.
s=s.replace("if($state.backendConfigured&&$state.mode!=='google')throw Error('Google Sheets chưa kết nối. Không được lưu vào dữ liệu mẫu thay cho dữ liệu chính. Vui lòng đăng nhập hoặc tải lại kết nối.');", "if($state.mode!=='google')throw Error('Google Sheets chưa kết nối. Vui lòng đăng nhập hoặc đồng bộ trước khi lưu.');",1)
# Cache panel note
f.write_text(s)
# make source stream in moveCollision fully assigned
f=p/'src/core.js';s=f.read_text()
s=s.replace("return {id:`MOVE-${sourceDate}-${sourceSlotId}`,date:sourceDate,shift:slot.shift,period:Number(slot.period),action:'MOVE',classId:slot.classId,subject:slot.subject,stream:slot.stream||'ĐS'", "const computed=eventsForWeek(state,monday(sourceDate)).find(e=>e.id===sourceSlotId&&e.date===sourceDate);\n return {id:`MOVE-${sourceDate}-${sourceSlotId}`,date:sourceDate,shift:slot.shift,period:Number(slot.period),action:'MOVE',classId:slot.classId,subject:slot.subject,stream:computed?.stream||(slot.subject==='Tin'?'TIN':'ĐS')",1)
f.write_text(s)
print('Added movement UI')
