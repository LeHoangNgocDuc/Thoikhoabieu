import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {normalizeSheetData,tutoringForWeek,eventsForWeek,extraSlotOverlap} from '../src/core.js';
const gas=fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8');
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
function backend(){
 const tables={...Object.fromEntries(['extra_sessions','extra_patterns','extra_requests','audit_log'].map(k=>[k,[]])),classes:structuredClone(seed.classes),slots:structuredClone(seed.slots),versions:structuredClone(seed.versions),ppct:structuredClone(seed.ppct)};
 const ctx={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,
  Utilities:{DigestAlgorithm:{SHA_256:'SHA_256'},computeDigest:(_alg,text)=>[...crypto.createHash('sha256').update(text).digest()].map(x=>x>127?x-256:x),formatDate:(v)=>{let y=v.getUTCFullYear(),m=v.getUTCMonth()+1,d=v.getUTCDate();return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;},getUuid:()=>`UUID${Date.now()}`}};
 ctx.SpreadsheetApp={flush:()=>{},getActiveSpreadsheet:()=>({getSheetByName:name=>({getRange:row=>({setValues:values=>{
  const headers=vm.runInContext(`TABLES.${name}`,ctx);
  const raw=values[0];const obj={};headers.forEach((key,i)=>{let val=raw[i];if(['groups','classIds','customGroups'].includes(key)&&typeof val==='string'){try{val=JSON.parse(val)}catch{}}if(['active','completed'].includes(key))val=val===true||val==='true';obj[key]=val;});
  tables[name][row-2]=obj;
 }}),deleteRow:row=>{tables[name].splice(row-2,1);}})})};
 vm.createContext(ctx);vm.runInContext(gas+'\nthis.mutate=mutateExtra_;this.read_=read_;this.appendBatch_=appendBatch_;',ctx);
 ctx.read_=table=>structuredClone(tables[table]||[]);
 ctx.appendBatch_=(table,records)=>{if(!tables[table])tables[table]=[];tables[table].push(...structuredClone(records))};
 vm.runInContext('read_=this.read_;appendBatch_=this.appendBatch_;',ctx);
 return {tables,mutate:body=>ctx.mutate(body),snapshot:()=>normalizeSheetData(structuredClone(tables))};
}
const draft=(date='2026-11-23',groups=['7F38','7F39','Toán nâng cao'])=>({date,shift:'T',period:1,subject:'Toán',groups,
 classIds:['7F38','7F39'],customGroups:['Toán nâng cao'],lessonTitle:'Luyện tập nâng cao',notes:'',startTime:'18:00',endTime:'19:30',lessonNumber:3,repeatRule:'weekly',completed:false});
let request=0;
function run(b,action,row,entityId='',expectedRevision=null,props={}){const requestId='test-request-'+String(++request).padStart(8,'0');return b.mutate({op:'mutateExtra',action,requestId,row,entityId,date:row?.date,expectedRevision,...props});}

