import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizeSheetData,previewMainRevision,eventsForWeek,conflicts,activeVersion,tutoringForWeek} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
const data=()=>normalizeSheetData(structuredClone(seed));
const patch={day:6,shift:'S',period:1,classId:'7F39',subject:'Tin',stream:'TIN'};
const sourceId='S-TIN-14';

test('Chọn đúng tiết Tin ở ô trùng, chuyển thứ Sáu sáng tiết 1 và giữ Toán',()=>{
 const d=data(),initial=eventsForWeek(d,'2026-11-09');
 assert.equal(conflicts(initial).length,1);
 const v=previewMainRevision(d,{sourceSlotId:sourceId,fromDate:'2026-11-09',...patch});
 assert.equal(v.origin.classId,'7F39');
 assert.equal(v.slots.length,18);
 assert.equal(v.remainingConflicts.length,0);
 d.versions.push({...v.version,id:'zzzz-TKB-2026-11-09-999',fromDate:'2026-11-09'});
 d.slots.push(...v.slots.map(x=>({...x,versionId:'zzzz-TKB-2026-11-09-999'})));
 for(const week of ['2026-11-09','2026-11-16','2026-11-23']){
   const e=eventsForWeek(d,week);
   assert.equal(e.length,18);assert.equal(conflicts(e).length,0);
   const start=week;
   assert.ok(e.some(x=>x.date===start.replace(/\d{2}$/,(n)=>String(Number(n)+4).padStart(2,'0'))&&x.classId==='7F39'&&x.subject==='Tin'&&x.shift==='S'&&x.period===1));
 }
 assert.equal(tutoringForWeek(d,'2026-11-09').length,0);
});

test('Đổi môn chỉ khi lớp có phân công; chọn ô đã có lịch thì báo lỗi',()=>{
 const d=data();
 const changed=previewMainRevision(d,{sourceSlotId:'S-9-9',fromDate:'2026-11-09',day:5,shift:'S',period:3,classId:'9F43',subject:'Tin',stream:''});
 assert.equal(changed.changed.subject,'Tin');assert.equal(changed.changed.stream,'TIN');
 assert.equal(changed.remainingConflicts.length,1,'Đổi môn không tự loại bỏ trùng thời gian');
 assert.throws(()=>previewMainRevision(d,{sourceSlotId:sourceId,fromDate:'2026-11-09',day:5,shift:'S',period:2,classId:'7F39',subject:'Tin',stream:'TIN'}),/Ô đích/);
 assert.throws(()=>previewMainRevision(d,{sourceSlotId:sourceId,fromDate:'2026-11-09',...patch,subject:'Toán'}),/chưa được phân công/);
 assert.throws(()=>previewMainRevision(d,{sourceSlotId:sourceId,fromDate:'2026-11-12',...patch}),/thứ Hai/);
});

test('GAS tạo bản TKB mới, ghi và xác minh, không xóa phiên bản cũ và có nhật ký',()=>{
 const tabs={classes:structuredClone(seed.classes),versions:structuredClone(seed.versions),slots:structuredClone(seed.slots),changes:[],audit_log:[]};
 const methods={};
 const ctx={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,Utilities:{getUuid:()=>`12345678-1234-4567-8910-${(tabs.versions.length+1).toString().padStart(12,'0')}`,formatDate:(d)=>d.toISOString().slice(0,10)},SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>({getLastRow:()=>tabs[name].length+1,deleteRow:(n)=>tabs[name].splice(n-2,1),deleteRows:(r,n)=>tabs[name].splice(r-2,n)})}),flush:()=>{}}};
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8')+'\nthis.revise=reviseMainSchedule_;',ctx);
 ctx.read_=n=>structuredClone(tabs[n]||[]);
 ctx.appendBatch_=(name,rows)=>{tabs[name]??=[];tabs[name].push(...structuredClone(rows));};
 vm.runInContext('read_=this.read_;appendBatch_=this.appendBatch_',ctx);
 const before=JSON.stringify(seed.slots);
 const result=ctx.revise({fromDate:'2026-11-09',expectedVersionId:'v4-2026',sourceSlotId:sourceId,patch,reason:'Điều chỉnh trùng lịch'});
 assert.equal(result.ok,true);assert.equal(result.verified,true);
 assert.equal(tabs.versions.length,2);assert.equal(tabs.slots.length,36);
 assert.equal(JSON.stringify(tabs.slots.slice(0,18)),before);
 assert.equal(tabs.audit_log.length,1);assert.equal(tabs.audit_log[0].action,'SAVE_VERSION');
 const next=data();next.versions=tabs.versions;next.slots=tabs.slots;
 assert.equal(activeVersion(next,'2026-11-09').id,result.versionId);
 assert.equal(conflicts(eventsForWeek(next,'2026-11-16')).length,0);
 assert.throws(()=>ctx.revise({fromDate:'2026-11-09',expectedVersionId:'v4-2026',sourceSlotId:sourceId,patch}),/Phiên bản TKB đã thay đổi/);
 assert.equal(tabs.versions.length,2);
});

