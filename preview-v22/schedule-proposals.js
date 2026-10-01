/* Taipei Pocket — review-only overlap proposals. No storage, network or clock reads.
 * Browser: TripSchedule.propose(trip, dayId, settings); Node: require(...).
 * Call apply(trip, proposal, CURRENT settings) only after explicit approval.
 * All calculations use epoch milliseconds; tz/endTz are display/boundary offsets.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TripSchedule=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MIN=60000,DAY=86400000,VERSION=1;
const clone=x=>JSON.parse(JSON.stringify(x));
const included=x=>!['skipped','cancelled'].includes(x.status);
const protectedItem=x=>Boolean(x.fixed||x.isFlight||(x.reservationStatus&&x.reservationStatus!=='none'));
const uncertain=x=>x.k==='m'&&(x.routeStale===true||x.timeStatus==='unconfirmed'||x.durationMinutes===null||x.end<=x.start);
const history=x=>x.status==='done'||x.status==='running';
const minutes=x=>Math.ceil(Math.max(0,x)/MIN);
function settings(opts={}){
 const out={minRest:opts.minRest??20,reservationBuffer:opts.reservationBuffer??10};
 for(const [k,v] of Object.entries(out))if(!Number.isFinite(v)||v<0||v>1440)throw Error('휴식·예약 보호시간을 확인하세요.');
 return out;
}
function validate(trip,dayId){
 if(!trip||!Array.isArray(trip.items)||!Array.isArray(trip.days))throw Error('여행 일정이 없습니다.');
 const days=new Set(),ids=new Set();
 for(const d of trip.days){if(!d||!d.id||days.has(d.id)||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date+'T00:00:00Z')))throw Error('여행 날짜를 확인하세요.');days.add(d.id);}
 if(dayId!=null&&!days.has(dayId))throw Error('조정할 날짜가 없습니다.');
 for(const x of trip.items){
  if(!x||!x.id||ids.has(x.id)||!days.has(x.dayId)||!Number.isFinite(x.start)||!Number.isFinite(x.end)||x.end<x.start||!['s','m'].includes(x.k)||!['pending','running','done','skipped','cancelled'].includes(x.status))throw Error('일정 ID·시간·상태를 확인하세요.');
  if(!Number.isFinite(x.tz)||!Number.isFinite(x.endTz)||Math.abs(x.tz)>14||Math.abs(x.endTz)>14)throw Error('일정의 시간대를 확인하세요.');
  ids.add(x.id);
 }
}
// A full snapshot also invalidates proposals after place/route/status/deadline edits.
// This is a concurrency guard, not a cryptographic signature or authorization.
function fingerprint(trip,opts={}){return JSON.stringify([VERSION,settings(opts),trip]);}
function interval(x){
 // Recorded history is immutable. Never infer a delay from the wall clock or
 // from a missing completion checkmark.
 const start=history(x)&&Number.isFinite(x.actualStart)?x.actualStart:x.start;
 const end=x.status==='done'&&Number.isFinite(x.actualEnd)?x.actualEnd:Math.max(x.end,start);
 return {start,end:Math.max(start,end)};
}
function order(trip){return trip.items.filter(x=>included(x)&&!(x.k==='s'&&x.start===x.end&&!protectedItem(x)&&!history(x))).map(x=>({x,...interval(x)})).sort((a,b)=>a.start-b.start||(protectedItem(b.x)||history(b.x)?1:0)-(protectedItem(a.x)||history(a.x)?1:0)||a.end-b.end||String(a.x.id).localeCompare(String(b.x.id)));}
function relevant(a,b,dayId){return dayId==null||a.dayId===dayId||b?.dayId===dayId;}
function message(code,a,b,n){
 const titles='“'+a.title+'”'+(b?' · “'+b.title+'”':'');
 if(code==='fixed-overlap')return titles+'의 고정 시간이 '+n+'분 겹칩니다. 예약처에서 실제 가능한 시간을 확인한 뒤 직접 수정하세요.';
 if(code==='history-overlap')return titles+'의 진행·완료 기록과 예정 시간이 '+n+'분 겹칩니다. 진행 기록은 자동으로 바꾸지 않습니다.';
 return titles+'의 시간이 '+n+'분 겹칩니다.';
}
function detect(trip,dayId=null,opts={}){
 validate(trip,dayId);settings(opts);const a=order(trip),out=[];
 for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length&&a[j].start<a[i].end;j++){
  const p=a[i],q=a[j];if(!relevant(p.x,q.x,dayId)||p.x.status==='done'&&q.x.status==='done'||uncertain(p.x)||uncertain(q.x))continue;
  const overlap=Math.min(p.end,q.end)-Math.max(p.start,q.start);if(overlap<=0)continue;
  const code=protectedItem(p.x)&&protectedItem(q.x)?'fixed-overlap':history(p.x)||history(q.x)?'history-overlap':'overlap';
  out.push({code,a:p.x.id,b:q.x.id,ids:[p.x.id,q.x.id],dayIds:[p.x.dayId,q.x.dayId],minutes:minutes(overlap),reason:message(code,p.x,q.x,minutes(overlap))});
 }
 return out;
}
function dayBounds(trip,x){
 const date=trip.days.find(d=>d.id===x.dayId).date;
 const start=Date.parse(date+'T00:00:00Z')-x.tz*60*MIN;
 const end=Date.parse(date+'T00:00:00Z')+DAY-x.endTz*60*MIN;
 // Existing overnight legs keep their intentional range. New rollover needs a
 // date/time decision; assigning to a day never truncates an existing flight.
 return {start:Math.min(start,x.start),end:Math.max(end,x.end)};
}
function gap(a,b,s){return b&&protectedItem(b)&&b.status==='pending'&&!protectedItem(a)?s.reservationBuffer*MIN:0;}
function bounds(trip,x){const b=dayBounds(trip,x);return {start:Math.max(b.start,Number.isFinite(x.earliestStart)?x.earliestStart:-Infinity),end:Math.min(b.end,Number.isFinite(x.latestEnd)?x.latestEnd:Infinity),latestStart:Number.isFinite(x.latestStart)?x.latestStart:Infinity};}
function restCapacity(x,duration,s){return x.k==='s'&&x.buffer?Math.max(0,duration-Math.max(s.minRest,Number.isFinite(x.minDuration)?x.minDuration:0)*MIN):0;}
function itemTimes(x){return {start:x.start,end:x.end,tz:x.tz,endTz:x.endTz,dayId:x.dayId};}
function issue(code,ids,reason,extra={}){return {code,ids,reason,...extra};}
function propose(trip,dayId=null,opts={}){
 validate(trip,dayId);const s=settings(opts),t=clone(trip),byId=new Map(t.items.map(x=>[x.id,x])),a=order(trip),original=detect(trip,dayId,s);
 const warnings=[],decisions=[],reasons=new Map(),added=new Set();
 const add=(list,v)=>{const key=v.code+'|'+v.ids.join('|');if(!added.has(key)){added.add(key);list.push(v);}};
 const mutable=x=>(dayId==null||x.dayId===dayId)&&x.status==='pending'&&!protectedItem(x)&&!uncertain(x);
 const why=(id,text)=>{if(!reasons.has(id))reasons.set(id,new Set());reasons.get(id).add(text);};
 let previous=null,frontier=-Infinity,block=[];
 function solve(next){
  if(!block.length)return;
  const nodes=block.map(n=>({x:byId.get(n.x.id),old:n.x,duration:n.x.end-n.x.start,bounds:bounds(trip,n.x)}));
  const lower=frontier+(previous?gap(previous.x,nodes[0].x,s):0);
  const upper=next?next.start-gap(nodes[nodes.length-1].x,next.x,s):Infinity;
  // Do not repair unrelated pre-existing short arrival buffers merely because
  // another part of the day has a clash. A segment changes only for an actual
  // overlap (including its immutable boundary) or an explicit deadline.
  let oldEdge=frontier,needsWork=false;
  for(const n of nodes){if(n.old.start<oldEdge||n.old.start<n.bounds.start||n.old.end>n.bounds.end||n.old.start>n.bounds.latestStart)needsWork=true;oldEdge=Math.max(oldEdge,n.old.end);}
  if(next&&oldEdge>next.start)needsWork=true;
  if(!needsWork){block=[];return;}
  const forward=()=>{let cursor=lower;for(const n of nodes){n.start=Math.max(n.old.start,cursor,n.bounds.start);n.end=n.start+n.duration;cursor=n.end;}return cursor;};
  // Consume explicitly designated rest only when a shift needs it; ordinary
  // visits and movement durations are never shortened.
  let cursor=lower;
  for(const n of nodes){const start=Math.max(n.old.start,cursor,n.bounds.start),shift=Math.max(0,start-n.old.start),cut=Math.min(shift,restCapacity(n.x,n.duration,s));n.duration-=cut;n.start=start;n.end=start+n.duration;cursor=n.end;}
  if(cursor>upper){
   let need=cursor-upper;
   for(let i=nodes.length-1;i>=0&&need>0;i--){const n=nodes[i],cut=Math.min(need,restCapacity(n.x,n.duration,s));n.duration-=cut;need-=cut;}
   forward();
   // Pack backwards only as far as needed, using existing empty time ahead of
   // the segment. This preserves route/visit order and fixed reservation slots.
   let edge=upper;
   for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];n.end=Math.min(n.end,edge,n.bounds.end,n.bounds.latestStart+n.duration);n.start=n.end-n.duration;edge=n.start;}
  }
  // Reject the complete affected segment when it cannot fit. A blocked preview
  // must not itself recommend arriving before a flight or crossing a deadline.
  let edge=lower,infeasible=false;
  for(const n of nodes){
   const x=n.x,shortfall=Math.max(edge,n.bounds.start)-n.start;
   if(shortfall>0){infeasible=true;add(decisions,issue('insufficient-space',[x.id,...(next?[next.x.id]:[])],'“'+x.title+'”부터 이어지는 일정을 고정 시간·날짜 범위 안에 유지하려면 '+minutes(shortfall)+'분이 부족합니다. 입력된 이동·방문 소요시간이나 '+(next?'“'+next.x.title+'”의 실제 고정 시간':'날짜 범위')+'을 확인한 뒤 가능한 시간을 결정하세요.',{minutes:minutes(shortfall)}));}
   if(n.end>n.bounds.end||n.start>n.bounds.latestStart){infeasible=true;const cutoff=Number.isFinite(x.latestEnd)&&n.end>x.latestEnd||Number.isFinite(x.latestStart)&&n.start>x.latestStart;add(decisions,issue(cutoff?'deadline':'day-rollover',[x.id],cutoff?'“'+x.title+'”의 입력된 마감 시간을 넘습니다. 가능한 시간을 확인하거나 이 방문의 날짜를 바꾸세요.':'“'+x.title+'”을 조정하면 기존 날짜 범위 또는 자정 이후 계획을 넘습니다. 다음 날짜의 휴식·일정을 확인한 뒤 날짜와 시간을 직접 결정하세요.'));}
   edge=n.end;
  }
  if(infeasible){block=[];return;}
  for(const n of nodes){
   const x=n.x,changed=n.start!==n.old.start||n.end!==n.old.end;
   if(changed){
    if(n.start>n.old.start)why(x.id,'앞 일정과 겹친 '+minutes(n.start-n.old.start)+'분을 뒤로 이동');
    if(n.start<n.old.start)why(x.id,'고정 시간과 도착 여유를 지키도록 '+minutes(n.old.start-n.start)+'분 앞당김');
    if(n.duration<n.old.end-n.old.start)why(x.id,'줄일 수 있는 휴식만 '+minutes(n.old.end-n.old.start-n.duration)+'분 단축 (최소 '+Math.max(s.minRest,x.minDuration||0)+'분 유지)');
    if(x.k==='m')why(x.id,'입력된 이동시간 '+minutes(n.duration)+'분 유지');
    x.start=n.start;x.end=n.end;
   }
  }
  block=[];
 }
 for(const node of a){if(mutable(node.x)){block.push(node);continue;}solve(node);frontier=Math.max(frontier,node.end);previous=node;}
 solve(null);
 const changes=t.items.filter(x=>{const old=trip.items.find(y=>y.id===x.id);return x.start!==old.start||x.end!==old.end;}).map(x=>{
  const old=trip.items.find(y=>y.id===x.id),whyList=[...(reasons.get(x.id)||[])];
  return {id:x.id,title:x.title,dayId:x.dayId,before:itemTimes(old),after:itemTimes(x),oldStart:old.start,oldEnd:old.end,start:x.start,end:x.end,tz:x.tz,endTz:x.endTz,shiftMinutes:(x.start-old.start)/MIN,durationBefore:(old.end-old.start)/MIN,durationAfter:(x.end-x.start)/MIN,reasons:whyList,reason:whyList.join(' · ')};
 }).sort((x,y)=>x.before.start-y.before.start||String(x.id).localeCompare(String(y.id)));
 const changedIds=new Set(changes.map(x=>x.id));
 for(let i=0;i<a.length;i++){const x=a[i].x;if(!relevant(x,null,dayId)||!uncertain(x)||x.status==='done')continue;
  const v=issue('unknown-travel',[x.id],'“'+x.title+'”의 이동시간이 미확정입니다. 실제 경로의 소요시간을 확인해 입력한 뒤 조정안을 다시 만드세요.');
  // A known immutable appointment separates independent portions of a day.
  // Do not let an unrelated evening route block a safe morning recommendation.
  const boundary=n=>n.x.dayId!==x.dayId||!uncertain(n.x)&&(protectedItem(n.x)||history(n.x));
  let left=i-1,right=i+1;
  while(left>=0&&!boundary(a[left]))left--;
  while(right<a.length&&!boundary(a[right]))right++;
  const dependencyIds=new Set(a.slice(left+1,right).map(n=>n.x.id));
  const affected=changes.some(c=>dependencyIds.has(c.id))||original.some(c=>c.ids.some(id=>dependencyIds.has(id)));
  add(affected?decisions:warnings,v);
 }
 const scoped=a.filter(n=>relevant(n.x,null,dayId));
 for(let i=1;i<scoped.length;i++){
  const p=scoped[i-1].x,q=scoped[i].x;if(p.dayId!==q.dayId||!changedIds.has(p.id)&&!changedIds.has(q.id))continue;
  const from=p.k==='s'?p.place:p.to,to=q.k==='s'?q.place:q.from;
  if(from&&to&&from!==to)add(decisions,issue('missing-travel',[p.id,q.id],'“'+p.title+'”에서 “'+q.title+'”까지의 연결 이동시간이 없습니다. 이동 경로와 시간을 먼저 입력하세요.'));
 }
 const remaining=detect(t,dayId,s);
 for(const c of remaining)add(decisions,issue(c.code,c.ids,c.reason,{minutes:c.minutes}));
 // Guard only changed paths. Existing tight fixed-to-fixed itinerary blocks are
 // shown as true overlaps, not invented ten-minute conflicts.
 const finalOrder=order(t);
 for(let i=1;i<finalOrder.length;i++){const p=finalOrder[i-1],q=finalOrder[i];if(!changedIds.has(p.x.id)&&!changedIds.has(q.x.id))continue;const guard=gap(p.x,q.x,s);if(guard&&p.end>q.start-guard)add(decisions,issue('reservation-buffer',[p.x.id,q.x.id],'“'+q.x.title+'” 도착 전 '+s.reservationBuffer+'분 여유가 확보되지 않습니다. 앞 일정의 시간이나 방문 여부를 결정하세요.',{minutes:minutes(p.end-(q.start-guard))}));}
 if(changes.some(c=>c.shiftMinutes<0))add(warnings,issue('earlier-start',changes.filter(c=>c.shiftMinutes<0).map(c=>c.id),'앞당긴 방문의 영업시간·입장 가능 여부를 확인한 뒤 승인하세요. 저장된 일정 시간만 계산했으며 영업시간이나 실시간 교통을 조회하지 않았습니다.'));
 if(changes.length)add(warnings,issue('stored-times',[],'입력된 이동시간을 그대로 사용했습니다. 실제 교통·운행·예약 상황은 별도 확인이 필요합니다.'));
 const blocked=decisions.length>0,status=blocked?'blocked':changes.length?'ready':'clean';
 const proposal={version:VERSION,dayId,settings:s,status,canApply:status==='ready',requiresApproval:status==='ready',baseFingerprint:fingerprint(trip,s),changes,conflicts:original,remainingConflicts:remaining,warnings,decisions,trip:t};
 proposal.signature=JSON.stringify([VERSION,dayId,s,changes.map(c=>[c.id,c.start,c.end]),decisions.map(d=>[d.code,d.ids])]);
 return proposal;
}
function apply(trip,proposal,opts){
 if(!proposal||proposal.version!==VERSION)throw Error('조정안을 다시 만들어 주세요.');
 const current=settings(opts===undefined?proposal.settings:opts);
 if(fingerprint(trip,current)!==proposal.baseFingerprint)throw Error('일정이나 보호 설정이 바뀌어 조정안이 오래되었습니다. 다시 계산하세요.');
 const checked=propose(trip,proposal.dayId,current);
 if(!checked.canApply)throw Error(checked.status==='blocked'?'확인이 필요한 충돌이 있어 조정안을 적용할 수 없습니다.':'적용할 시간 변경이 없습니다.');
 const reviewed=JSON.stringify([proposal.version,proposal.dayId,proposal.settings,(proposal.changes||[]).map(c=>[c.id,c.start,c.end]),(proposal.decisions||[]).map(d=>[d.code,d.ids])]);
 if(checked.signature!==proposal.signature||reviewed!==proposal.signature)throw Error('조정안이 바뀌었습니다. 다시 검토하세요.');
 // Recomputed output prevents callers from smuggling non-time edits through a
 // modified preview.trip or changes array. Inputs remain untouched.
 return clone(checked.trip);
}
return Object.freeze({VERSION,MIN,DAY,propose,detect,fingerprint,apply});
});
