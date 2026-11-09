/** Smart TKB backend: paste into Google Apps Script bound to the target spreadsheet.
 * Script properties: SMART_TKB_API_KEY (must match GAS_API_KEY in Vercel).
 * Deploy > New deployment > Web app > Execute as me > Anyone.
 */
const TABLES={
  classes:['id','name','grade','subjects'],
  versions:['id','name','fromDate','toDate','notes'],
  slots:['id','versionId','day','shift','period','classId','subject','stream','kind','notes'],
  ppct:['id','grade','subject','stream','week','period','title','note','source'],
  baselines:['id','classId','subject','stream','fromDate','nextIndex','confirmed'],
  changes:['id','date','shift','period','action','classId','subject','stream','kind','notes','ppctId','completed','updatedAt']
};
const NUMERIC={classes:['grade'],slots:['day','period'],ppct:['grade','week','period'],baselines:['nextIndex'],changes:['period']};
function doGet(){return json_({ok:true,message:'Smart TKB Apps Script đã triển khai. Dùng API qua Vercel.'});}
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
   if(body.op==='load')return json_({ok:true,data:readAll_()});
   if(body.op==='bootstrap')return json_(bootstrap_(body.seed));
   if(body.op==='save')return json_(save_(body.table,body.row));
   if(body.op==='replaceVersion')return json_(replaceVersion_(body.version,body.slots));
   throw Error('Thao tác không được hỗ trợ');
  }finally{lock.releaseLock();}
 }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function initSheets_(){const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('Phải tạo Apps Script từ Google Sheets');for(const [name,cols] of Object.entries(TABLES)){let s=ss.getSheetByName(name);if(!s)s=ss.insertSheet(name);if(s.getLastRow()===0){s.appendRow(cols);s.setFrozenRows(1);s.getRange(1,1,1,cols.length).setBackground('#0e2b44').setFontColor('#ffffff').setFontWeight('bold');}}}
function encode_(table,obj){return TABLES[table].map(k=>Array.isArray(obj[k])?JSON.stringify(obj[k]):typeof obj[k]==='boolean'?String(obj[k]):obj[k]??'');}
function decode_(table,values){const o={};TABLES[table].forEach((k,i)=>{let v=values[i];if(v===null||v===undefined||v==='')return;if(k==='subjects'){try{v=JSON.parse(v)}catch{v=[]}}if((NUMERIC[table]||[]).includes(k))v=Number(v);if(['confirmed','completed'].includes(k))v=String(v)==='true';if(v instanceof Date)v=Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');o[k]=v;});return o;}
function read_(table){const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);const max=s.getLastRow();return max<2?[]:s.getRange(2,1,max-1,TABLES[table].length).getValues().filter(r=>r[0]).map(r=>decode_(table,r));}
function readAll_(){const r={};for(const k in TABLES)r[k]=read_(k);return r;}
function appendBatch_(table,records){if(!records.length)return;const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);const data=records.map(o=>encode_(table,o));s.getRange(s.getLastRow()+1,1,data.length,TABLES[table].length).setValues(data);}
function bootstrap_(seed){if(!seed||!Array.isArray(seed.ppct)||!Array.isArray(seed.classes))throw Error('Dữ liệu khởi tạo không hợp lệ');const data=readAll_();if(Object.values(data).some(a=>a.length))throw Error('Google Sheets đã có dữ liệu. Không khởi tạo lại để tránh ghi đè.');for(const k in TABLES){const records=Array.isArray(seed[k])?seed[k]:[];validateBatch_(k,records);appendBatch_(k,records);}return {ok:true,message:'Đã khởi tạo dữ liệu mẫu',summary:Object.fromEntries(Object.entries(TABLES).map(([k])=>[k,(seed[k]||[]).length]))};}
function assert_(v,message){if(!v)throw Error(message)}
function validateBatch_(table,records){assert_(TABLES[table], 'Bảng không hợp lệ');assert_(records.length<1500,'Quá nhiều dòng');records.forEach(r=>{assert_(r&&typeof r.id==='string'&&r.id.length<160,'Thiếu mã ID');if(table==='slots'||table==='changes'){assert_(['S','C','T'].includes(r.shift),'Buổi không hợp lệ');assert_(Number(r.period)>=1&&Number(r.period)<=(r.shift==='T'?2:5),'Số tiết/suất không hợp lệ');}if(table==='slots')assert_(Number(r.day)>=2&&Number(r.day)<=8,'Ngày không hợp lệ');if(table==='versions')assert_(/^\d{4}-\d\d-\d\d$/.test(r.fromDate),'Ngày áp dụng không hợp lệ');if(table==='changes')assert_(/^\d{4}-\d\d-\d\d$/.test(r.date),'Ngày điều chỉnh không hợp lệ');});}
function save_(table,row){assert_(TABLES[table]&&table!=='ppct','Không cho sửa bảng PPCT bằng API này');validateBatch_(table,[row]);const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);const records=read_(table);const idx=records.findIndex(r=>r.id===row.id);
 if(table==='slots'){
   const peers=records.filter(r=>r.versionId===row.versionId&&r.id!==row.id);
   if(peers.some(r=>r.day==row.day&&r.shift===row.shift&&r.period==row.period))throw Error('Lịch chính khóa bị trùng thứ, buổi và tiết');
 }
 if(table==='changes'){
   row.updatedAt=new Date().toISOString();
   const peers=records.filter(r=>r.id!==row.id);
   if(peers.some(r=>r.date===row.date&&r.shift===row.shift&&r.period==row.period))throw Error('Đã có điều chỉnh tại ô này; cần sửa điều chỉnh hiện có');
 }
 if(idx<0)appendBatch_(table,[row]);else s.getRange(idx+2,1,1,TABLES[table].length).setValues([encode_(table,row)]);
 return {ok:true,message:'Đã lưu thành công'};
}
function replaceVersion_(version,slots){
 validateBatch_('versions',[version]);assert_(Array.isArray(slots)&&slots.length>0,'Chưa có tiết học');validateBatch_('slots',slots);
 const existing=read_('versions');assert_(!existing.some(v=>v.id===version.id),'Mã phiên bản đã tồn tại');
 const uniq=new Set();for(const s of slots){assert_(s.versionId===version.id,'Tiết không thuộc phiên bản mới');const key=[s.day,s.shift,s.period].join('|');assert_(!uniq.has(key),'Trùng tiết trong bản TKB mới: '+key);uniq.add(key);}
 appendBatch_('versions',[version]);appendBatch_('slots',slots);
 return {ok:true,message:'Đã nhập phiên bản TKB mới',count:slots.length};
}