test('Khi áp dụng từ tuần 11, tuần 10 và các mốc đã dạy không bị thay đổi',()=>{
 const d=data(),before=eventsForWeek(d,'2026-11-09').map(x=>[x.id,x.date,x.subject,x.classId,x.stream]);
 const v=previewMainRevision(d,{sourceSlotId:sourceId,fromDate:'2026-11-16',...patch});
 d.versions.push({...v.version,id:'zzzz-TKB-2026-11-16-999',fromDate:'2026-11-16'});
 d.slots.push(...v.slots.map(x=>({...x,versionId:'zzzz-TKB-2026-11-16-999'})));
 assert.equal(activeVersion(d,'2026-11-09').id,'v4-2026');
 assert.deepEqual(eventsForWeek(d,'2026-11-09').map(x=>[x.id,x.date,x.subject,x.classId,x.stream]),before);
 assert.equal(conflicts(eventsForWeek(d,'2026-11-09')).length,1);
 assert.equal(conflicts(eventsForWeek(d,'2026-11-16')).length,0);
});

test('Thêm tiết chính khóa một lần, tự xuất hiện ở mọi tuần tiếp theo',()=>{
 const d=data();
 const beforeWeek10=eventsForWeek(d,'2026-11-09');
 const patch={day:7,shift:'S',period:1,classId:'7F38',subject:'Toán',stream:''};
 const v=previewMainRevision(d,{fromDate:'2026-11-16',...patch});
 assert.equal(v.operation,'ADD');assert.equal(v.origin,null);assert.equal(v.slots.length,19);
 assert.equal(v.remainingConflicts.length,1,'Trùng tiết cũ cần được giữ cảnh báo, không ngầm xóa');
 const newVersionId='zzzz-TKB-2026-11-16-999';
 d.versions.push({...v.version,id:newVersionId,fromDate:'2026-11-16'});
 d.slots.push(...v.slots.map(x=>({...x,versionId:newVersionId})));
 assert.equal(eventsForWeek(d,'2026-11-09').length,beforeWeek10.length,'Không đổi tuần đã qua');
 for(const week of ['2026-11-16','2026-11-23','2026-11-30']){
  const found=eventsForWeek(d,week).filter(x=>x.kind==='MAIN'&&x.id==='PREVIEW-NEW-OFFICIAL');
  assert.equal(found.length,1,`Tuần ${week} phải giữ một tiết mới`);
  assert.equal(found[0].date,addFour(week));
  assert.equal(found[0].subject,'Toán');assert.equal(found[0].classId,'7F38');
 }
 function addFour(mondayIso){const d=new Date(mondayIso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+5);return d.toISOString().slice(0,10)}
 assert.throws(()=>previewMainRevision(d,{fromDate:'2026-11-16',day:7,shift:'S',period:1,classId:'7F38',subject:'Toán'}),/Ô đích/);
});

test('Apps Script thêm tiết cố định vào phiên bản mới và đọc lại bằng mã ID từ máy chủ',()=>{
 const tabs={classes:structuredClone(seed.classes),versions:structuredClone(seed.versions),slots:structuredClone(seed.slots),changes:[],audit_log:[]};
 const ctx={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,Utilities:{getUuid:()=>`abcdef12-abcd-4567-8910-${(tabs.versions.length+1).toString().padStart(12,'0')}`,formatDate:(d)=>d.toISOString().slice(0,10)},SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>({getLastRow:()=>tabs[name].length+1,deleteRow:n=>tabs[name].splice(n-2,1),deleteRows:(r,n)=>tabs[name].splice(r-2,n)})}),flush:()=>{}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8')+'\nthis.revise=reviseMainSchedule_;',ctx);
 ctx.read_=n=>structuredClone(tabs[n]||[]);
 ctx.appendBatch_=(name,rows)=>{tabs[name]??=[];tabs[name].push(...structuredClone(rows));};
 vm.runInContext('read_=this.read_;appendBatch_=this.appendBatch_',ctx);
 const origin=JSON.stringify(tabs.slots);
 const result=ctx.revise({fromDate:'2026-11-09',expectedVersionId:'v4-2026',sourceSlotId:'',patch:{day:7,shift:'S',period:1,classId:'7F38',subject:'Toán',stream:''},reason:'Thêm 1 tiết thủ công, lặp các tuần'});
 assert.equal(result.ok,true);assert.equal(result.verified,true);assert.equal(result.operation,'ADD');
 assert.ok(result.sourceSlotId.startsWith('MANUAL-'));
 assert.equal(tabs.versions.length,2);assert.equal(tabs.slots.length,37);
 assert.equal(JSON.stringify(tabs.slots.slice(0,18)),origin);
 assert.equal(tabs.audit_log[0].action,'ADD_WEEKLY_SLOT');
 const restored=data();restored.versions=tabs.versions;restored.slots=tabs.slots;
 for(const week of ['2026-11-09','2026-11-16','2026-11-23']){
  assert.equal(eventsForWeek(restored,week).filter(x=>x.id===result.sourceSlotId).length,1);
 }
 assert.throws(()=>ctx.revise({fromDate:'2026-11-09',expectedVersionId:'v4-2026',sourceSlotId:'',patch:{day:7,shift:'S',period:1,classId:'7F38',subject:'Toán'}}),/Phiên bản TKB đã thay đổi/);
 assert.equal(tabs.versions.length,2,'Không thêm trùng nếu gửi lại với phiên bản cũ');
});
