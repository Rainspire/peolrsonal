/* Taipei Pocket v2.1 — pure, dependency-free scheduling and data functions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TripCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MIN=60000, DAY=86400000;
const clone=x=>JSON.parse(JSON.stringify(x));
const included=x=>!['skipped','cancelled'].includes(x.status);
const active=x=>included(x)&&x.status!=='done';
const protectedItem=x=>Boolean(x.fixed||x.isFlight||(x.reservationStatus&&x.reservationStatus!=='none'));
const stop=x=>x.k==='s'&&!!x.place&&included(x);
const knownCost=x=>included(x)&&!(x.k==='m'&&(x.routeStale||x.fareStatus==='unconfirmed'));
const id=()=>globalThis.crypto?.randomUUID?.()||('x'+Date.now().toString(36)+Math.random().toString(36).slice(2));
function localInput(ts,tz=8){return new Date(ts+tz*3600000).toISOString().slice(0,16);}
function parseLocal(text,tz=8){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text))throw Error('날짜와 시간을 입력하세요.');const t=Date.parse(text+':00Z')-tz*3600000;if(!Number.isFinite(t))throw Error('날짜 형식이 잘못되었습니다.');return t;}
function duration(x){return Math.max(0,(x.end-x.start)/MIN);}
function dayItems(trip,dayId){return trip.items.filter(x=>x.dayId===dayId);}
function validateTrip(t){
 if(!t||t.schema!==2||!Array.isArray(t.items)||!Array.isArray(t.days)||!t.places||typeof t.places!=='object'||Array.isArray(t.places))throw Error('지원하는 v2 여행 파일이 아닙니다.');
 if(t.items.length>3000||t.days.length===0||t.days.length>100||Object.keys(t.places).length>3000)throw Error('여행 데이터가 너무 큽니다.');
 const days=new Set();for(const d of t.days){if(!d||typeof d.id!=='string'||!d.id||days.has(d.id)||!/^\d{4}-\d{2}-\d{2}$/.test(d.date))throw Error('여행 날짜 또는 ID가 잘못되었습니다.');days.add(d.id);}
 const ids=new Set();for(const x of t.items){
  if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id)||!days.has(x.dayId))throw Error('일정 ID가 중복되거나 날짜가 없습니다.');ids.add(x.id);
  if(typeof x.title!=='string'||x.title.length>1000||!['s','m'].includes(x.k)||!Number.isFinite(x.start)||!Number.isFinite(x.end)||x.end<x.start||x.end-x.start>7*DAY)throw Error('일정의 제목·시간을 확인하세요.');
  if(!Number.isFinite(x.cost)||x.cost<0||x.cost>1e9||![8,9].includes(x.tz)||![8,9].includes(x.endTz))throw Error('일정 금액 또는 시간대가 잘못되었습니다.');
  if(!['pending','running','done','skipped','cancelled'].includes(x.status))throw Error('일정 상태가 잘못되었습니다.');
  for(const k of ['place','from','to'])if(x[k]&&!t.places[x[k]])throw Error('일정에서 참조하는 장소가 없습니다.');
 }
 for(const p of Object.values(t.places)){if(!p||typeof p.n!=='string')throw Error('장소 이름이 없습니다.');if(p.ll&&(!Array.isArray(p.ll)||p.ll.length!==2||!p.ll.every(Number.isFinite)||Math.abs(p.ll[0])>90||Math.abs(p.ll[1])>180))throw Error('장소 좌표가 잘못되었습니다.');}
 if(t.prep&&(!Array.isArray(t.prep)||!t.prep.every(x=>x&&typeof x.id==='string'&&typeof x.t==='string'&&(!x.l||Array.isArray(x.l)&&x.l.length>=2&&x.l.every(v=>typeof v==='string'))))||t.saved&&(!Array.isArray(t.saved)||!t.saved.every(x=>Array.isArray(x)&&x.length>=4&&x.every(v=>typeof v==='string'))))throw Error('준비·장소 목록 형식을 확인하세요.');
 if(t.terms&&(typeof t.terms!=='object'||!Object.values(t.terms).every(x=>x&&typeof x.t==='string'&&typeof x.b==='string')))throw Error('가이드 용어 형식이 잘못되었습니다.');
 for(const x of t.items){if(x.kv&&(!Array.isArray(x.kv)||!x.kv.every(a=>Array.isArray(a)&&a.length>=2)))throw Error('일정 안내 형식이 잘못되었습니다.');if(x.steps&&!Array.isArray(x.steps))throw Error('이동 안내 형식이 잘못되었습니다.');}
 for(const d of t.days){if(d.notices&&(!Array.isArray(d.notices)||!d.notices.every(a=>Array.isArray(a)&&a.length>=2)))throw Error('날짜별 안내가 잘못되었습니다.');} 
 return true;
}
function placeQuery(p){return p?(p.zh||p.n)+' '+(p.addr||''):'';}
function mapsURL(places,from,to,mode='transit',waypoints=[]){
 const dest=typeof to==='string'?places[to]:to;if(!dest)throw Error('도착지를 먼저 선택하세요.');
 const origin=typeof from==='string'?places[from]:from;const q=new URLSearchParams({api:'1',destination:placeQuery(dest),travelmode:['walking','driving','transit','bicycling'].includes(mode)?mode:'transit'});
 if(origin)q.set('origin',placeQuery(origin));
 if(waypoints.length){if(mode==='transit')throw Error('대중교통은 구간별 길찾기를 사용하세요.');if(waypoints.length>3)throw Error('모바일 경유지는 최대 3곳으로 선택하세요.');q.set('waypoints',waypoints.map(p=>placeQuery(typeof p==='string'?places[p]:p)).join('|'));}
 const url='https://www.google.com/maps/dir/?'+q.toString();if(url.length>2048)throw Error('주소가 너무 깁니다. 경유지를 줄여주세요.');return url;
}
function routeFor(trip,x){
 if(x.k==='m')return {from:x.from||null,to:x.to||null,mode:x.travel||'transit'};
 const a=dayItems(trip,x.dayId).filter(included),n=a.findIndex(i=>i.id===x.id);const previous=a.slice(0,n).reverse().find(i=>i.k==='s'&&i.place);
 return {from:previous?.place||null,to:x.place||null,mode:x.travel||'transit'};
}
/* Preserve original multi-leg directions by their stop anchors. Only affected
   adjacency is replaced; flights, completed movements and unbound boundary legs
   remain separate barriers. Calling this before an edit captures the old day. */