test('V1.6 saves multiple classes as a single weekly tutoring pattern',()=>{
 const b=backend(),r=run(b,'CREATE',draft());assert.equal(r.ok,true);
 assert.equal(b.tables.extra_patterns.length,1);assert.equal(b.tables.extra_sessions.length,0);
 const wk12=tutoringForWeek(b.snapshot(),'2026-11-23'),wk13=tutoringForWeek(b.snapshot(),'2026-11-30'),wk14=tutoringForWeek(b.snapshot(),'2026-12-07');
 assert.equal(wk12.length,1);assert.equal(wk12[0].groups.length,3);assert.equal(wk12[0].lessonNumber,3);
 assert.equal(wk13.length,1);assert.equal(wk13[0].lessonNumber,4);
 assert.equal(wk14.length,1);assert.equal(wk14[0].lessonNumber,5);
 assert.equal(eventsForWeek(b.snapshot(),'2026-11-23').filter(x=>x.kind==='EXTRA').length,0);
});
test('V1.6 duplicate retry is idempotent and does not add another pattern',()=>{
 const b=backend(),req={op:'mutateExtra',action:'CREATE',requestId:'retry-request-00001',row:draft()};
 const r1=b.mutate(req),r2=b.mutate(req);assert.equal(r1.entityId,r2.entityId);assert.equal(r2.duplicateRequest,true);
 assert.equal(b.tables.extra_patterns.length,1);assert.equal(b.tables.extra_requests.length,1);
 assert.throws(()=>run(b,'CREATE',draft('2026-11-30',['Nhóm khác'])),/đã có một lịch/);
});
test('V1.6 one-day edit keeps future weeks and classes independent',()=>{
 const b=backend();const row=draft();const created=run(b,'CREATE',row);const mod=draft('2026-11-30',['7F38','Nhóm B']);mod.classIds=['7F38'];mod.customGroups=['Nhóm B'];
 run(b,'EDIT_ONCE',mod,created.entityId,1,{expectedOccurrenceRevision:0});
 const one=tutoringForWeek(b.snapshot(),'2026-11-30');assert.deepEqual(one[0].groups,['7F38','Nhóm B']);
 const next=tutoringForWeek(b.snapshot(),'2026-12-07');assert.deepEqual(next[0].groups,['7F38','7F39','Toán nâng cao']);
 assert.equal(b.tables.extra_sessions.length,1);
});
test('V1.6 split from week 14 preserves older weeks and carries date overrides',()=>{
 const b=backend();const created=run(b,'CREATE',draft());
 run(b,'CANCEL_ONCE',{date:'2026-12-14'},created.entityId,1);
 const newRow=draft('2026-12-07',['Ôn thi 9']);newRow.classIds=[];newRow.customGroups=['Ôn thi 9'];newRow.lessonNumber=5;
 const changed=run(b,'EDIT_FUTURE',newRow,created.entityId,1);
 assert.equal(changed.table,'extra_patterns');
 assert.equal(tutoringForWeek(b.snapshot(),'2026-11-23')[0].groups.length,3);
 assert.deepEqual(tutoringForWeek(b.snapshot(),'2026-12-07')[0].groups,['Ôn thi 9']);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-12-14').length,0);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-12-21').length,1);
});
test('V1.6 cancel a week does not remove later sessions',()=>{
 const b=backend();const created=run(b,'CREATE',draft());run(b,'CANCEL_ONCE',{date:'2026-11-30'},created.entityId,1);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-11-30').length,0);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-12-07').length,1);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-12-07')[0].lessonNumber,4);
});
test('V1.6 weekly until date and stopping recurrence',()=>{
 const b=backend();const row={...draft(),repeatRule:'until',endDate:'2026-12-07'};
 const created=run(b,'CREATE',row);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-12-07').length,1);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-12-14').length,0);
 run(b,'STOP_FUTURE',{date:'2026-11-30'},created.entityId,1);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-11-23').length,1);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-11-30').length,0);
});
test('V1.6 once to weekly conversion retains audit without duplicating occurrence',()=>{
 const b=backend();const row={...draft(),repeatRule:'once'};
 const created=run(b,'CREATE',row);assert.equal(b.tables.extra_sessions.length,1);
 const conversion=run(b,'CONVERT_ONCE',{...draft()},created.entityId,1);
 assert.equal(conversion.table,'extra_patterns');
 assert.equal(tutoringForWeek(b.snapshot(),'2026-11-23').length,1);
 assert.equal(tutoringForWeek(b.snapshot(),'2026-11-30').length,1);
 assert.equal(b.tables.extra_sessions[0].action,'CANCEL');
});
test('V1.6 optimistic revision prevents stale overwrites',()=>{
 const b=backend();const created=run(b,'CREATE',draft());
 run(b,'EDIT_ALL',draft(),created.entityId,1);
 assert.throws(()=>run(b,'EDIT_ALL',draft(),created.entityId,1),/thiết bị khác/);
});
test('V1.6 reject missing group, invalid time and do not alter PPCT',()=>{
 const b=backend(),oldPpct=JSON.stringify(b.tables.ppct),oldSlots=JSON.stringify(b.tables.slots);
 assert.throws(()=>run(b,'CREATE',draft('2026-11-23',[])),/từ 1 đến 60/);
 assert.throws(()=>run(b,'CREATE',{...draft(),endTime:'17:00'}),/Giờ kết thúc/);
 assert.equal(JSON.stringify(b.tables.ppct),oldPpct);
 assert.equal(JSON.stringify(b.tables.slots),oldSlots);
});
test('V1.6 overlap detects time collisions and different shifts as separate slots',()=>{
 const a={date:'2026-11-23',shift:'T',period:1,startTime:'18:00',endTime:'19:30'};
 assert.equal(extraSlotOverlap(a,{...a,period:2,startTime:'19:00',endTime:'20:30'}),true);
 assert.equal(extraSlotOverlap(a,{...a,shift:'C'}),false);
});
