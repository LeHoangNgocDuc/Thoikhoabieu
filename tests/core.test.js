import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {monday,addDays,schoolWeek,activeVersion,eventsForWeek,conflicts,ppctSequence,project,normalizeSheetData} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
// Legacy regression fixture intentionally reproduces the historical Thursday
// conflict. The production seed/real 2026-11-09 timetable is already corrected.
{ const slot=seed.slots.find(x=>x.id==='S-9-9'); if(slot){slot.day=5;slot.period=3;} }
test('week starts Monday, full seven days',()=>{assert.equal(monday('2026-11-15'),'2026-11-09');assert.equal(addDays('2026-11-09',6),'2026-11-15');assert.equal(schoolWeek('2026-11-09'),10);assert.equal(schoolWeek('2027-01-18'),19);assert.equal(schoolWeek('2027-02-15'),22);assert.equal(schoolWeek('2027-02-08'),0);});
test('seed has correct courses and 350 PPCT',()=>{assert.equal(seed.classes.length,7);assert.equal(seed.slots.length,18);assert.equal(seed.ppct.length,350);assert.equal(ppctSequence(seed,7,'Toán','ĐS').length,80);assert.equal(ppctSequence(seed,7,'Toán','HH').length,60);assert.equal(ppctSequence(seed,9,'Toán','ĐS').length,82);assert.equal(ppctSequence(seed,9,'Toán','HH').length,58);});
test('slot only valid for currently active version',()=>{assert.equal(activeVersion(seed,'2026-11-09').id,'v4-2026');assert.equal(activeVersion(seed,'2027-01-01').id,'v4-2026');});
test('week includes schedules, detects actual conflict in source',()=>{const events=eventsForWeek(seed,'2026-11-09');assert.equal(events.length,18);const bad=conflicts(events);assert.equal(bad.length,1);assert.equal(bad[0].key,'2026-11-12|S|3');});
test('OFF does not consume PPCT but next class lesson moves forward',()=>{
 const state=structuredClone(seed);const events=eventsForWeek(state,'2026-11-09');const first=events.find(e=>e.classId==='7F38'&&e.subject==='Toán'&&e.stream==='ĐS');assert.ok(first);
 state.changes.push({id:'x1',date:first.date,shift:first.shift,period:first.period,action:'OFF'});
 const changed=eventsForWeek(state,'2026-11-09');const rest=changed.filter(e=>e.classId==='7F38'&&e.subject==='Toán'&&e.stream==='ĐS');
 assert.ok(rest.length>=2);assert.equal(rest[0].status,'OFF');assert.equal(rest[0].ppct?.id,rest[1].ppct?.id);
});
test('independent class and stream tracking',()=>{
 const events=eventsForWeek(seed,'2026-11-09');const a=events.find(e=>e.classId==='9F43'&&e.subject==='Toán'&&e.stream==='HH');const b=events.find(e=>e.classId==='9F46'&&e.subject==='Toán'&&e.stream==='HH');assert.ok(a?.ppct);assert.ok(b?.ppct);assert.equal(a.ppct.id,b.ppct.id);
});

test('Google Sheet transport with string day/period is normalized and week 10 displays',()=>{
 const data=structuredClone(seed);
 for(const x of data.slots){x.day=String(x.day);x.period=String(x.period);}
 for(const x of data.classes){x.grade=String(x.grade);x.subjects=JSON.stringify(x.subjects);}
 for(const x of data.baselines){x.nextIndex=String(x.nextIndex);x.confirmed='FALSE';}
 assert.equal(typeof eventsForWeek(data,'2026-11-09')[0].period,'string','Unnormalized Google values cannot match numeric table cells');
 const normalized=normalizeSheetData(data);
 assert.equal(typeof normalized.slots[0].period,'number');
 assert.equal(eventsForWeek(normalized,'2026-11-09').length,18);
 assert.equal(conflicts(eventsForWeek(normalized,'2026-11-09')).length,1);
});