function bindRouteAnchors(trip,dayId=null){
 const days=dayId?[{id:dayId}]:trip.days;
 for(const d of days){const a=dayItems(trip,d.id);
  for(let i=0;i<a.length;i++){const m=a[i];
   if(m.k!=='m'||m.routeManaged!==undefined||protectedItem(m))continue;
   let l=i-1,r=i+1;
   while(l>=0&&(a[l].k==='m'&&!protectedItem(a[l])||!included(a[l])))l--;
   while(r<a.length&&(a[r].k==='m'&&!protectedItem(a[r])||!included(a[r])))r++;
   const from=a[l],to=a[r];
   if(stop(from||{})&&stop(to||{}))Object.assign(m,{routeManaged:true,fromStopId:from.id,toStopId:to.id,fromStopPlace:from.place,toStopPlace:to.place});
  }
 }
 return trip;
}
function unconfirmedRoute(trip,from,to){
 return {id:'route-'+id(),dayId:to.dayId,k:'m',title:trip.places[from.place].n+' → '+trip.places[to.place].n,
  from:from.place,to:to.place,fromStopId:from.id,toStopId:to.id,fromStopPlace:from.place,toStopPlace:to.place,
  routeManaged:true,routeStale:true,timeStatus:'unconfirmed',fareStatus:'unconfirmed',durationMinutes:null,
  // Zero-width layout anchor is NOT a travel-time estimate. UI hides these times.
  start:from.end,end:from.end,tz:from.endTz,endTz:from.endTz,cost:0,pay:'미확정',travel:'transit',
  fixed:false,buffer:false,status:'pending',actualStart:null,actualEnd:null,body:'',sub:'새 연결 경로 · 확인 필요',
  seg:[],steps:['Google Maps에서 소요시간·요금·이동수단을 확인해 입력하기 전까지 자동 지연 적용을 보류합니다.'],notes:''};
}
function rebuildDayRoutes(trip,dayId){
 const a=dayItems(trip,dayId);if(!a.length)return trip;
 const managed=m=>m.k==='m'&&m.routeManaged&&!protectedItem(m)&&!['done','running'].includes(m.status);
 const pool=a.filter(managed),skeleton=a.filter(x=>!managed(x)),out=[];let previous=null;
 for(const x of skeleton){
  if(stop(x)){
   if(previous&&previous.place!==x.place){
    const exact=pool.filter(m=>included(m)&&m.fromStopId===previous.id&&m.toStopId===x.id&&m.fromStopPlace===previous.place&&m.toStopPlace===x.place);
    out.push(...(exact.length?exact:[unconfirmedRoute(trip,previous,x)]));
   }
   out.push(x);previous=x;
  }else{out.push(x);if(included(x))previous=null;} // inactive cards do not break a route
 }
 const first=trip.items.findIndex(x=>x.dayId===dayId);
 trip.items=trip.items.filter(x=>x.dayId!==dayId);trip.items.splice(first,0,...out);
 return trip;
}
function repairRoutes(trip,dayId,changedId){
 // Compatibility with v2 callers that mark skipped BEFORE invoking repair.
 // Capture anchors with every visit temporarily included, then restore status.
 const a=dayItems(trip,dayId),statuses=a.map(x=>x.status);
 a.forEach(x=>{if(x.k==='s'&&!included(x))x.status='pending';});
 bindRouteAnchors(trip,dayId);a.forEach((x,i)=>x.status=statuses[i]);
 return rebuildDayRoutes(trip,dayId);
}
function updateVisit(trip,itemId,patch){
 const t=clone(trip);bindRouteAnchors(t);const x=t.items.find(i=>i.id===itemId);
 if(!x)throw Error('일정이 없습니다.');const oldDay=x.dayId;
 if(x.k!=='s'&&patch.dayId&&patch.dayId!==oldDay)throw Error('이동카드는 날짜를 옮길 수 없습니다. 방문 일정을 이동하세요.');
 if(patch.dayId&&patch.dayId!==oldDay&&x.status!=='pending')throw Error('진행 전 일정만 날짜를 이동할 수 있습니다.');
 Object.assign(x,patch);
 if(!t.days.some(d=>d.id===x.dayId))throw Error('날짜를 확인하세요.');
 t.items.sort((a,b)=>t.days.findIndex(d=>d.id===a.dayId)-t.days.findIndex(d=>d.id===b.dayId)||a.start-b.start);
 rebuildDayRoutes(t,oldDay);if(x.dayId!==oldDay)rebuildDayRoutes(t,x.dayId);
 validateTrip(t);return t;
}
function duplicateVisit(trip,itemId){
 const t=clone(trip);bindRouteAnchors(t);const x=t.items.find(i=>i.id===itemId);
 if(!x||x.k!=='s')throw Error('방문 일정만 복제할 수 있습니다.');
 if(x.isFlight)throw Error('항공 일정은 복제하지 않습니다.');
 const copy={...clone(x),id:'copy-'+id(),title:x.title+' (복제)',status:'pending',actualStart:null,actualEnd:null,fixed:false,
  reservationStatus:x.reservationStatus||x.fixed?'unconfirmed':'none',clonedFrom:x.id,
  body:'복제한 일정입니다. 원본의 예약·결제 확정은 승계하지 않습니다.',sub:'복제 · 예약/시간 재확인',kv:[],tags:[],tip:'',alt:'',pay:x.pay==='예약 완료'||x.pay==='결제완료'?'미확정':x.pay};
 copy.start=x.end;copy.end=copy.start+(x.end-x.start);delete copy.isFlight;
 t.items.splice(t.items.findIndex(i=>i.id===itemId)+1,0,copy);rebuildDayRoutes(t,x.dayId);validateTrip(t);
 return {trip:t,id:copy.id};
}
function conflicts(trip,dayId){const a=dayItems(trip,dayId).filter(x=>included(x)&&!x.routeStale).slice().sort((a,b)=>a.start-b.start);const out=[];for(let n=0;n<a.length;n++)for(let k=n+1;k<a.length&&a[k].start<a[n].end;k++)out.push({a:a[n].id,b:a[k].id,minutes:Math.ceil((Math.min(a[n].end,a[k].end)-a[k].start)/MIN)});return out;}
/* Propagate delay from a confirmed/running anchor. Fixed reservations, flights and
   travel durations never shrink; only explicitly marked rest buffers may shorten. */
