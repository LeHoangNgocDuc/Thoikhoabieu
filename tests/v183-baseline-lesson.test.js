import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ppctSequence,eventsForWeek,progressAt,normalizeSheetData} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
const gas=fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8');
function setup(){
 const tabs=Object.fromEntries(['classes','ppct','baselines','changes','lesson_edits','audit_log'].map(k=>[k,structuredClone(seed[k]||[])]));
 const fakeSheet=name=>({
  getLastRow:()=>tabs[name].length+1,
  getRange:(start,col,h,w)=>({setValues:vals=>{for(let i=0;i<vals.length;i++){const keys=c.TABLES[name];tabs[name][start-2+i]=Object.fromEntries(keys.map((k,j)=>[k,vals[i][j]]));}}}),
  deleteRow:at=>tabs[name].splice(at-2,1)
 });
 const c={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,
  SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:fakeSheet}),flush:()=>{}},
  Utilities:{getUuid:()=> 'abc-123',formatDate:d=>d.toISOString().slice(0,10)}};
 vm.createContext(c);vm.runInContext(gas+'\nthis.TABLES=TABLES;this.saveLesson=saveBaselineLesson_;',c);
 c.read_=name=>structuredClone(tabs[name]||[]).map(x=>name==='baselines'?{...x,confirmed:String(x.confirmed).toLowerCase()==='true',nextIndex:Number(x.nextIndex)}:x);
 c.appendBatch_=(name,rows)=>tabs[name].push(...structuredClone(rows));
 c.audit_=record=>tabs.audit_log.push(structuredClone(record));
 vm.runInContext('read_=this.read_;appendBatch_=this.appendBatch_;audit_=this.audit_;',c);
 return {tabs,c,state:()=>normalizeSheetData({...seed,...structuredClone(tabs)})};
}
function request(c,b,seq,index,title,expected={}){return c.saveLesson({baselineId:b.id,nextIndex:index,ppctId:seq[index].id,title,
 expectedNextIndex:expected.nextIndex??b.nextIndex,expectedConfirmed:String(expected.confirmed??b.confirmed).toLowerCase()==='true',expectedEditTitle:expected.title??''});}
test('teacher selects starting lesson and edits title; saves baseline and title under one lock-protected operation',()=>{
 const {tabs,c,state}=setup(),b=tabs.baselines.find(x=>x.classId==='9F43'&&x.stream==='ĐS'),seq=ppctSequence(state(),9,'Toán','ĐS');
 const result=request(c,b,seq,29,'Luyện tập phần Đại số 9 (thầy điều chỉnh)');
 assert.equal(result.verified,true);assert.equal(tabs.baselines.find(x=>x.id===b.id).nextIndex,29);
 assert.equal(tabs.lesson_edits.length,1);assert.equal(tabs.lesson_edits[0].ppctId,seq[29].id);
 assert.equal(ppctSequence(state(),9,'Toán','ĐS','9F43')[29].title,'Luyện tập phần Đại số 9 (thầy điều chỉnh)');
 assert.equal(ppctSequence(state(),9,'Toán','ĐS','9F46')[29].title,seq[29].title);
 assert.equal(seq[29].title,seed.ppct.find(x=>x.id===seq[29].id).title);
 assert.equal(tabs.audit_log.at(-1).action,'SAVE_BASELINE_LESSON');
 const reload=state(),week=eventsForWeek(reload,'2026-11-09').filter(x=>x.classId==='9F43'&&x.stream==='ĐS');
 assert.equal(week[0].ppct.id,seq[29].id);assert.equal(week[0].ppct.title,'Luyện tập phần Đại số 9 (thầy điều chỉnh)');
 assert.equal(week[1].ppct.id,seq[30].id); // next lesson advances, not repeating the edited title
 const nextWeek=eventsForWeek(reload,'2026-11-16').filter(x=>x.classId==='9F43'&&x.stream==='ĐS');
 assert.ok(nextWeek[0].ppct);assert.ok(nextWeek[0].ppct.id!==seq[29].id);
});
test('same lesson can be renamed later, and original title can be restored',()=>{
 const {tabs,c,state}=setup(),b=tabs.baselines.find(x=>x.classId==='7F38'&&x.stream==='HH'),seq=ppctSequence(state(),7,'Toán','HH');
 request(c,b,seq,17,'Sửa tên bài 1');
 let current=tabs.baselines.find(x=>x.id===b.id);
 request(c,current,seq,17,'Sửa tên bài 2',{title:'Sửa tên bài 1'});
 assert.equal(tabs.lesson_edits.length,1);assert.equal(tabs.lesson_edits[0].title,'Sửa tên bài 2');
 current=tabs.baselines.find(x=>x.id===b.id);
 request(c,current,seq,17,seq[17].title,{title:'Sửa tên bài 2'});
 assert.equal(tabs.lesson_edits[0].title,'');
 assert.equal(ppctSequence(state(),7,'Toán','HH','7F38')[17].title,seq[17].title);
});
test('stale client rejected; exact retry remains idempotent',()=>{
 const {tabs,c,state}=setup(),b=tabs.baselines.find(x=>x.classId==='7F39'&&x.stream==='TIN'),seq=ppctSequence(state(),7,'Tin','TIN');
 request(c,b,seq,10,'Bài cá nhân hóa');
 assert.throws(()=>request(c,b,seq,12,'Bài khác'),/thiết bị khác/i);
 const fresh=tabs.baselines.find(x=>x.id===b.id);
 const retry=request(c,b,seq,10,'Bài cá nhân hóa');assert.equal(retry.alreadySaved,true);
 assert.equal(fresh.nextIndex,10);
});
test('confirmed completed lessons stop retroactive baseline pointer changes, names remain independently editable',()=>{
 const {tabs,c,state}=setup(),b=tabs.baselines.find(x=>x.classId==='9F43'&&x.stream==='ĐS'),seq=ppctSequence(state(),9,'Toán','ĐS');
 tabs.changes.push({id:'DONE-1',date:'2026-11-10',classId:b.classId,subject:b.subject,stream:b.stream,completed:true,action:'DONE',kind:'MAIN',ppctId:seq[24].id});
 assert.throws(()=>request(c,b,seq,26,'Thay đầu bài'),/không được đổi mốc/i);
 assert.equal(tabs.baselines.find(x=>x.id===b.id).nextIndex,b.nextIndex);
 assert.throws(()=>request(c,b,seq,24,'Tên bài sửa cho các tiết sau'),/Bài đã xác nhận/);
 assert.equal(request(c,b,seq,24,seq[24].title).verified,true);
});
test('draft title editor and snapshot persist independent lesson edits; no tutoring PPCT impact',()=>{
 const d=normalizeSheetData({...seed,lesson_edits:[{id:'LE-7F38-M7-ĐS-20',classId:'7F38',subject:'Toán',stream:'ĐS',ppctId:'M7-ĐS-20',title:'Tên riêng'}]});
 const a=progressAt(seed,'7F38','Toán','ĐS','2026-11-15'),b=progressAt(d,'7F38','Toán','ĐS','2026-11-15');
 assert.deepEqual({planned:a.planned,actual:a.actual,delta:a.delta},{planned:b.planned,actual:b.actual,delta:b.delta});
 assert.equal(ppctSequence(d,7,'Toán','ĐS','7F38').find(x=>x.id==='M7-ĐS-20').title,'Tên riêng');
});
