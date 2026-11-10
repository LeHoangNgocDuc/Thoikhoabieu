/** Smart TKB backend: paste into Google Apps Script bound to the target spreadsheet.
 * Script properties: SMART_TKB_API_KEY (must match GAS_API_KEY in Vercel).
 * Deploy > New deployment > Web app > Execute as me > Anyone.
 */
const SMART_TKB_SERVER_VERSION='1.6.4';
const EXTRA_OPS=['CREATE','EDIT_ONCE','EDIT_FUTURE','EDIT_ALL','CONVERT_ONCE','CANCEL_ONCE','STOP_FUTURE','DELETE_SERIES','DELETE_ONE'];
const TABLES={
  classes:['id','name','grade','subjects'],
  versions:['id','name','fromDate','toDate','notes'],
  slots:['id','versionId','day','shift','period','classId','subject','stream','kind','notes'],
  ppct:['id','grade','subject','stream','week','period','title','note','source'],
  baselines:['id','classId','subject','stream','fromDate','nextIndex','confirmed'],
  changes:['id','date','shift','period','action','classId','subject','stream','kind','notes','ppctId','completed','updatedAt','scope','titleOverride','sourceSlotId','moveDate','moveShift','movePeriod'],
  extra_sessions:['id','date','shift','period','subject','groups','notes','completed','updatedAt','patternId','action','lessonNumber','classIds','customGroups','lessonTitle','startTime','endTime','repeatRule','revision','requestId'],
  extra_patterns:['id','day','shift','period','subject','groups','notes','fromDate','toDate','startLesson','active','updatedAt','classIds','customGroups','lessonTitle','startTime','endTime','repeatRule','revision','requestId'],
  extra_requests:['id','action','entityId','createdAt','resultJson','payloadHash'],
  ppct_overrides:['id','classId','subject','fromDate','toDate','pattern','notes','updatedAt'],
  audit_log:['id','at','actor','action','entityType','entityId','oldValue','newValue','reason']
};
const NUMERIC={classes:['grade'],slots:['day','period'],ppct:['grade','week','period'],baselines:['nextIndex'],changes:['period','movePeriod'],extra_sessions:['period','lessonNumber'],extra_patterns:['day','period','startLesson']};
function doGet(){return json_({ok:true,message:'Smart TKB Apps Script đã triển khai. Dùng API qua Vercel.',apiVersion:SMART_TKB_SERVER_VERSION});}
function doPost(e){
 try{
  if(!e.postData||!e.postData.contents)throw Error('Thiếu dữ liệu');
  if(e.postData.contents.length>1500000)throw Error('Dữ liệu quá lớn');
  const body=JSON.parse(e.postData.contents);
  const secret=PropertiesService.getScriptProperties().getProperty('SMART_TKB_API_KEY');
  if(!secret||body.apiKey!==secret)throw Error('Không có quyền truy cập API');
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('Hệ thống bận, thử lại');
  try{
   initSheets_();
   if(body.op==='load')return json_({ok:true,data:readAll_(),apiVersion:SMART_TKB_SERVER_VERSION});
   if(body.op==='probeExtra')return json_({ok:true,apiVersion:SMART_TKB_SERVER_VERSION,extraWrites:true,
    supportedActions:EXTRA_OPS, tables:{extraPatterns:read_('extra_patterns').length,extraSessions:read_('extra_sessions').length,extraRequests:read_('extra_requests').length},message:'Apps Script V1.6.4 có xác minh dữ liệu và lịch lặp',verifiedWrites:true});
   if(body.op==='mutateExtra')return json_(mutateExtra_(body));
   if(body.op==='extraStatus')return json_(extraStatus_(body.requestId));
   if(body.op==='listExtra')return json_(extraList_(body.week));
   if(body.op==='diagnoseExtra')return json_({ok:true,patternCount:read_('extra_patterns').length,sessionCount:read_('extra_sessions').length,requestCount:read_('extra_requests').length,lastSaved:read_('extra_requests').slice(-1).map(x=>({at:x.createdAt,action:x.action,entityId:x.entityId}))});
   if(body.op==='bootstrap')return json_(bootstrap_(body.seed));
   if(body.op==='save')return json_(save_(body.table,body.row));
   if(body.op==='delete')return json_(delete_(body.table,body.id));
   if(body.op==='replaceVersion')return json_(replaceVersion_(body.version,body.slots));
   if(body.op==='splitExtraPattern')return json_(splitExtraPattern_(body.oldId,body.fromDate,body.pattern));
   if(body.op==='endExtraPattern')return json_(endExtraPattern_(body.id,body.fromDate));
   if(body.op==='saveOfficialChange')return json_(saveOfficialChange_(body));
   if(body.op==='undoOfficialChange')return json_(undoOfficialChange_(body));
   throw Error('UNSUPPORTED_ACTION: '+String(body.op||'không rõ'));
  }finally{lock.releaseLock();}
 }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function initSheets_(){const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('Phải tạo Apps Script từ Google Sheets');for(const [name,cols] of Object.entries(TABLES)){let s=ss.getSheetByName(name);if(!s)s=ss.insertSheet(name);if(s.getLastRow()===0){s.appendRow(cols);s.setFrozenRows(1);s.getRange(1,1,1,cols.length).setBackground('#0e2b44').setFontColor('#ffffff').setFontWeight('bold');}
   // Upgrade existing tables in place: columns are appended, never reset or erased.
   const existing=s.getRange(1,1,1,Math.max(s.getLastColumn(),cols.length)).getDisplayValues()[0];
   cols.forEach((col,index)=>{if(existing[index]!==col){if(existing[index])throw Error('Cấu trúc bảng '+name+' khác chuẩn tại cột '+(index+1));s.getRange(1,index+1).setValue(col);}});
   // Existing class names may be stored as dates; preserve them and repair only on read.
  }}
function encode_(table,obj){return TABLES[table].map(k=>Array.isArray(obj[k])?JSON.stringify(obj[k]):typeof obj[k]==='boolean'?String(obj[k]):obj[k]??'');}
function decode_(table,values){const o={};TABLES[table].forEach((k,i)=>{let v=values[i];if(v===null||v===undefined||v==='')return;if(k==='subjects'){try{v=JSON.parse(v)}catch{v=[]}}
  if(['groups','classIds','customGroups'].includes(k)){try{v=JSON.parse(v)}catch{v=[]}}if((NUMERIC[table]||[]).includes(k))v=Number(v);if(['confirmed','completed','active'].includes(k))v=String(v).toLowerCase()==='true';if(v instanceof Date)v=Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');o[k]=v;});return o;}
function read_(table){
 const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);
 const max=sheet.getLastRow();if(max<2)return [];
 const range=sheet.getRange(2,1,max-1,TABLES[table].length);
 const raw=range.getValues(),display=range.getDisplayValues();
 return raw.map((r,i)=>{
   if(table==='classes'){const names={'7F38':'7/2','7F39':'7/3','9F43':'9/1','9F44':'9/2','9F46':'9/4','9F47':'9/5','9F48':'9/6'};r[1]=r[1] instanceof Date?(names[r[0]]||display[i][1]):display[i][1];} // Fix old date-autoformat without mutating user data
   return r;
 }).filter(r=>r[0]).map(r=>decode_(table,r));
}
function readAll_(){const r={};for(const k in TABLES)if(k!=='extra_requests')r[k]=read_(k);return r;}
function appendBatch_(table,records){if(!records.length)return;const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);const data=records.map(o=>encode_(table,o));const dest=s.getRange(s.getLastRow()+1,1,data.length,TABLES[table].length);if(table==='classes')s.getRange(s.getLastRow()+1,2,data.length,1).setNumberFormat('@');
 if(table==='extra_sessions')s.getRange(s.getLastRow()+1,2,data.length,1).setNumberFormat('@');
 if(table==='extra_patterns')s.getRange(s.getLastRow()+1,8,data.length,2).setNumberFormat('@');
 if(table==='changes')s.getRange(s.getLastRow()+1,17,data.length,1).setNumberFormat('@');
 dest.setValues(data);}
function bootstrap_(seed){if(!seed||!Array.isArray(seed.ppct)||!Array.isArray(seed.classes))throw Error('Dữ liệu khởi tạo không hợp lệ');const data=readAll_();if(Object.values(data).some(a=>a.length))throw Error('Google Sheets đã có dữ liệu. Không khởi tạo lại để tránh ghi đè.');for(const k in TABLES){const records=Array.isArray(seed[k])?seed[k]:[];validateBatch_(k,records);appendBatch_(k,records);}return {ok:true,message:'Đã khởi tạo dữ liệu mẫu',summary:Object.fromEntries(Object.entries(TABLES).map(([k])=>[k,(seed[k]||[]).length]))};}
function assert_(v,message){if(!v)throw Error(message)}
function validateBatch_(table,records){assert_(TABLES[table], 'Bảng không hợp lệ');assert_(records.length<1500,'Quá nhiều dòng');records.forEach(r=>{assert_(r&&typeof r.id==='string'&&r.id.length<160,'Thiếu mã ID');if(table==='slots'||table==='changes'||table==='extra_sessions'||table==='extra_patterns'){assert_(['S','C','T'].includes(r.shift),'Buổi không hợp lệ');assert_(Number(r.period)>=1&&Number(r.period)<=(r.shift==='T'?2:5),'Số tiết/suất không hợp lệ');}if(table==='slots'||table==='extra_patterns')assert_(Number(r.day)>=2&&Number(r.day)<=8,'Ngày không hợp lệ');if(table==='ppct_overrides'){assert_(r.subject==='Toán','Quy tắc mạch chỉ áp dụng môn Toán');assert_(/^\d{4}-\d{2}-\d{2}$/.test(r.fromDate),'Ngày áp dụng quy tắc không hợp lệ');assert_(typeof r.classId==='string'&&r.classId.length<80,'Lớp không hợp lệ');assert_(Array.isArray(r.pattern)&&r.pattern.length>=1&&r.pattern.length<=6&&r.pattern.every(x=>['ĐS','HH'].includes(x)),'Mẫu ĐS/HH không hợp lệ');}
 if(table==='versions')assert_(/^\d{4}-\d\d-\d\d$/.test(r.fromDate),'Ngày áp dụng không hợp lệ');if(table==='changes'||table==='extra_sessions')assert_(/^\d{4}-\d\d-\d\d$/.test(r.date),'Ngày điều chỉnh không hợp lệ');
  if(table==='extra_sessions'||table==='extra_patterns'){
   assert_(['Toán','Tin'].includes(r.subject),'Chỉ hỗ trợ Toán / Tin');
   assert_(Array.isArray(r.groups)&&r.groups.length>=1&&r.groups.length<=60,'Phải chọn từ 1 đến 60 lớp/nhóm');
   assert_(r.groups.every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=100),'Tên lớp không hợp lệ');
   if(table==='extra_patterns'){
    assert_(/^\d{4}-\d\d-\d\d$/.test(r.fromDate),'Ngày bắt đầu lặp không hợp lệ');
    assert_(!r.toDate||(/^\d{4}-\d\d-\d\d$/.test(r.toDate)&&r.toDate>=r.fromDate),'Ngày kết thúc lặp không hợp lệ');
    assert_(Number(r.startLesson)>=1&&Number(r.startLesson)<=9999,'Số buổi bắt đầu không hợp lệ');
   }
   if(table==='extra_sessions'){
    assert_(!r.patternId||typeof r.patternId==='string','Mã lịch lặp không hợp lệ');
    assert_(!r.action||['EDIT','CANCEL'].includes(r.action),'Hành động dạy thêm không hợp lệ');
   }
  }});}
function save_(table,row){assert_(TABLES[table]&&table!=='ppct','Không cho sửa bảng PPCT bằng API này');validateBatch_(table,[row]);const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);const records=read_(table);const idx=records.findIndex(r=>r.id===row.id);
 if(table==='extra_patterns'){
   const peers=records.filter(r=>r.id!==row.id&&r.active!==false&&r.day===row.day&&r.shift===row.shift&&r.period===row.period);
   const from=row.fromDate,to=row.toDate||'9999-12-31';
   if(peers.some(r=>r.fromDate<=to&&(r.toDate||'9999-12-31')>=from))throw Error('Đã có mẫu dạy thêm lặp ở suất này. Hãy sửa mẫu hiện có để ghép nhiều lớp.');
 }
 if(table==='slots'){
   const peers=records.filter(r=>r.versionId===row.versionId&&r.id!==row.id);
   if(peers.some(r=>r.day==row.day&&r.shift===row.shift&&r.period==row.period))throw Error('Lịch chính khóa bị trùng thứ, buổi và tiết');
 }
 if(table==='changes'||table==='extra_sessions'){
   row.updatedAt=new Date().toISOString();
   const peers=records.filter(r=>r.id!==row.id);
   if(peers.some(r=>r.date===row.date&&r.shift===row.shift&&r.period==row.period))throw Error('Đã có lịch tại ô này; cần sửa lịch hiện có');
 }
 if(idx<0)appendBatch_(table,[row]);else s.getRange(idx+2,1,1,TABLES[table].length).setValues([encode_(table,row)]);
 return {ok:true,message:'Đã lưu thành công'};
}
function delete_(table,id){
 assert_(table==='extra_sessions','Chỉ cho phép xóa riêng lịch dạy thêm');
 assert_(typeof id==='string'&&id.length>0,'Thiếu mã suất học');
 const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);
 const rows=read_(table),idx=rows.findIndex(x=>x.id===id);
 assert_(idx>=0,'Không tìm thấy suất dạy thêm');s.deleteRow(idx+2);
 return {ok:true,message:'Đã xóa suất dạy thêm'};
}
function replaceVersion_(version,slots){
 validateBatch_('versions',[version]);assert_(Array.isArray(slots)&&slots.length>0,'Chưa có tiết học');validateBatch_('slots',slots);
 const existing=read_('versions');assert_(!existing.some(v=>v.id===version.id),'Mã phiên bản đã tồn tại');
 const uniq=new Set();for(const s of slots){assert_(s.versionId===version.id,'Tiết không thuộc phiên bản mới');const key=[s.day,s.shift,s.period].join('|');assert_(!uniq.has(key),'Trùng tiết trong bản TKB mới: '+key);uniq.add(key);}
 appendBatch_('versions',[version]);appendBatch_('slots',slots);
 return {ok:true,message:'Đã nhập phiên bản TKB mới',count:slots.length};
}

