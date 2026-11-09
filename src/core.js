export const DAYS=[{n:2,label:'Thứ 2'},{n:3,label:'Thứ 3'},{n:4,label:'Thứ 4'},{n:5,label:'Thứ 5'},{n:6,label:'Thứ 6'},{n:7,label:'Thứ 7'},{n:8,label:'Chủ nhật'}];
export const SHIFTS=[{id:'S',label:'Sáng',count:5},{id:'C',label:'Chiều',count:5},{id:'T',label:'Tối',count:2}];
export const SLOT_KEY=(shift,period)=>`${shift}${period}`;
export const scheduleKey=(d,s,p)=>`${d}|${s}|${p}`;
export function parseDate(iso){return new Date(`${iso}T12:00:00`)}
export function isoDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
export function addDays(date,n){const d=parseDate(date);d.setDate(d.getDate()+n);return isoDate(d)}
export function monday(date){const d=parseDate(date),day=d.getDay();return addDays(date,-((day+6)%7))}
export function schoolWeek(date){
 const mon=monday(date), start=monday('2026-09-07');
 // The provided 2026-2027 PPCT skips the weeks beginning 11/01 and 08/02/2027.
 if(mon==='2027-01-11'||mon==='2027-02-08')return 0;
 let week=Math.floor((parseDate(mon)-parseDate(start))/(7*86400000))+1;
 if(mon>='2027-01-18')week-=1;
 if(mon>='2027-02-15')week-=1;
 return week;
}
export function classById(state,id){return (state.classes||[]).find(c=>c.id===id)}
export function activeVersion(state,date){return [...(state.versions||[])].filter(v=>v.fromDate<=date).sort((a,b)=>b.fromDate.localeCompare(a.fromDate)||String(b.id).localeCompare(String(a.id)))[0]||null}
export function scheduleForDate(state,date){
 const ver=activeVersion(state,date);
 const day=parseDate(date).getDay()===0?8:parseDate(date).getDay()+1;
 const base=ver&&schoolWeek(date)!==0?(state.slots||[]).filter(x=>x.versionId===ver.id&&x.day===day).map(s=>({...s,date,changeId:'',status:'PLANNED'})):[];
 for(const ch of (state.changes||[]).filter(x=>x.date===date)){
  const index=base.findIndex(x=>x.shift===ch.shift&&x.period===Number(ch.period));
  if(ch.action==='CLEAR')continue;
  if(ch.action==='OFF'||ch.action==='DONE'||ch.action==='EDIT'){
   if(index>=0){const was=base[index];base[index]={...was,...(ch.action==='EDIT'?{classId:ch.classId||was.classId,subject:ch.subject||was.subject,stream:ch.stream||was.stream}:{}),status:ch.action==='OFF'?'OFF':ch.action==='DONE'?'DONE':'PLANNED',notes:ch.notes||was.notes,ppctId:ch.ppctId||'',changeId:ch.id};}
  }else if(ch.action==='ADD'){
   const event={id:ch.id,versionId:ver?.id||'',date,day,shift:ch.shift,period:Number(ch.period),classId:ch.classId,subject:ch.subject,stream:ch.stream||'',kind:ch.kind||'EXTRA',notes:ch.notes||'',status:ch.completed?'DONE':'PLANNED',ppctId:ch.ppctId||'',changeId:ch.id};
   // keep conflicts visible for audit instead of silently overwriting
   base.push(event);
  }
 }
 return base.sort((a,b)=>'SCT'.indexOf(a.shift)-'SCT'.indexOf(b.shift)||a.period-b.period);
}
export function conflicts(events){const map=new Map();for(const e of events){const k=scheduleKey(e.date,e.shift,e.period);if(e.status==='OFF')continue;map.set(k,[...(map.get(k)||[]),e]);}return [...map].filter(([,list])=>list.length>1).map(([key,items])=>({key,items}));}
export function ppctSequence(state,grade,subject,stream){return (state.ppct||[]).filter(p=>p.grade===grade&&p.subject===subject&&p.stream===stream).sort((a,b)=>(a.week||99)-(b.week||99)||a.period-b.period)}
export function applyStreamAssignments(state,weekEvents){
 const weeks={};for(const e of weekEvents){if(e.subject!=='Toán'||e.stream)continue;const wk=schoolWeek(e.date), key=`${e.classId}|${wk}`;(weeks[key]||=([])).push(e);}
 for(const [key,events] of Object.entries(weeks)){
  const [classId,wk]=key.split('|'),c=classById(state,classId);if(!c)continue;
  const dsCount=ppctSequence(state,c.grade,'Toán','ĐS').filter(x=>x.week===Number(wk)).length;
  const assigned=weekEvents.filter(e=>e.classId===classId&&schoolWeek(e.date)===Number(wk)&&e.subject==='Toán'&&e.stream==='ĐS').length;
  const remain=Math.max(0,dsCount-assigned);
  events.sort((a,b)=>a.date.localeCompare(b.date)||'SCT'.indexOf(a.shift)-'SCT'.indexOf(b.shift)||a.period-b.period);
  events.forEach((e,i)=>{e.stream=i<remain?'ĐS':'HH';e.streamInferred=true;});
 }
 return weekEvents;
}
export function project(state,untilDate){
 const baselines=state.baselines||[];
 const earliest=baselines.map(b=>b.fromDate).sort()[0]||monday(untilDate);
 const start=monday(earliest),end=addDays(monday(untilDate),6);
 const all=[];
 for(let week=start;week<=end;week=addDays(week,7)){
  const events=[];for(let i=0;i<7;i++)events.push(...scheduleForDate(state,addDays(week,i)));
  applyStreamAssignments(state,events);all.push(...events);
 }
 const pointer=new Map();for(const b of baselines)pointer.set(`${b.classId}|${b.subject}|${b.stream}`,Number(b.nextIndex)||0);
 for(const e of all){
  if(e.date<(baselines.find(b=>b.classId===e.classId&&b.subject===e.subject&&b.stream===e.stream)?.fromDate||'9999'))continue;
  const cls=classById(state,e.classId);if(!cls)continue;
  const key=`${e.classId}|${e.subject}|${e.stream}`;
  const seq=ppctSequence(state,cls.grade,e.subject,e.stream);
  let i=pointer.get(key);
  if(i===undefined){continue;}
  const match=e.ppctId?seq.findIndex(x=>x.id===e.ppctId):-1;
  if(match>=0)i=match;
  e.ppct=seq[i]||null;
  if(e.kind==='EXTRA'&&!e.ppctId){e.ppct=null;} // extra tutoring is independent of official PPCT
  if(e.status!=='OFF'&&e.ppct){pointer.set(key,Math.max(pointer.get(key),i+1));}
 }
 return {events:all,pointers:pointer};
}
export function eventsForWeek(state,week){return project(state,addDays(monday(week),6)).events.filter(e=>e.date>=monday(week)&&e.date<=addDays(monday(week),6));}
export function seedSanity(state){
 const names=new Set((state.classes||[]).map(c=>c.id));
 const badSlots=(state.slots||[]).filter(e=>!names.has(e.classId)||!DAYS.some(d=>d.n===Number(e.day))||!SHIFTS.some(s=>s.id===e.shift&&e.period>=1&&e.period<=s.count));
 return {badSlots,conflicts:conflicts(eventsForWeek(state,monday('2026-11-09')))};
}
