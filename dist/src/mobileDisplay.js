import {parseGroups} from './core.js';

const groupKey = e => parseGroups(e?.groups).map(x=>String(x).trim().toLocaleLowerCase('vi')).filter(Boolean).sort().join('|');

/** Only adjacent morning/afternoon periods of the SAME tutoring lesson form one card.
 * The two evening periods are ALWAYS independent classes/slots.
 */
export function canMergeTutorPair(a,b){
 if(!a||!b||a.kind!=='EXTRA'||b.kind!=='EXTRA'||!['S','C'].includes(a.shift))return false;
 if(a.date!==b.date||a.shift!==b.shift||Number(a.period)+1!==Number(b.period)||Number(a.period)>=5)return false;
 const group=groupKey(a);
 if(!group||group!==groupKey(b)||a.subject!==b.subject)return false;
 if(a.patternId&&b.patternId&&a.patternId!==b.patternId)return false;
 return String(a.lessonNumber??1)===String(b.lessonNumber??1)
  &&String(a.lessonTitle||'').trim()===String(b.lessonTitle||'').trim()
  &&String(a.notes||'').trim()===String(b.notes||'').trim()
  &&String(a.status||'PLANNED')===String(b.status||'PLANNED')
  &&String(a.startTime||'')===String(b.startTime||'')
  &&String(a.endTime||'')===String(b.endTime||'');
}

/** Display only; preserves every original event and every independent evening slot. */
export function collapseTutorDisplay(events){
 const source=[...events].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.shift).localeCompare(String(b.shift))||Number(a.period)-Number(b.period));
 const occupancy=new Map();
 for(const e of source){const key=`${e.date}|${e.shift}|${e.period}`;occupancy.set(key,(occupancy.get(key)||0)+1);}
 const result=[];
 for(const e of source){
  const previous=result.find(x=>canMergeTutorPair(x,e)&&!(x.displayMergedIds?.length));
  if(previous&&occupancy.get(`${e.date}|${e.shift}|${Number(e.period)-1}`)===1&&occupancy.get(`${e.date}|${e.shift}|${e.period}`)===1){
   previous.periodEnd=Number(e.period);
   previous.displayMergedIds=[previous.id,e.id];
  } else result.push(e.kind==='EXTRA'?{...e,periodEnd:Number(e.period)}:e);
 }
 return result;
}

export const MOBILE_PERIODS=[...Array.from({length:5},(_,i)=>({shift:'S',period:i+1,label:`S${i+1}`})),...Array.from({length:5},(_,i)=>({shift:'C',period:i+1,label:`C${i+1}`})),...Array.from({length:2},(_,i)=>({shift:'T',period:i+1,label:`T${i+1}`}))];

/** Build a real 8x13 CSS-grid layout from RAW events. Never merge stored records.
 * A 2-period card spans two grid rows only when both periods each have exactly one
 * matching tutoring event; simultaneous official/extra lessons remain accessible.
 */
export function planMobileWeekCells(events,weekDates){
 const source=[...events];
 const byKey=new Map();
 for(const e of source){const key=`${e.date}|${e.shift}|${Number(e.period)}`;if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(e);}
 const cells=[];
 weekDates.forEach((date,day)=>{
  const skipped=new Set();
  MOBILE_PERIODS.forEach((slot,i)=>{
   const key=`${date}|${slot.shift}|${slot.period}`;
   if(skipped.has(key))return;
   const current=byKey.get(key)||[];
   const nextKey=`${date}|${slot.shift}|${slot.period+1}`;
   const next=byKey.get(nextKey)||[];
   const canSpan=current.length===1&&next.length===1&&canMergeTutorPair(current[0],next[0]);
   if(canSpan)skipped.add(nextKey);
   cells.push({date,day:day+2,shift:slot.shift,period:slot.period,row:i+2,col:day+2,span:canSpan?2:1,events:current});
  });
 });
 return cells;
}
