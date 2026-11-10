import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSnapshot,validateSnapshot,snapshotText} from '../src/cache.js';
import {eventsForWeek,conflicts,tutoringForWeek,moveCollision,validateOfficialScope,normalizeSheetData} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
const state=()=>normalizeSheetData(structuredClone(seed));
test('Read-only cache only accepts verified Google snapshots, never stores audit or session tokens',()=>{
 const snap=createSnapshot(state(),'2026-11-10T00:00:00.000Z');
 assert.equal(snap.source,'verified-google-sheets');assert.equal(snap.data.classes.length,7);
 assert.equal(snap.data.slots.length,18);assert.equal(snap.data.ppct.length,350);
 assert.equal(Object.hasOwn(snap.data,'audit_log'),false);
 assert.equal(validateSnapshot(snapshotText(state())).data.extra_patterns.length,0);
 assert.equal(validateSnapshot(JSON.stringify({...snap,source:'demo'})),null);
 assert.equal(validateSnapshot('{garbage'),null);
});
test('Only scope C requires Algebra/Geometry string; scopes A/B ignore stale input',()=>{
 assert.deepEqual(validateOfficialScope('one',''),[]);
 assert.deepEqual(validateOfficialScope('following','HH,invalid'),[]);
 assert.throws(()=>validateOfficialScope('future',''),/Chọn C/);
 assert.deepEqual(validateOfficialScope('future','ĐS,ĐS,HH,ĐS'),['ĐS','ĐS','HH','ĐS']);
});
test('A single collided official period can move by exact slot id while preserving other class',()=>{
 const d=state(),date='2026-11-12';const before=eventsForWeek(d,'2026-11-09');
 const target=before.find(x=>x.date===date&&x.shift==='S'&&x.period===3&&x.subject==='Tin');
 assert.ok(target);assert.equal(conflicts(before).length,1);
 const move=moveCollision(d,target.id,date,'2026-11-13','S',1);
 assert.equal(move.action,'MOVE');assert.equal(move.sourceSlotId,target.id);
 d.changes.push(move);
 const after=eventsForWeek(d,'2026-11-09');
 assert.equal(after.length,18);assert.equal(conflicts(after).length,0);
 assert.ok(after.some(e=>e.date==='2026-11-13'&&e.shift==='S'&&e.period===1&&e.classId==='7F39'));
 assert.ok(after.some(e=>e.date==='2026-11-12'&&e.shift==='S'&&e.period===3&&e.classId==='9F43'));
 assert.equal(conflicts(eventsForWeek(d,'2026-11-16')).length,1,'Only current occurrence moves; next week is unchanged');
});
test('Moving a filled slot is rejected, and dạy thêm remains independent',()=>{
 const d=state();const target=eventsForWeek(d,'2026-11-09').find(e=>e.subject==='Tin'&&e.date==='2026-11-12'&&e.shift==='S'&&e.period===3);
 assert.throws(()=>moveCollision(d,target.id,'2026-11-12','2026-11-13','S',2),/Ô đích đã có tiết/);
 d.extra_patterns.push({id:'EXP-1',day:6,shift:'T',period:1,subject:'Toán',groups:['7F38','Nhóm A'],fromDate:'2026-11-13',startLesson:1,active:true});
 assert.equal(tutoringForWeek(d,'2026-11-09').length,1);
 assert.equal(eventsForWeek(d,'2026-11-09').length,18);
});

test('Apps Script preserves old saveOfficialChange op and accepts safe per-slot MOVE',async()=>{
 const vm=await import('node:vm');
 const code=fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8');
 const tables={classes:structuredClone(seed.classes),ppct:structuredClone(seed.ppct),slots:structuredClone(seed.slots),versions:structuredClone(seed.versions),changes:[],ppct_overrides:[],audit_log:[]};
 const c={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,Utilities:{getUuid:()=>`a-${tables.audit_log.length+1}`}};
 c.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:name=>({getRange:row=>({setValues:rows=>{const keys=vm.runInContext(`TABLES.${name}`,c);tables[name][row-2]=Object.fromEntries(keys.map((k,i)=>[k,rows[0][i]]));}})})})};
 vm.createContext(c);vm.runInContext(code+'\nthis.saveMove=saveOfficialChange_',c);
 c.read_=name=>structuredClone(tables[name]||[]);
 c.appendBatch_=(name,rows)=>{tables[name]??=[];tables[name].push(...structuredClone(rows));};
 vm.runInContext('read_=this.read_;appendBatch_=this.appendBatch_',c);
 const source=eventsForWeek(seed,'2026-11-09').find(x=>x.classId==='7F39'&&x.date==='2026-11-12');
 const valid=moveCollision(state(),source.id,source.date,'2026-11-13','S',1);
 const saved=c.saveMove({row:valid,expectedUpdatedAt:'',reason:'Xếp lại TKB'});
 assert.equal(saved.ok,true);assert.equal(tables.changes.length,1);assert.equal(tables.changes[0].sourceSlotId,source.id);
 assert.equal(tables.slots.length,18,'Original school timetable stays intact');
 const invalid={...valid,id:'another',movePeriod:2};
 assert.throws(()=>c.saveMove({row:invalid,expectedUpdatedAt:''}),/Ô đến đang có chính khóa|Có điều chỉnh khác/);
});