// Edit a recurring schedule from the chosen week onward without rewriting past weeks.
function previousDate_(iso){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return Utilities.formatDate(d,'UTC','yyyy-MM-dd');}
function splitExtraPattern_(oldId,fromDate,newPattern){
 validateBatch_('extra_patterns',[newPattern]);
 const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('extra_patterns');
 const list=read_('extra_patterns'),idx=list.findIndex(x=>x.id===oldId);
 assert_(idx>=0,'Không tìm thấy lịch dạy thêm hàng tuần');
 const old=list[idx];assert_(fromDate>=old.fromDate&&(!old.toDate||fromDate<=old.toDate),'Ngày thay đổi nằm ngoài lịch');
 assert_(newPattern.fromDate===fromDate,'Ngày bắt đầu lịch mới không hợp lệ');
 assert_(newPattern.day===old.day&&newPattern.shift===old.shift&&Number(newPattern.period)===Number(old.period),'Không được đổi vị trí ô khi tách lịch');
 assert_(!list.some(x=>x.id===newPattern.id),'Mã lịch mới đã tồn tại');
 if(fromDate===old.fromDate){newPattern.id=old.id;s.getRange(idx+2,1,1,TABLES.extra_patterns.length).setValues([encode_('extra_patterns',newPattern)]);}
 else{
  const earlier={...old,toDate:previousDate_(fromDate)};
  s.getRange(idx+2,1,1,TABLES.extra_patterns.length).setValues([encode_('extra_patterns',earlier)]);
  appendBatch_('extra_patterns',[newPattern]);
 }
 return {ok:true,message:'Đã sửa lịch lặp từ tuần được chọn; các tuần trước giữ nguyên'};
}
function endExtraPattern_(id,fromDate){
 const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('extra_patterns');
 const list=read_('extra_patterns'),idx=list.findIndex(x=>x.id===id);
 assert_(idx>=0,'Không tìm thấy lịch dạy thêm lặp');
 const old=list[idx];assert_(fromDate>=old.fromDate,'Ngày kết thúc không hợp lệ');
 const row=fromDate===old.fromDate?{...old,active:false}:{...old,toDate:previousDate_(fromDate)};
 s.getRange(idx+2,1,1,TABLES.extra_patterns.length).setValues([encode_('extra_patterns',row)]);
 return {ok:true,message:'Đã dừng lặp từ tuần này; không xóa lịch trước đó'};
}