test('math stream order explicitly matches the new alternating plan',async()=>{
 const {mathStreamPattern}=await import('../src/core.js');
 assert.deepEqual(mathStreamPattern(3,1),['ĐS','ĐS','HH','ĐS']);
 assert.deepEqual(mathStreamPattern(2,2),['ĐS','HH','ĐS','HH']);
 assert.deepEqual(mathStreamPattern(2,1),['ĐS','HH','ĐS']);
 assert.deepEqual(mathStreamPattern(4,0),['ĐS','ĐS','ĐS','ĐS']);
});

test('free-text multiple extra classes are one joint session without false conflict',()=>{
 const data=structuredClone(seed);
 data.changes.push({id:'EXTRA-GROUP',date:'2026-11-15',shift:'T',period:1,action:'ADD',classId:'Nhóm Toán 7A, Nhóm Toán 7B',subject:'Toán',stream:'ĐS',kind:'EXTRA',notes:'Ôn tập',completed:false});
 const lessons=eventsForWeek(data,'2026-11-09');
 const extras=lessons.filter(e=>e.kind==='EXTRA');
 assert.equal(extras.length,1);
 assert.equal(extras[0].classId,'Nhóm Toán 7A, Nhóm Toán 7B');
 assert.equal(extras[0].ppct,null);
 assert.equal(conflicts(lessons).length,1,'Existing source conflict only, not the joint tutoring group');
});

test('V1.3 separate tuition sessions never change official curriculum',async()=>{
 const {tutoringForWeek}=await import('../src/core.js');
 const state=structuredClone(seed);
 state.extra_sessions=[{id:'E1',date:'2026-11-15',shift:'T',period:1,subject:'Toán',groups:['7F38','7F39','Lớp nâng cao'],notes:'Ôn tập',completed:false}];
 const original=eventsForWeek(state,'2026-11-09');
 const tutor=tutoringForWeek(state,'2026-11-09');
 assert.equal(original.length,18);
 assert.equal(tutor.length,1);
 assert.deepEqual(tutor[0].groups,['7F38','7F39','Lớp nâng cao']);
 assert.equal(tutor[0].ppct,null);
 assert.equal(conflicts([...original,...tutor]).length,1);
});
test('V1.3 course name date corruption is recovered only for recognized classes',()=>{
 const data=structuredClone(seed);
 data.classes[0].name='2026-08-31T17:00:00.000Z';
 const normalized=normalizeSheetData(data);
 assert.equal(normalized.classes[0].name,'7/2');
 assert.equal(normalized.classes[1].name,'7/3');
});
test('V1.3 sessions permit classes as JSON strings and custom names',async()=>{
 const {tutoringForWeek,parseGroups}=await import('../src/core.js');
 assert.deepEqual(parseGroups('Nhóm A, Nhóm B; Nhóm A'),['Nhóm A','Nhóm B']);
 const state=normalizeSheetData({...seed,extra_sessions:[{id:'E2',date:'2026-11-14',shift:'T',period:'2',subject:'Tin',groups:'["7F38","7F39","Học sinh tự do"]',completed:'FALSE'}]});
 const list=tutoringForWeek(state,'2026-11-09');
 assert.equal(list[0].period,2);
 assert.deepEqual(list[0].groups,['7F38','7F39','Học sinh tự do']);
 assert.equal(list[0].status,'PLANNED');
});
test('V1.3 official vs tutoring at same time is a real conflict',async()=>{
 const {tutoringForWeek}=await import('../src/core.js');
 const state=normalizeSheetData({...seed,extra_sessions:[{id:'E3',date:'2026-11-09',shift:'C',period:1,subject:'Toán',groups:['Nhóm A','Nhóm B'],completed:false}]});
 const actual=conflicts([...eventsForWeek(state,'2026-11-09'),...tutoringForWeek(state,'2026-11-09')]);
 assert.ok(actual.find(x=>x.key==='2026-11-09|C|1'));
 // It is one tutor SESSION, never a false extra pairwise conflict between its two groups.
 const solo=conflicts(tutoringForWeek(state,'2026-11-09'));
 assert.equal(solo.length,0);
});
