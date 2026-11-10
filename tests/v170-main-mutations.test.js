import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizeSheetData,eventsForWeek,conflicts,activeVersion,previewMainRevision,previewMainOnce} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
function setup(){
 const tabs={classes:structuredClone(seed.classes),versions:structuredClone(seed.versions),slots:structuredClone(seed.slots),changes:[],audit_log:[]};
 let uid=0;
 const context={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,Utilities:{getUuid:()=>String(++uid).padStart(8,'0')+'-testing',formatDate:d=>d.toISOString().slice(0,10)},SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>({getLastRow:()=>tabs[name].length+1,getRange:(start,col,height,width)=>({setValues:vals=>{for(let i=0;i<vals.length;i++){const row=vals[i];const keys=context.TABLES[name];tabs[name][start-2+i]=Object.fromEntries(keys.map((k,j)=>[k,row[j]]));}}}),deleteRow:row=>tabs[name].splice(row-2,1),deleteRows:(row,n)=>tabs[name].splice(row-2,n)})}),flush:()=>{}}};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8')+'\nthis.mutate=mutateMainSchedule_;this.TABLES=TABLES;',context);
 context.read_=name=>structuredClone(tabs[name]||[]);
 context.appendBatch_=(name,rows)=>{tabs[name]??=[];tabs[name].push(...structuredClone(rows));};
 context.audit_=row=>tabs.audit_log.push(structuredClone(row));
 vm.runInContext('read_=this.read_;appendBatch_=this.appendBatch_;audit_=this.audit_;',context);
 const data=()=>normalizeSheetData(structuredClone({...seed,versions:tabs.versions,slots:tabs.slots,changes:tabs.changes,audit_log:tabs.audit_log}));
 const request=(action,scope,sourceSlotId='',patch=null,fromDate='2026-11-09',requestId='12345678-safe')=>context.mutate({action,scope,sourceSlotId,fromDate,expectedVersionId:activeVersion(data(),fromDate).id,requestId,patch,reason:'Kiểm thử V1.7.0'});
 return {tabs,context,data,request};
}
const collisionDate='2026-11-12';
const tin='S-TIN-14';
const patch={day:6,shift:'S',period:1,classId:'7F39',subject:'Tin',stream:'TIN'};

test('Xóa đúng Tin 7/3 ở ô trùng cho CHỈ MỘT TUẦN; Toán còn, tuần kế phục hồi',()=>{
 const {tabs,data,request}=setup();
 const before=data();assert.equal(conflicts(eventsForWeek(before,'2026-11-09')).length,1);
 const r=request('DELETE','one',tin);
 assert.equal(r.verified,true);assert.equal(r.scope,'one');
 assert.equal(tabs.versions.length,1);assert.equal(tabs.slots.length,18);
 const current=eventsForWeek(data(),'2026-11-09').filter(x=>x.date===collisionDate&&x.shift==='S'&&x.period===3);
 assert.equal(current.length,1);assert.equal(current[0].subject,'Toán');
 assert.equal(eventsForWeek(data(),'2026-11-16').filter(x=>x.classId==='7F39'&&x.shift==='S'&&x.period===3).length,1);
 assert.ok(tabs.audit_log.some(x=>x.action==='DELETE_ONE_WEEK'));
});

test('Xóa Tin 7/3 đến TKB mới: tuần trước giữ nguyên và các tuần sau không có tiết đó',()=>{
 const {data,request,tabs}=setup();
 const r=request('DELETE','future',tin,null,'2026-11-16');
 assert.equal(r.verified,true);assert.equal(r.slotCount,17);
 assert.equal(tabs.versions.length,2);
 assert.ok(eventsForWeek(data(),'2026-11-09').some(x=>x.id===tin));
 for(const wk of ['2026-11-16','2026-11-23','2026-11-30'])assert.equal(eventsForWeek(data(),wk).some(x=>x.id===tin),false);
 assert.equal(eventsForWeek(data(),'2026-11-16').filter(x=>x.date==='2026-11-19'&&x.shift==='S'&&x.period===3).length,1);
 const official={id:'school-new',name:'TKB trường mới',fromDate:'2026-12-14',toDate:'',notes:''};
 tabs.versions.push(official);tabs.slots.push(...seed.slots.map(x=>({...x,versionId:official.id})));
 assert.ok(eventsForWeek(data(),'2026-12-14').some(x=>x.id===tin),'TKB chính thức mới có quyền thay thế thủ công');
});

test('Sao chép tiết sang ô trống cho một tuần giữ nguồn và không ghi trùng khi retry',()=>{
 const {tabs,data,request}=setup();
 const r=request('COPY','one','',{day:7,shift:'S',period:1,classId:'7F39',subject:'Tin',stream:'TIN'});
 assert.equal(r.operation,'COPY');assert.equal(r.verified,true);
 const a=eventsForWeek(data(),'2026-11-09');
 assert.equal(a.filter(x=>x.id===tin).length,1);
 assert.ok(a.some(x=>x.id===r.changeId&&x.date==='2026-11-14'));
 assert.equal(a.length,19);
 assert.equal(eventsForWeek(data(),'2026-11-16').length,18);
 const oldCount=tabs.changes.length;
 const retry=request('COPY','one','',{day:7,shift:'S',period:1,classId:'7F39',subject:'Tin',stream:'TIN'});
 assert.equal(retry.alreadySaved,true);assert.equal(tabs.changes.length,oldCount);
});

