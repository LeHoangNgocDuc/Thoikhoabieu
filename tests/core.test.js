import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {monday,addDays,schoolWeek,activeVersion,eventsForWeek,conflicts,ppctSequence,project} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
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