function delayFingerprint(t){return JSON.stringify(t.items.map(x=>[x.id,x.dayId,x.start,x.end,x.status,x.routeStale,x.fixed,x.isFlight,x.reservationStatus,x.buffer,x.minDuration]));}
function proposeDelay(trip,anchorId,newEnd,opts={}){
 const t=clone(trip),anchor=t.items.find(x=>x.id===anchorId);if(!anchor)throw Error('기준 일정이 없습니다.');
 if(!Number.isFinite(newEnd)||newEnd-anchor.start>7*DAY)throw Error('지연 종료시간을 확인하세요.');
 const baseFingerprint=delayFingerprint(trip),delay=Math.ceil((newEnd-anchor.end)/MIN),changes=[];
 const result=conflict=>({trip:t,changes,conflict,delay:Math.max(0,delay),baseFingerprint});
 if(delay<=0)return result(null);
 if(protectedItem(anchor))return result({id:anchor.id,reason:'항공·예약·고정 일정은 자동 변경하지 않습니다.'});
 if(anchor.k==='m'&&anchor.routeStale)return result({id:anchor.id,reason:'변경된 경로의 이동시간을 먼저 확인하세요.'});
 const a=dayItems(t,anchor.dayId),idx=a.findIndex(x=>x.id===anchorId);
 const unknown=a.slice(idx+1).find(x=>active(x)&&x.k==='m'&&x.routeStale);
 if(unknown)return result({id:unknown.id,reason:'변경된 경로의 이동시간을 먼저 확인하세요.'});
 changes.push({id:anchor.id,title:anchor.title,oldStart:anchor.start,oldEnd:anchor.end,start:anchor.start,end:newEnd});anchor.end=newEnd;let cursor=newEnd;
 for(const x of a.slice(idx+1)){
  if(!active(x))continue;
  if(protectedItem(x)){const guard=(opts.reservationBuffer??10)*MIN;
   if(cursor>x.start-guard)return result({id:x.id,title:x.title,minutes:Math.ceil((cursor-(x.start-guard))/MIN),reason:'고정 일정 도착 여유시간이 부족합니다.'});
   return result(null);
  }
  const start=Math.max(x.start,cursor),shift=start-x.start;let dur=x.end-x.start;
  if(shift>0&&x.k==='s'&&x.buffer)dur=Math.max((Math.max(opts.minRest??20,x.minDuration??0))*MIN,dur-shift);
  const end=start+dur;if(start!==x.start||end!==x.end){changes.push({id:x.id,title:x.title,oldStart:x.start,oldEnd:x.end,start,end});x.start=start;x.end=end;}
  cursor=end;
 }
 // Midnight does not remove protection for the next day's flight/reservation.
 const dayIndex=t.days.findIndex(d=>d.id===anchor.dayId);
 const nextFixed=t.items.filter(x=>active(x)&&protectedItem(x)&&t.days.findIndex(d=>d.id===x.dayId)>dayIndex).sort((a,b)=>a.start-b.start)[0];
 if(nextFixed&&cursor>nextFixed.start-(opts.reservationBuffer??10)*MIN)return result({id:nextFixed.id,title:nextFixed.title,reason:'다음 날짜의 항공·고정 일정 여유시간이 부족합니다.'});
 return result(null);
}
function applyDelay(trip,proposal){
 if(!proposal||proposal.conflict)throw Error('충돌이 있는 조정안은 적용할 수 없습니다.');
 if(delayFingerprint(trip)!==proposal.baseFingerprint)throw Error('일정이 변경되어 조정안이 오래되었습니다. 다시 계산하세요.');
 return clone(proposal.trip);
}
function reorderTo(trip,dayId,itemId,targetId){
 const t=clone(trip);bindRouteAnchors(t);const arr=dayItems(t,dayId),visits=arr.filter(stop),a=visits.findIndex(x=>x.id===itemId),b=visits.findIndex(x=>x.id===targetId);
 if(a<0||b<0)throw Error('장소가 있는 방문 일정만 순서를 바꿀 수 있습니다.');
 if(a===b)return t;
 const low=Math.min(a,b),high=Math.max(a,b),left=arr.indexOf(visits[low]),right=arr.indexOf(visits[high]);
 if(arr.slice(left,right+1).some(x=>included(x)&&(protectedItem(x)||x.status!=='pending')))throw Error('고정·예약·진행·완료 일정을 가로질러 순서를 바꿀 수 없습니다.');
 const slots=visits.map(x=>x.start),durations=new Map(visits.map(x=>[x.id,x.end-x.start]));
 const ordered=visits.slice();ordered.splice(b,0,ordered.splice(a,1)[0]);
 let cursor=slots[low];
 for(let i=low;i<=high;i++){const x=ordered[i],dur=durations.get(x.id);const start=Math.max(slots[i],cursor);x.start=start;x.end=start+dur;cursor=x.end;}
 const nextFixed=arr.slice(right+1).find(x=>included(x)&&protectedItem(x));
 if(nextFixed&&cursor>nextFixed.start)throw Error('순서 변경 시 고정 일정과 겹칩니다. 시간 편집으로 먼저 여유를 확보하세요.');
 let n=0;const replaced=arr.map(x=>stop(x)?ordered[n++]:x);n=0;t.items=t.items.map(x=>x.dayId===dayId?replaced[n++]:x);
 rebuildDayRoutes(t,dayId);validateTrip(t);return t;
}
function reorder(trip,dayId,itemId,delta){
 const visits=dayItems(trip,dayId).filter(stop),i=visits.findIndex(x=>x.id===itemId),target=visits[i+delta];
 if(i<0||!target||![-1,1].includes(delta))throw Error('이 방향으로 방문 순서를 이동할 수 없습니다.');
 return reorderTo(trip,dayId,itemId,target.id);
}
function expenseKRW(x){
 if(Number.isFinite(x.confirmedKrw))return x.confirmedKrw;
 if(Number.isFinite(x.krwAtEntry))return x.krwAtEntry;
 if(x.currency==='KRW'&&Number.isFinite(x.raw))return x.raw;
 if(Number.isFinite(x.rateSnapshot)&&x.rateSnapshot>0)return Math.round(x.twd*x.rateSnapshot);
 return null; // Never backfill history from today's exchange rate.
}
function normalizeExpense(x){
 const y=clone(x),known=expenseKRW(y);
 if(known!==null)y.krwAtEntry=Number.isFinite(y.krwAtEntry)?y.krwAtEntry:known;
 y.krwStatus=known===null?'unconfirmed':Number.isFinite(y.confirmedKrw)||y.currency==='KRW'?'confirmed':'entry-rate';
 return y;
}
function budget(trip,settings={},expenses=[]){
 const planned=(trip?.items||[]).filter(knownCost).reduce((s,x)=>s+(x.cost||0),0)+(settings.whisky??6000)+(settings.gifts??2500);
 const actual=expenses.reduce((s,x)=>s+x.twd,0),cashSpent=expenses.filter(x=>x.method==='cash').reduce((s,x)=>s+x.twd,0);
 const cashBase=(trip?.items||[]).filter(x=>knownCost(x)&&x.pay==='현금').reduce((s,x)=>s+x.cost,0);
 const actualKrw=expenses.reduce((s,x)=>s+(expenseKRW(x)??0),0),unconfirmedKrw=expenses.filter(x=>expenseKRW(x)===null).length;
 return {planned,actual,actualKrw,unconfirmedKrw,remaining:planned-actual,cashSpent,cashRemaining:(settings.cashOpening??0)+(settings.cashAdded??0)-cashSpent,cashRecommended:Math.ceil((cashBase+(settings.whisky??6000)+(settings.gifts??2500)*.4)*1.1/1000)*1000};
}
return {MIN,DAY,clone,id,included,knownCost,active,protectedItem,stop,bindRouteAnchors,rebuildDayRoutes,updateVisit,duplicateVisit,reorderTo,delayFingerprint,applyDelay,expenseKRW,normalizeExpense,localInput,parseLocal,duration,dayItems,validateTrip,mapsURL,placeQuery,routeFor,repairRoutes,conflicts,proposeDelay,reorder,budget};
});