test('Sao chép lớp vào TKB lâu dài; vị trí gốc vẫn tồn tại, kết thúc khi có TKB mới',()=>{
 const {data,request}=setup();
 const r=request('COPY','future','',{day:7,shift:'S',period:1,classId:'7F39',subject:'Tin',stream:'TIN'});
 assert.equal(r.operation,'COPY');assert.equal(r.slotCount,19);
 for(const wk of ['2026-11-09','2026-11-16']){
  const rows=eventsForWeek(data(),wk);
  assert.equal(rows.length,19);assert.ok(rows.some(x=>x.id===tin));
  assert.ok(rows.some(x=>x.id===r.sourceSlotId&&x.classId==='7F39'));
 }
});

test('Sửa nội dung 1 tuần ngay trong ô TRÙNG: được phép giữ nguyên vị trí',()=>{
 const {data,request}=setup();
 const p={day:5,shift:'S',period:3,classId:'9F43',subject:'Tin',stream:'TIN'};
 const original='S-9-9';
 assert.doesNotThrow(()=>previewMainOnce(data(),{action:'EDIT',sourceSlotId:original,fromDate:'2026-11-09',...p}));
 const r=request('EDIT','one',original,p);
 assert.equal(r.verified,true);
 assert.equal(eventsForWeek(data(),'2026-11-09').filter(x=>x.date===collisionDate&&x.shift==='S'&&x.period===3&&x.subject==='Tin').length,2);
 assert.equal(eventsForWeek(data(),'2026-11-16').filter(x=>x.date==='2026-11-19'&&x.shift==='S'&&x.period===3&&x.subject==='Toán').length,1);
});

test('Một tuần đổi lớp/môn/chuyển chỗ rồi xóa lại đúng tiết đã thêm',()=>{
 const {data,request,tabs}=setup();
 const add=request('ADD','one','',{day:7,shift:'C',period:4,classId:'7F38',subject:'Toán',stream:'ĐS'});
 assert.equal(add.verified,true);
 const sourceId=add.changeId;
 assert.equal(tabs.changes.length,1);
 const ed=request('EDIT','one',sourceId,{day:7,shift:'C',period:5,classId:'7F38',subject:'Toán',stream:'HH'});
 assert.equal(ed.changeId,sourceId);assert.equal(tabs.changes.length,1);
 assert.ok(eventsForWeek(data(),'2026-11-09').some(x=>x.id===sourceId&&x.period===5));
 const del=request('DELETE','one',sourceId);
 assert.equal(del.verified,true);
 assert.equal(eventsForWeek(data(),'2026-11-09').filter(x=>x.id===sourceId).length,0);
 assert.equal(tabs.slots.length,18);
});

test('Không cho dán sang ô đã có TKB; lớp không được phân công môn vẫn bị chặn',()=>{
 const {data,request}=setup();
 assert.throws(()=>previewMainRevision(data(),{action:'COPY',fromDate:'2026-11-09',day:5,shift:'S',period:3,classId:'7F39',subject:'Tin',stream:'TIN'}),/Ô đích/);
 assert.throws(()=>request('ADD','one','',{day:4,shift:'S',period:4,classId:'7F39',subject:'Toán',stream:'ĐS'}),/chưa được phân công/);
 assert.throws(()=>request('ADD','future','',{day:5,shift:'S',period:3,classId:'7F39',subject:'Tin',stream:'TIN'}),/Ô đến/);
});

test('TKB mới của trường nhập cùng thứ Hai phải ghi đè thay đổi thủ công trước đó',()=>{
 const {data,tabs}=setup();
 const manual={...seed.versions[0],id:'zzzz-TKB-2026-11-09-1794360000000-a',fromDate:'2026-11-09'};
 const official={...seed.versions[0],id:'ver-2026-11-09-1794360000001',fromDate:'2026-11-09',name:'TKB mới của trường'};
 const later={...seed.versions[0],id:'zzzz-TKB-2026-11-09-1794360000002-b',fromDate:'2026-11-09'};
 tabs.versions.push(manual,official);
 assert.equal(activeVersion(data(),'2026-11-09').id,official.id);
 tabs.versions.push(later);
 assert.equal(activeVersion(data(),'2026-11-09').id,later.id);
});

test('GAS không tạo hai phiên bản tương lai khi trình duyệt gửi lại cùng requestId',()=>{
 const {context,tabs}=setup();
 const req={action:'COPY',scope:'future',sourceSlotId:'',fromDate:'2026-11-09',expectedVersionId:'v4-2026',requestId:'12345678-copy-safe',patch:{day:7,shift:'S',period:1,classId:'9F43',subject:'Toán',stream:'ĐS'},reason:'Dán có xác minh'};
 const first=context.mutate(req);
 assert.equal(first.verified,true);
 assert.equal(first.operation,'COPY');
 const second=context.mutate(req);
 assert.equal(second.verified,true);assert.equal(second.alreadySaved,true);
 assert.equal(second.sourceSlotId,first.sourceSlotId);
 assert.equal(tabs.versions.length,2);assert.equal(tabs.slots.length,37);
});

test('Mạch Toán để trống phải lưu trống để hệ thống tự chia ĐS/HH, không lấy mạch cũ',()=>{
 const {request,tabs}=setup();
 const x=request('ADD','one','',{day:7,shift:'S',period:1,classId:'9F43',subject:'Toán',stream:''});
 assert.equal(x.verified,true);
 assert.equal(tabs.changes[0].stream,'');
});