// V1.5 official changes: use single audited API operation instead of direct writes.
function audit_(entry){appendBatch_('audit_log',[{id:Utilities.getUuid(),at:String(Date.now()),actor:'Lê Hoàng Ngọc Đức',...entry}]);}
function same_(table,a,b){return JSON.stringify(encode_(table,a||{}).map(String))===JSON.stringify(encode_(table,b||{}).map(String));}
function officialRow_(body){
 const row=body.row;
 assert_(row&&typeof row==='object','Thiếu dữ liệu điều chỉnh');
 validateBatch_('changes',[row]);
 assert_(['EDIT','DONE','OFF','ADD','CLEAR','MOVE'].includes(row.action),'Thao tác chính khóa không hợp lệ');
 assert_(row.kind==='MAIN'||row.kind==='MAKEUP','Không được lưu dạy thêm vào chính khóa');
 assert_(typeof row.classId==='string'&&row.classId.length<=80,'Lớp không hợp lệ');
 assert_(typeof row.notes==='string'&&row.notes.length<=2000,'Ghi chú quá dài');
 assert_(typeof row.titleOverride==='string'&&row.titleOverride.length<=350,'Tên bài quá dài');
 assert_(['one','following','future'].includes(row.scope),'Phạm vi không hợp lệ');
 if(row.action==='MOVE'){
  assert_(row.scope==='one'&&!row.completed&&!row.ppctId,'Dời lịch chỉ áp dụng cho một ngày, không thay đổi tiến độ PPCT');
  assert_(/^\d{4}-\d{2}-\d{2}$/.test(String(row.moveDate||'')),'Ngày đến không hợp lệ');
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
 const cls=read_('classes').find(x=>x.id===row.classId);
 assert_(cls,'Không tìm thấy lớp');
 assert_(Array.isArray(cls.subjects)&&cls.subjects.includes(row.subject),'Lớp không học môn được chọn');
 assert_(row.subject==='Tin'?row.stream==='TIN':['ĐS','HH'].includes(row.stream),'Mạch không hợp lệ');
 if(row.ppctId){const ppct=read_('ppct').find(x=>x.id===row.ppctId);
   assert_(ppct&&Number(ppct.grade)===Number(cls.grade)&&ppct.subject===row.subject&&ppct.stream===row.stream,'Tiết PPCT không thuộc lớp/môn/mạch này');}
 if(row.completed&&row.action!=='OFF')assert_(row.ppctId,'Tiết đã hoàn thành phải có mã PPCT để thống kê chính xác');
 return row;
}
function saveOfficialChange_(body){
 const row=officialRow_(body),sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('changes');
 const previous=read_('changes'),index=previous.findIndex(x=>x.id===row.id),old=index>=0?previous[index]:null;
 assert_(String(old?.updatedAt||'')===String(body.expectedUpdatedAt||''),'Dữ liệu vừa được sửa từ phiên khác. Hãy tải lại trang trước khi lưu');
 assert_(!previous.some(x=>x.id!==row.id&&x.date===row.date&&x.shift===row.shift&&Number(x.period)===Number(row.period)&&(row.action!=='MOVE'||x.action!=='MOVE')),'Có điều chỉnh khác cùng ô');
 const rule=body.rule||null;let oldRule=null,ruleSheet=null,ruleIdx=-1;
 if(rule){
  assert_(row.subject==='Toán'&&row.scope==='future','Chỉ áp dụng quy tắc tuần sau cho môn Toán');
  validateBatch_('ppct_overrides',[rule]);
  assert_(rule.classId===row.classId&&rule.fromDate>=row.date,'Quy tắc không khớp lớp/ngày');
  ruleSheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ppct_overrides');
  const rules=read_('ppct_overrides');ruleIdx=rules.findIndex(x=>x.id===rule.id);oldRule=ruleIdx>=0?rules[ruleIdx]:null;
 }
 const result={...row,updatedAt:String(Date.now())};
 if(index>=0){sheet.getRange(index+2,17).setNumberFormat('@');sheet.getRange(index+2,1,1,TABLES.changes.length).setValues([encode_('changes',result)]);}
 else appendBatch_('changes',[result]);
 try{
  if(rule){if(ruleIdx>=0)ruleSheet.getRange(ruleIdx+2,1,1,TABLES.ppct_overrides.length).setValues([encode_('ppct_overrides',rule)]);
    else appendBatch_('ppct_overrides',[rule]);}
  audit_({action:'SAVE',entityType:'changes',entityId:row.id,oldValue:JSON.stringify({change:old,rule:oldRule}),newValue:JSON.stringify({change:result,rule}),reason:String(body.reason||'').slice(0,2000)});
 }catch(e){ // Best-effort rollback; copy existing Sheet before first migration.
  if(index>=0)sheet.getRange(index+2,1,1,TABLES.changes.length).setValues([encode_('changes',old)]);
  else{const j=read_('changes').findIndex(x=>x.id===row.id);if(j>=0)sheet.deleteRow(j+2);}
  if(rule){if(ruleIdx>=0)ruleSheet.getRange(ruleIdx+2,1,1,TABLES.ppct_overrides.length).setValues([encode_('ppct_overrides',oldRule)]);else{const j=read_('ppct_overrides').findIndex(x=>x.id===rule.id);if(j>=0)ruleSheet.deleteRow(j+2);}}
  throw e;
 }
 return {ok:true,message:'Đã lưu và ghi lịch sử thay đổi',updatedAt:result.updatedAt};
}
function undoOfficialChange_(body){
 const id=String(body.id||''),logs=read_('audit_log').filter(x=>x.entityType==='changes'&&x.entityId===id).reverse();
 assert_(logs.length>0,'Chưa có lịch sử để hoàn tác');
 const latest=logs[0];assert_(latest.action==='SAVE','Lần thay đổi gần nhất không thể hoàn tác tiếp');
 const old=JSON.parse(latest.oldValue),next=JSON.parse(latest.newValue);
 const ch=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('changes');const changes=read_('changes'),idx=changes.findIndex(x=>x.id===id);
 assert_(idx>=0&&same_('changes',changes[idx],next.change),'Dữ liệu đã thay đổi. Không thể hoàn tác tự động');
 const rules=read_('ppct_overrides'),rule=next.rule,ruleIdx=rule?rules.findIndex(x=>x.id===rule.id):-1;
 if(rule)assert_(ruleIdx>=0&&same_('ppct_overrides',rules[ruleIdx],rule),'Quy tắc tuần đã thay đổi, cần kiểm tra thủ công');
 if(old.change)ch.getRange(idx+2,1,1,TABLES.changes.length).setValues([encode_('changes',old.change)]);
 else ch.deleteRow(idx+2);
 if(rule){const rs=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ppct_overrides');
  if(old.rule)rs.getRange(ruleIdx+2,1,1,TABLES.ppct_overrides.length).setValues([encode_('ppct_overrides',old.rule)]);
  else rs.deleteRow(ruleIdx+2);}
 audit_({action:'UNDO',entityType:'changes',entityId:id,oldValue:latest.newValue,newValue:latest.oldValue,reason:'Hoàn tác thao tác gần nhất'});
 return {ok:true,message:'Đã hoàn tác và giữ lịch sử'};
}

/** V1.6: stable, idempotent tutoring writes. This endpoint NEVER modifies official PPCT. */
function extraDate_(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));}
function extraGroups_(value){
 if(Array.isArray(value))return [...new Set(value.map(x=>String(x||'').trim()).filter(Boolean))];
 if(!value)return [];
 try{const x=JSON.parse(value);if(Array.isArray(x))return extraGroups_(x);}catch(e){}
 return extraGroups_(String(value).split(/[,;\n]+/));
}
function extraNumberDay_(date){const day=new Date(date+'T12:00:00Z').getUTCDay();return day===0?8:day+1;}
function extraPreviousDate_(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return Utilities.formatDate(d,'UTC','yyyy-MM-dd');}
function extraRow_(row){
 assert_(row&&extraDate_(row.date),'Ngày dạy thêm không hợp lệ');
 assert_(['S','C','T'].includes(row.shift),'Buổi không hợp lệ');
 assert_(Number.isInteger(Number(row.period))&&Number(row.period)>=1&&Number(row.period)<=(row.shift==='T'?2:5),'Tiết hoặc suất không hợp lệ');
 assert_(['Toán','Tin'].includes(row.subject),'Môn học không hợp lệ');
 const groups=extraGroups_(row.groups);
 assert_(groups.length>=1&&groups.length<=60,'Một suất cần từ 1 đến 60 lớp/nhóm');
 assert_(groups.every(x=>x.length<=100),'Tên lớp hoặc nhóm quá dài');
 const classIds=extraGroups_(row.classIds),customGroups=extraGroups_(row.customGroups);
 const startTime=String(row.startTime||'').trim(),endTime=String(row.endTime||'').trim();
 assert_(!startTime||/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime),'Giờ bắt đầu sai định dạng');
 assert_(!endTime||/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime),'Giờ kết thúc sai định dạng');
 assert_(!startTime||!endTime||startTime<endTime,'Giờ kết thúc phải sau giờ bắt đầu');
 const lessonNumber=Number(row.lessonNumber||1);
 assert_(Number.isInteger(lessonNumber)&&lessonNumber>=1&&lessonNumber<=9999,'Số buổi không hợp lệ');
 return {date:row.date,shift:row.shift,period:Number(row.period),subject:row.subject,groups,classIds,customGroups,
  notes:String(row.notes||'').slice(0,2000),lessonTitle:String(row.lessonTitle||'').slice(0,350),
  startTime,endTime,lessonNumber,completed:row.completed===true,updatedAt:new Date().toISOString()};
}
function extraUpsert_(table,row){
 const records=read_(table),idx=records.findIndex(x=>x.id===row.id);
 const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);
 const encoded=encode_(table,row);
 if(idx<0)appendBatch_(table,[row]);else sheet.getRange(idx+2,1,1,encoded.length).setValues([encoded]);
 SpreadsheetApp.flush();
 const found=read_(table).find(x=>x.id===row.id);
 assert_(found,'READ_AFTER_WRITE_FAILED: Không đọc lại được bản ghi sau khi lưu');
 assert_(extraCompare_(table,found,row),'WRITE_VERIFY_MISMATCH: Dữ liệu đọc lại khác dữ liệu đã ghi');
 return found;
}
function extraAssertNoClash_(base,ignorePattern,ignoreSession,toDate){
 const effectiveEnd=toDate||'9999-12-31';
 const patterns=read_('extra_patterns').filter(p=>p.id!==ignorePattern&&p.active!==false&&p.day===extraNumberDay_(base.date)&&p.shift===base.shift&&Number(p.period)===base.period);
 assert_(!patterns.some(p=>p.fromDate<=effectiveEnd&&(p.toDate||'9999-12-31')>=base.date),
  'Suất này đã có một lịch dạy thêm lặp. Hãy mở suất cũ và Thêm lớp/nhóm vào cùng suất.');
 const sessions=read_('extra_sessions').filter(s=>s.id!==ignoreSession&&s.action!=='CANCEL'&&!s.patternId&&s.shift===base.shift&&Number(s.period)===base.period&&s.date>=base.date&&s.date<=effectiveEnd);
 assert_(!sessions.length,'Suất này đã có lịch dạy thêm. Hãy chỉnh sửa suất đã có, không thêm trùng.');
}
function extraPattern_(base,props){
 return {...base,id:props.id,day:extraNumberDay_(base.date),fromDate:props.fromDate||base.date,toDate:props.toDate||'',
  startLesson:base.lessonNumber,active:true,repeatRule:props.repeatRule||'weekly',revision:Number(props.revision||1),requestId:props.requestId};
}
function extraAssertRevision_(row,expected){
 if(expected===undefined||expected===null||expected==='')return;
 assert_(Number(row.revision||0)===Number(expected),'Suất dạy thêm vừa được cập nhật trên thiết bị khác. Hãy tải lại trước khi sửa.');
}
/** Compare business fields, not Apps Script object identity; preserve legacy groups JSON. */
function extraCompare_(table,stored,expected){
 if(!stored||stored.id!==expected.id||String(stored.subject||'')!==String(expected.subject||''))return false;
 if(String(stored.shift||'')!==String(expected.shift||'')||Number(stored.period)!==Number(expected.period))return false;
 if(JSON.stringify(extraGroups_(stored.groups))!==JSON.stringify(extraGroups_(expected.groups)))return false;
 const fields=table==='extra_patterns'?['day','fromDate','toDate','active','repeatRule','revision','requestId','startLesson','lessonTitle','startTime','endTime']:
  ['date','patternId','action','repeatRule','revision','requestId','lessonNumber','lessonTitle','startTime','endTime','completed'];
 return fields.every(k=>{
  const a=stored[k]??'',b=expected[k]??'';
  if(k==='active'||k==='completed')return String(a).toLowerCase()===String(b).toLowerCase();
  if(['day','revision','startLesson','lessonNumber'].includes(k))return Number(a||0)===Number(b||0);
  return String(a)===String(b);
 });
}
function extraPayloadHash_(body){
 const text=JSON.stringify({action:body.action,entityId:body.entityId||'',date:body.date||body.row?.date||'',row:body.row||null,
  expectedRevision:body.expectedRevision??null,expectedOccurrenceRevision:body.expectedOccurrenceRevision??null});
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function extraStatus_(requestId){
 assert_(/^[A-Za-z0-9._:-]{12,120}$/.test(String(requestId||'')),'Mã yêu cầu không hợp lệ');
 const req=read_('extra_requests').find(x=>x.id===requestId);
 const patterns=read_('extra_patterns'),sessions=read_('extra_sessions');
 if(!req){const recovered=[...patterns,...sessions].find(x=>x.requestId===requestId);
  return {ok:true,found:!!recovered,verified:!!recovered,requestId,entityId:recovered?.id||'',state:recovered?'RECOVERED':'NOT_FOUND'};}
 let recorded={};try{recorded=JSON.parse(req.resultJson||'{}')}catch(e){}
 const entity=[...patterns,...sessions].find(x=>x.id===req.entityId);
 const superseded=!!entity&&Number(entity.revision||0)>Number(recorded.revision||0);
 return {ok:true,found:true,verified:!!entity,requestId,entityId:req.entityId,action:req.action,
  state:!entity?'MISSING_ENTITY':superseded?'SUPERSEDED':'COMMITTED',table:recorded.table||'',revision:entity?.revision||0,
  savedAt:req.createdAt||'',payloadHash:req.payloadHash||'',superseded};
}
function extraList_(week){
 const patterns=read_('extra_patterns'),sessions=read_('extra_sessions'),requests=read_('extra_requests');
 return {ok:true,apiVersion:SMART_TKB_SERVER_VERSION,patterns,sessions,
  counts:{patterns:patterns.length,exceptions:sessions.length,requests:requests.length},
  lastRequest:requests.length?{id:requests[requests.length-1].id,at:requests[requests.length-1].createdAt,action:requests[requests.length-1].action}:null};
}
function mutateExtra_(body){
 const requestId=String(body.requestId||'');
 const payloadHash=extraPayloadHash_(body);
 assert_(/^[A-Za-z0-9._:-]{12,120}$/.test(requestId),'Thiếu mã yêu cầu lưu an toàn');
 const action=String(body.action||'');
 assert_(EXTRA_OPS.includes(action),'Thao tác dạy thêm không hợp lệ');
 const already=read_('extra_requests').find(x=>x.id===requestId);
 if(already){assert_(!already.payloadHash||already.payloadHash===payloadHash,'IDEMPOTENCY_CONFLICT: requestId đã được sử dụng với dữ liệu khác');
  const parsed=JSON.parse(already.resultJson||'{}');const check=extraStatus_(requestId);
  return {...parsed,verified:check.verified===true,verificationState:check.state,duplicateRequest:true};}
 // Recover if Sheets stored the record but a network timeout interrupted the response/log.
 const recoveredPattern=read_('extra_patterns').find(x=>x.requestId===requestId||x.id==='EX16-P-'+requestId);
 const recoveredSession=read_('extra_sessions').find(x=>x.requestId===requestId||x.id==='EX16-S-'+requestId);
 if(recoveredPattern||recoveredSession){
  const found=recoveredPattern||recoveredSession,table=recoveredPattern?'extra_patterns':'extra_sessions';
  const result={ok:true,action,entityId:found.id,table,revision:Number(found.revision||1),savedAt:found.updatedAt||new Date().toISOString(),recovered:true,verified:true,requestId,payloadHash,message:'Đã tìm thấy bản ghi đã lưu trước đó'};
  appendBatch_('extra_requests',[{id:requestId,action,entityId:found.id,createdAt:result.savedAt,resultJson:JSON.stringify(result),payloadHash}]);
  return result;
 }
 const patterns=read_('extra_patterns'),sessions=read_('extra_sessions');
 const recordId=String(body.entityId||'');const onDate=String(body.date||body.row?.date||'');
 const pattern=patterns.find(p=>p.id===recordId);const oneoff=sessions.find(s=>s.id===recordId);
 let resultRow=null,resultTable='',oldRows=[];
 const save=(table,row)=>{oldRows.push({table,id:row.id,old:read_(table).find(x=>x.id===row.id)||null});resultRow=extraUpsert_(table,row);resultTable=table;};
 const bump=(r)=>Number(r?.revision||0)+1;
 if(action==='CREATE'){
  const base=extraRow_(body.row),rule=String(body.row?.repeatRule||'weekly');
  assert_(['weekly','until','once'].includes(rule),'Kiểu lặp không hợp lệ');
  const until=rule==='until'?String(body.row?.endDate||''):'';
  assert_(rule!=='until'||(extraDate_(until)&&until>=base.date),'Ngày kết thúc lặp không hợp lệ');
  const existingId=(rule==='once'?'EX16-S-':'EX16-P-')+requestId;
  const priorSaved=read_(rule==='once'?'extra_sessions':'extra_patterns').find(x=>x.id===existingId);
  if(!priorSaved)extraAssertNoClash_(base,'','',rule==='once'?base.date:until);
  if(rule==='once')save('extra_sessions',{...base,id:'EX16-S-'+requestId,patternId:'',action:'EDIT',repeatRule:'once',revision:1,requestId});
  else save('extra_patterns',extraPattern_(base,{id:'EX16-P-'+requestId,toDate:until,repeatRule:rule,requestId}));
 }else if(action==='CONVERT_ONCE'){
  const base=extraRow_(body.row);assert_(oneoff&&!oneoff.patternId,'Chỉ có thể chuyển lịch một lần thành lịch lặp');
  extraAssertRevision_(oneoff,body.expectedRevision);
  const rule=String(body.row?.repeatRule||'weekly'),until=rule==='until'?String(body.row?.endDate||''):'';
  assert_(rule==='weekly'||rule==='until','Hãy chọn lặp hàng tuần hoặc lặp đến ngày');
  if(rule==='until')assert_(extraDate_(until)&&until>=base.date,'Ngày kết thúc không hợp lệ');
  extraAssertNoClash_(base,'EX16-P-'+requestId,oneoff.id,until);
  const id='EX16-P-'+requestId;const newPattern=extraPattern_(base,{id,toDate:until,repeatRule:rule,requestId});
  const oldSnapshot={...oneoff};
  extraUpsert_('extra_patterns',newPattern);
  try{save('extra_sessions',{...oneoff,action:'CANCEL',revision:bump(oneoff),updatedAt:new Date().toISOString(),requestId});}
  catch(err){const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('extra_patterns');const idx=read_('extra_patterns').findIndex(x=>x.id===id);if(idx>=0)sheet.deleteRow(idx+2);throw err;}
  oldRows.push({table:'extra_sessions',id:oneoff.id,old:oldSnapshot});resultRow=newPattern;resultTable='extra_patterns';
 }else if(action==='EDIT_ONCE'||action==='EDIT_ALL'||action==='EDIT_FUTURE'){
  const base=extraRow_(body.row);
  if(pattern){
   extraAssertRevision_(pattern,body.expectedRevision);
   assert_(extraDate_(onDate)&&onDate>=pattern.fromDate&&(!pattern.toDate||onDate<=pattern.toDate),'Ngày sửa không thuộc chuỗi lịch');
   if(action==='EDIT_ONCE'){
    const id='EX16-O-'+pattern.id+'-'+onDate;
    const old=sessions.find(x=>x.id===id)||sessions.find(x=>x.patternId===pattern.id&&x.date===onDate);
    extraAssertRevision_(old||{revision:0},body.expectedOccurrenceRevision);
    save('extra_sessions',{...base,id:old?.id||id,patternId:pattern.id,date:onDate,action:'EDIT',repeatRule:'once',revision:bump(old),requestId});
   }else if(action==='EDIT_ALL'||onDate===pattern.fromDate){
    save('extra_patterns',{...pattern,...base,id:pattern.id,day:pattern.day,fromDate:pattern.fromDate,toDate:pattern.toDate,
      startLesson:action==='EDIT_ALL'?Number(pattern.startLesson):base.lessonNumber,repeatRule:pattern.repeatRule||'weekly',revision:bump(pattern),requestId});
   }else{
    const newId='EX16-P-'+requestId;
    const oldNext={...pattern,toDate:extraPreviousDate_(onDate),revision:bump(pattern),updatedAt:new Date().toISOString()};
    const next=extraPattern_(base,{id:newId,toDate:pattern.toDate,repeatRule:pattern.repeatRule||'weekly',requestId});
    // Write new pattern before truncating old: if an error occurs the catch restores it.
    let started=false;
    try{
     extraUpsert_('extra_patterns',next);started=true;
     save('extra_patterns',oldNext);
     // Carry date-specific overrides forward to the new pattern segment.
     for(const past of sessions.filter(x=>x.patternId===pattern.id&&x.date>=onDate)){
      save('extra_sessions',{...past,patternId:newId,revision:bump(past),updatedAt:new Date().toISOString()});
     }
     resultRow=next;resultTable='extra_patterns';
    }catch(err){
     for(const b of oldRows.slice().reverse()){if(b.old)extraUpsert_(b.table,b.old);}
     if(started){const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('extra_patterns');const i=read_('extra_patterns').findIndex(x=>x.id===newId);if(i>=0)sheet.deleteRow(i+2);}
     throw err;
    }
   }
  }else{
   assert_(oneoff,'Không tìm thấy suất cần sửa');
   extraAssertRevision_(oneoff,body.expectedRevision);
   assert_(action==='EDIT_ONCE','Suất chỉ một tuần không có chuỗi lịch để sửa toàn bộ');
   save('extra_sessions',{...oneoff,...base,id:oneoff.id,action:'EDIT',patternId:'',repeatRule:'once',revision:bump(oneoff),requestId});
  }
 }else if(action==='CANCEL_ONCE'||action==='STOP_FUTURE'||action==='DELETE_SERIES'||action==='DELETE_ONE'){
  if(pattern){
   extraAssertRevision_(pattern,body.expectedRevision);
   assert_(extraDate_(onDate)&&onDate>=pattern.fromDate,'Ngày thao tác không hợp lệ');
   if(action==='CANCEL_ONCE'){
    const id='EX16-O-'+pattern.id+'-'+onDate;
    const old=sessions.find(x=>x.patternId===pattern.id&&x.date===onDate);
    save('extra_sessions',{...pattern,id:old?.id||id,date:onDate,patternId:pattern.id,action:'CANCEL',completed:false,
     lessonNumber:Number(old?.lessonNumber||pattern.startLesson),revision:bump(old),updatedAt:new Date().toISOString(),requestId});
   }else if(action==='STOP_FUTURE'){
    save('extra_patterns',{...pattern,active:onDate===pattern.fromDate?false:true,
      toDate:onDate===pattern.fromDate?pattern.toDate:extraPreviousDate_(onDate),revision:bump(pattern),updatedAt:new Date().toISOString(),requestId});
   }else if(action==='DELETE_SERIES'){
    save('extra_patterns',{...pattern,active:false,revision:bump(pattern),updatedAt:new Date().toISOString(),requestId});
   }else throw Error('Không thể xóa riêng một tuần bằng DELETE_ONE');
  }else{
   assert_(oneoff&&action==='DELETE_ONE','Không tìm thấy suất cần hủy');
   extraAssertRevision_(oneoff,body.expectedRevision);
   save('extra_sessions',{...oneoff,action:'CANCEL',revision:bump(oneoff),updatedAt:new Date().toISOString(),requestId});
  }
 }else throw Error('Yêu cầu không hợp lệ');
 assert_(resultRow,'Không ghi được lịch dạy thêm');
 const reply={ok:true,action,entityId:resultRow.id,table:resultTable,revision:Number(resultRow.revision||1),
  savedAt:new Date().toISOString(),verified:true,requestId,payloadHash,message:'Đã xác minh ghi và đọc lại từ Google Sheets'};
 // History and deduplication records are append-only. No official PPCT data is written.
 if(!read_('audit_log').some(x=>x.id==='EX16-A-'+requestId))appendBatch_('audit_log',[{id:'EX16-A-'+requestId,at:reply.savedAt,actor:'Lê Hoàng Ngọc Đức',action,entityType:resultTable,entityId:resultRow.id,
  oldValue:JSON.stringify(oldRows),newValue:JSON.stringify(resultRow),reason:'Thao tác dạy thêm V1.6'}]);
 appendBatch_('extra_requests',[{id:requestId,action,entityId:resultRow.id,createdAt:reply.savedAt,resultJson:JSON.stringify(reply),payloadHash}]);
 const check=extraStatus_(requestId);
 assert_(check.verified&&check.entityId===reply.entityId,'REQUEST_VERIFY_FAILED: Không xác nhận được yêu cầu đã lưu');
 return {...reply,verified:true,verificationState:check.state};
}
