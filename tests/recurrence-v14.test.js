import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeSheetData,eventsForWeek,tutoringForWeek,conflicts} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
// Legacy regression fixture intentionally reproduces the historical Thursday
// conflict. The production seed/real 2026-11-09 timetable is already corrected.
{ const slot=seed.slots.find(x=>x.id==='S-9-9'); if(slot){slot.day=5;slot.period=3;} }
const pattern={id:'EXP1',day:8,shift:'T',period:1,subject:'Toán',groups:['7F38','7F39','Nhóm bồi dưỡng'],notes:'Ôn tập',fromDate:'2026-11-15',toDate:'',startLesson:4,active:true};
const make=(patterns=[pattern],sessions=[])=>normalizeSheetData({...structuredClone(seed),extra_patterns:patterns,extra_sessions:sessions});
test('V1.4 default weekly tutoring survives following weeks and class lists are preserved',()=>{
 const state=make();
 const w10=tutoringForWeek(state,'2026-11-09'),w11=tutoringForWeek(state,'2026-11-16'),w12=tutoringForWeek(state,'2026-11-23');
 assert.equal(w10.length,1);assert.equal(w10[0].date,'2026-11-15');assert.equal(w10[0].lessonNumber,4);
 assert.equal(w11[0].date,'2026-11-22');assert.equal(w11[0].lessonNumber,5);
 assert.equal(w12[0].date,'2026-11-29');assert.equal(w12[0].lessonNumber,6);
 assert.deepEqual(w12[0].groups,['7F38','7F39','Nhóm bồi dưỡng']);assert.equal(w12[0].kind,'EXTRA');
});
test('V1.4 week-only override does not change following weeks',()=>{
 const state=make([pattern],[{id:'OV1',date:'2026-11-22',shift:'T',period:1,subject:'Tin',groups:['Tin nhóm B'],notes:'Thực hành',completed:true,patternId:'EXP1',action:'EDIT'}]);
 assert.equal(tutoringForWeek(state,'2026-11-16')[0].subject,'Tin');
 assert.equal(tutoringForWeek(state,'2026-11-16')[0].status,'DONE');
 assert.deepEqual(tutoringForWeek(state,'2026-11-23')[0].groups,pattern.groups);
 assert.equal(tutoringForWeek(state,'2026-11-23')[0].status,'PLANNED');
});
test('V1.4 cancelled week disappears and the next active class keeps sequential lesson number',()=>{
 const state=make([pattern],[{id:'CV1',date:'2026-11-22',shift:'T',period:1,subject:'Toán',groups:['7F38'],completed:false,patternId:'EXP1',action:'CANCEL'}]);
 assert.equal(tutoringForWeek(state,'2026-11-16').length,0);
 assert.equal(tutoringForWeek(state,'2026-11-23')[0].lessonNumber,5);
});
test('V1.4 ending pattern keeps past sessions and hides future',()=>{
 const state=make([{...pattern,toDate:'2026-11-21'}]);
 assert.equal(tutoringForWeek(state,'2026-11-09').length,1);
 assert.equal(tutoringForWeek(state,'2026-11-16').length,0);
});
test('V1.4 existing one-time rows remain visible even without extra_patterns sheet rows',()=>{
 const state=make([], [{id:'EXold',date:'2026-11-22',shift:'C',period:'4',subject:'Tin',groups:'["Nhóm A","Nhóm B"]',completed:'FALSE'}]);
 assert.equal(tutoringForWeek(state,'2026-11-16').length,1);
 assert.equal(tutoringForWeek(state,'2026-11-23').length,0);
 assert.equal(tutoringForWeek(state,'2026-11-16')[0].lessonNumber,1);
});
test('V1.4 recurring extra lessons do not alter curriculum or create a fake collision between joint classes',()=>{
 const state=make();const events=eventsForWeek(state,'2026-11-09');
 assert.equal(events.length,18);assert.equal(tutoringForWeek(state,'2026-11-09').length,1);
 assert.equal(conflicts([...events,...tutoringForWeek(state,'2026-11-09')]).length,1);
});
test('V1.4 pattern serialization from Google Sheets preserves arrays and booleans',()=>{
 const x=make([{...pattern,day:'8',period:'1',startLesson:'3',groups:'["7F38","Lớp ôn tập"]',active:'TRUE'}]);
 assert.equal(x.extra_patterns[0].day,8);assert.equal(x.extra_patterns[0].active,true);
 assert.equal(tutoringForWeek(x,'2026-11-16')[0].lessonNumber,4);
});
