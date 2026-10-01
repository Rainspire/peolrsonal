/* Taipei Pocket — local, provenance-bound transport comparisons.
 * No requests, storage, geolocation, route optimization or fare estimation.
 * Browser: TripRouteOptions; CommonJS: require('./route-options.js').
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TripRouteOptions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MIN=60000,MODES=['transit','driving','walking','bicycling'];
const LABELS={transit:'대중교통',driving:'택시·우버',walking:'도보',bicycling:'자전거',flight:'항공'};
const UNKNOWN='현재 시간·요금 확인';
const SOURCE_LABELS={planned:'현재 일정의 계획값','user-confirmed':'사용자가 확인한 값','supplied-plan':'공유받은 지도 조회 기록 · 승인한 계획','planned-alternative':'원본 일정의 대안 참고값',unconfirmed:'현재 시간·요금 확인','booked-flight':'예약된 항공 일정','flight-plan':'항공 일정'};
const clone=x=>JSON.parse(JSON.stringify(x));
const included=x=>!!x&&!['skipped','cancelled'].includes(x.status);
const plain=x=>String(x??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const positive=x=>Number.isFinite(x)&&x>0;
const nonnegative=x=>Number.isFinite(x)&&x>=0;
function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch(e){return null;}}
function isFlight(x){return !!x&&(x.isFlight===true||x.travel==='flight'||(Array.isArray(x.seg)?x.seg:[]).some(s=>Array.isArray(s)&&s[0]==='air'));}
function modeOf(x){if(!x)return null;if(isFlight(x))return 'flight';if(MODES.includes(x.travel))return x.travel;const kinds=(Array.isArray(x.seg)?x.seg:[]).filter(Array.isArray).map(s=>s[0]);if(kinds.length&&kinds.every(k=>k==='walk'))return 'walking';if(kinds.some(k=>['bike','bicycle','bicycling','cycling'].includes(k))&&kinds.every(k=>['walk','bike','bicycle','bicycling','cycling'].includes(k)))return 'bicycling';if(kinds.some(k=>k==='taxi'||k==='car'))return 'driving';if(kinds.length)return 'transit';return null;}
// Compact itinerary facts must not depend on a free-text subtitle, fare, or an
// opened route comparison. This read-only view never fills missing trip data.
function movementSummary(trip,item){
 const x=item||{},aliases={walking:['walking','도보'],walk:['walking','도보'],foot:['walking','도보'],driving:['driving','택시·우버'],car:['driving','차량'],taxi:['driving','택시'],uber:['driving','우버'],transit:['transit','대중교통'],bus:['transit','버스'],train:['transit','기차'],rail:['transit','기차'],mrt:['transit','MRT'],metro:['transit','MRT'],subway:['transit','MRT'],bicycling:['bicycling','자전거'],bike:['bicycling','자전거'],bicycle:['bicycling','자전거'],cycling:['bicycling','자전거'],flight:['flight','항공'],air:['flight','항공'],airplane:['flight','항공']};
 const alias=key=>Object.prototype.hasOwnProperty.call(aliases,key)?aliases[key]:null;
 const explicit=plain(x.travel)||plain(x.mode);let mode=null,modeLabel='이동수단 미확인';
 if(x.isFlight===true){mode='flight';modeLabel='항공';}
 else if(explicit){const named=alias(explicit.toLowerCase());if(named){[mode,modeLabel]=named;}}
 else if(!x.routeStale){
  const kinds=(Array.isArray(x.seg)?x.seg:[]).map(s=>Array.isArray(s)?plain(s[0]):'');
  const groups=kinds.map(k=>['G','R','BL','O','BR','Y'].includes(k)?'transit':alias(k.toLowerCase())?.[0]);
  if(groups.length&&groups.every(Boolean)){const rides=[...new Set(groups.filter(k=>k!=='walking'))];if(rides.length<=1){mode=rides[0]||'walking';modeLabel=LABELS[mode];}}
 }
 const endpoint=(side,unknown)=>{
  let id=x[side];
  if(!id){const anchor=(trip?.items||[]).find(n=>n.id===x[side+'StopId']);if(anchor?.k==='s'&&anchor.place&&(!x[side+'StopPlace']||x[side+'StopPlace']===anchor.place))id=anchor.place;}
  const name=trip?.places?.[id]?.n;return typeof name==='string'&&plain(name)?plain(name):unknown;
 };
 const supplied=x.timeStatus==='supplied-plan',validSupplied=supplied&&currentSupplied(trip,x);
 const unknownTime=x.routeStale||['unconfirmed','target'].includes(x.timeStatus)||x.durationMinutes===null||supplied&&!validSupplied;
 const elapsed=(x.end-x.start)/MIN,duration=unknownTime?null:x.durationMinutes!==undefined?(positive(x.durationMinutes)?x.durationMinutes:null):positive(elapsed)?elapsed:null;
 const explicitFare=['confirmed','user-confirmed','user-entered','saved-plan'].includes(x.fareStatus);
 const unknownFare=x.fareStatus==='unconfirmed'||x.routeStale&&!explicitFare||supplied&&!validSupplied&&!explicitFare;
 let cost=!unknownFare&&nonnegative(x.cost)&&(x.cost>0||explicitFare||validSupplied&&x.fareStatus==='supplied-plan'||mode==='walking')?x.cost:null;
 if(validSupplied&&x.fareStatus==='supplied-plan'&&x.routePlanObservation.fare?.amount!==cost)cost=null;
 const prepaid=['결제완료','예약 완료'].includes(x.pay)&&!positive(x.cost)&&!unknownFare;
 return {fromName:endpoint('from','출발지 미확인'),toName:endpoint('to','도착지 미확인'),mode,modeLabel,durationMinutes:duration,durationLabel:duration===null?'이동시간 미확인':(validSupplied?'승인한 배정 ':'계획 ')+formatDuration(duration),cost:prepaid?null:cost,fareKind:prepaid?'prepaid':cost===null?'unknown':'planned'};
}
function placeSignature(p){if(!p)return null;return JSON.stringify([String(p.n||''),String(p.zh||''),String(p.addr||''),Array.isArray(p.ll)?p.ll:null]);}
// Country metadata wins over conservative regional coordinate recognition. These
// regions identify Korea/Taiwan only; they are not a general
// border database, distance threshold or reason to reject long domestic trips.
function pointInRegion(lat,lon,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[0]>lat)!==(b[0]>lat)&&lon<(b[1]-a[1])*(lat-a[0])/(b[0]-a[0])+a[1])inside=!inside;}return inside;}
function countryForPlace(place){
 if(!place)return null;
 const declared=plain(place.countryCode||place.country_code||place.country||'');
 if(declared){const value=declared.toUpperCase();if(['KR','KOR','SOUTH KOREA','REPUBLIC OF KOREA','KOREA','대한민국','한국'].includes(value))return 'KR';if(['TW','TWN','TAIWAN','대만','臺灣','台灣'].includes(value))return 'TW';return /^[A-Z]{2}$/.test(value)?value:'OTHER';}
 if(!Array.isArray(place.ll)||place.ll.length!==2||!place.ll.every(Number.isFinite))return null;
 const [lat,lon]=place.ll;
 if(lat>=33.1&&lat<=33.7&&lon>=126.1&&lon<=127||pointInRegion(lat,lon,[[38.6,128.35],[38,128.65],[37,129.4],[35.4,129.55],[34.85,128.8],[34.35,127.75],[34.3,126.2],[35.4,125.8],[37.7,126.1],[38.3,127.1]]))return 'KR';
 if(lat>=21.85&&lat<=25.4&&lon>=120&&lon<=122.1)return 'TW';
 return null;
}
function isKoreaTaiwanRoute(trip,from,to){const a=countryForPlace(trip?.places?.[from]),b=countryForPlace(trip?.places?.[to]);return a==='KR'&&b==='TW'||a==='TW'&&b==='KR';}
function airRequiredOption(trip,route){return {
 mode:'flight',label:'한국↔대만 항공 이동',duration:null,cost:null,sourceKind:'air-required',sourceLabel:'국가 간 이동 구간',sourceURL:null,mapURL:null,
 recommended:false,recommendationLabel:'',reason:'한국과 대만 사이 구간은 항공편과 공항까지의 이동을 나누어 확인하세요.',
 uncertainty:'이 출발지·도착지에 맞는 예약 항공편, 비행시간 또는 항공요금을 확인한 결과가 아니에요.',
 from:route.from,to:route.to,itemId:route.item?.id||null,title:plain(trip.places[route.from].n)+' → '+plain(trip.places[route.to].n),
 durationKind:'unknown',actionLabel:'항공편·공항 이동 확인',isCrossBorder:true,prepaid:false,walkingMinutes:null,transferCount:null,segments:[]
 };}
function routeKey(trip,x){if(!x||!x.from||!x.to||!trip?.places?.[x.from]||!trip.places[x.to])return null;return JSON.stringify([x.id||null,x.from,placeSignature(trip.places[x.from]),x.to,placeSignature(trip.places[x.to]),modeOf(x)]);}
function captureProvenance(trip){const out={};for(const x of trip?.items||[]){const key=routeKey(trip,x);if(x.k==='m'&&key&&!x.routeStale)out[x.id]={key,item:clone(x)};}return out;}
function matchingOriginal(trip,item,opts){
 if(!item)return null;
 const key=routeKey(trip,item);if(!key)return null;
 if(opts.originalTrip){const x=opts.originalTrip.items?.find(v=>v.id===item.id);return x&&routeKey(opts.originalTrip,x)===key?x:null;}
 const ref=opts.provenance?.[item.id]||trip.routeOptionProvenance?.[item.id];return ref&&ref.key===key?ref.item:null;
}
function hasOriginal(trip,item,opts){return !!(opts.originalTrip?.items?.some(x=>x.id===item?.id)||opts.provenance?.[item?.id]||trip.routeOptionProvenance?.[item?.id]);}
function resolveRoute(trip,target){
 const request=typeof target==='string'?{itemId:target}:target||{};
 const requested=trip?.items?.find(x=>x.id===(request.itemId||request.id))||null;
 let from=null,to=null,item=requested;
 if(requested?.k==='m'){from=requested.from||null;to=requested.to||null;}
 else if(requested){
  const day=(trip.items||[]).filter(x=>x.dayId===requested.dayId&&included(x)),n=day.findIndex(x=>x.id===requested.id);
  const before=day.slice(0,Math.max(0,n));const previous=before.slice().reverse().find(x=>x.k==='s'&&x.place);
  from=previous?.place||null;to=requested.place||null;
  // A visit may use only its adjacent, exact movement, never a different day's fare.
  const incoming=before.at(-1);item=incoming?.k==='m'&&incoming.from===from&&incoming.to===to?incoming:null;
 }
 if(Object.prototype.hasOwnProperty.call(request,'from'))from=request.from||null;
 if(Object.prototype.hasOwnProperty.call(request,'to'))to=request.to||null;
 return {from,to,item,requested,itemId:requested?.id||request.itemId||null};
}
function mapURL(trip,from,to,mode){
 const dest=trip?.places?.[to],origin=trip?.places?.[from];if(!dest||!MODES.includes(mode)||isKoreaTaiwanRoute(trip,from,to))return null;
 const query=p=>plain(p.zh||p.n)+' '+plain(p.addr||'');
 const q=new URLSearchParams({api:'1',destination:query(dest).trim(),travelmode:mode});if(origin)q.set('origin',query(origin).trim());
 const url='https://www.google.com/maps/dir/?'+q.toString();return url.length<=2048?url:null;
}
function formatDuration(value){if(positive(value))return Math.ceil(value)+'분';if(value&&positive(value.min)&&positive(value.max)&&value.max>=value.min)return Math.ceil(value.min)+'–'+Math.ceil(value.max)+'분';return '시간 확인 필요';}
function formatCost(value){const f=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:2});if(nonnegative(value))return 'NT$'+f(value);if(value&&nonnegative(value.min)&&nonnegative(value.max)&&value.max>=value.min)return 'NT$'+f(value.min)+'–'+f(value.max);return '요금 확인 필요';}
function transitType(mode){const value=plain(mode);if(['G','R','BL','O','BR','Y'].includes(value)||['mrt','metro','subway'].includes(value.toLowerCase()))return 'MRT';if(['train','rail','commuter_train','high_speed_rail','light_rail'].includes(value.toLowerCase()))return '기차';if(value.toLowerCase()==='bus')return '버스';return null;}
function metrics(item){
 const segments=(Array.isArray(item?.seg)?item.seg:[]).filter(s=>Array.isArray(s)&&positive(s[1]));
 const walk=segments.filter(s=>s[0]==='walk').reduce((sum,s)=>sum+s[1],0),transit=modeOf(item)==='transit';
 const rides=transit?segments.filter(s=>!['walk','air','taxi','car','bike','bicycle','bicycling','cycling'].includes(s[0])):[];
 const transitTypes=transit?[...new Set(segments.map(s=>transitType(s[0])).filter(Boolean))]:[];
 return {walkingMinutes:segments.length?walk:null,transferCount:rides.length?Math.max(0,rides.length-1):null,transitTypes,segments:segments.map(s=>({mode:plain(s[0]),modeLabel:transitType(s[0])||({'walk':'도보',taxi:'택시',car:'차량',bike:'자전거',bicycle:'자전거',bicycling:'자전거',cycling:'자전거'})[s[0]]||'',minutes:s[1],label:plain(s[2])}))};
}
function range(text){const a=text.replace(/,/g,'').split(/[~–-]/).map(Number);return a.length===2?{min:a[0],max:a[1]}:a[0];}
function simpleAlternative(item){
 // Only complete, endpoint-free single-mode statements are accepted. Descriptions
 // of other endpoints, mixed routes or partial boarding legs remain unparsed.
 const text=plain(item?.alt);if(!text)return null;
 const num='([0-9][0-9,]*(?:\\s*[~–-]\\s*[0-9][0-9,]*)?)';
 const car=new RegExp('^(우버(?:로)?|택시(?:로)?)\\s*(?:약\\s*)?'+num+'\\s*분\\s*[,·]\\s*(?:약\\s*)?NT\\$\\s*'+num+'\\s*[.]?$').exec(text);
 if(car){const duration=range(car[2].replace(/\s/g,'')),cost=range(car[3].replace(/\s/g,''));if(formatDuration(duration)!=='시간 확인 필요'&&formatCost(cost)!=='요금 확인 필요')return {mode:'driving',duration,cost};}
 const walk=new RegExp('^(?:걸어서|도보(?:로)?)\\s*(?:약\\s*)?'+num+'\\s*분\\s*[.]?$').exec(text);
 if(walk){const duration=range(walk[1].replace(/\s/g,''));if(formatDuration(duration)!=='시간 확인 필요')return {mode:'walking',duration,cost:0};}
 return null;
}
function unknownOption(trip,route,mode){return {mode,label:LABELS[mode],duration:null,cost:null,sourceKind:'unconfirmed',sourceLabel:SOURCE_LABELS.unconfirmed,sourceURL:null,mapURL:mapURL(trip,route.from,route.to,mode),recommended:false,recommendationLabel:'',reason:'',uncertainty:mode==='bicycling'?'자전거 경로 지원·도로 적합성·대여 가능 여부와 시간·요금은 아직 확인하지 않았어요.':mode==='transit'?'이 구간의 철도·MRT·버스 세부 경로와 현재 시간·요금은 아직 조회하지 않았어요. Google Maps에서 대중교통 경로를 확인하세요.':'이 구간·이동수단의 현재 소요시간과 요금은 아직 조회하지 않았어요.',from:route.from,to:route.to,itemId:route.item?.id||null,actionLabel:UNKNOWN,durationKind:'unknown',walkingMinutes:null,transferCount:null,transitTypes:[],segments:[]};}
function currentSupplied(trip,item){if(item?.timeStatus!=='supplied-plan'||!item.routePlanObservation)return false;try{const api=globalThis.TripRoutePlanPatch||(typeof require==='function'?require('./route-plan-patch.js'):null);return !!api?.observationMatches(trip,item);}catch(_){return false;}}
function knownPrimary(trip,route,opts){
 const x=route.item;if(!x||x.k!=='m'||!included(x)||isFlight(x)||x.from!==route.from||x.to!==route.to||!x.from||!x.to||x.routeStale)return null;
 const mode=modeOf(x);if(!MODES.includes(mode))return null;
 const original=matchingOriginal(trip,x,opts),changed=hasOriginal(trip,x,opts)&&!original,supplied=currentSupplied(trip,x);
 if(x.timeStatus==='supplied-plan'&&!supplied)return null;
 const timeConfirmed=x.timeStatus==='user-confirmed'||x.timeStatus==='confirmed',fareConfirmed=x.fareStatus==='user-confirmed'||x.fareStatus==='confirmed';
 // A changed route's original data cannot be rescued by positive schedule times.
 const durationOK=(!changed||timeConfirmed||x.timeStatus==='user-entered'||supplied)&&x.timeStatus!=='unconfirmed'&&x.durationMinutes!==null;
 const costOK=(!changed||fareConfirmed||x.fareStatus==='user-entered'||supplied)&&x.fareStatus!=='unconfirmed';
 const elapsed=(x.end-x.start)/MIN;
 const duration=durationOK?(positive(x.durationMinutes)?x.durationMinutes:positive(elapsed)?elapsed:null):null;
 let cost=costOK&&nonnegative(x.cost)&&(x.cost>0||mode==='walking'||x.fareStatus==='confirmed'||x.fareStatus==='user-confirmed'||x.fareStatus==='user-entered'||supplied&&x.fareStatus==='supplied-plan')?x.cost:null;
 if(supplied&&x.fareStatus==='supplied-plan'&&x.routePlanObservation.fare?.amount!==cost)cost=null;
 if(duration===null&&cost===null)return null;
 const sourceKind=supplied?'supplied-plan':timeConfirmed&&fareConfirmed?'user-confirmed':'planned';
 const o={...unknownOption(trip,route,mode),duration,cost,sourceKind,sourceLabel:SOURCE_LABELS[sourceKind],durationSourceKind:timeConfirmed?'user-confirmed':'planned',costSourceKind:fareConfirmed?'user-confirmed':'planned',durationKind:positive(x.durationMinutes)?(timeConfirmed?'confirmed-duration':'recorded-duration'):'schedule-window',isCurrentPlan:true,uncertainty:sourceKind==='user-confirmed'?'사용자가 확인한 기록이며 실시간 도착 예상·배차·요금은 달라질 수 있어요.':'일정에 배정한 시간과 계획 예산이에요. 실시간 도착 예상·배차·요금이 아니에요.'};
 if(!changed&&!supplied)Object.assign(o,metrics(x));
 if(supplied){const evidence=x.routePlanObservation,raw=evidence.durationMinutes;o.sourceURL=safeURL(evidence.source.url);o.observedDuration=raw.exact??{min:raw.min,max:raw.max};o.observedDurationText=formatDuration(o.observedDuration);o.durationKind='planning-allocation';o.durationSourceKind='supplied-plan';const suppliedFare=cost!==null&&x.fareStatus==='supplied-plan'&&evidence.fare?.amount===cost;o.costSourceKind=cost===null?'unconfirmed':suppliedFare?'supplied-plan':'planned';if(cost!==null&&!suppliedFare)o.sourceLabel='공유받은 지도 조회 시간 · 요금은 별도 계획값';o.checkedAt=evidence.source.checkedAt;o.departureBasis=evidence.source.departureBasis;o.sourceDeparture=evidence.source.plannedDeparture;o.evidenceNote=evidence.reason||'';o.uncertainty='공유받은 조회 기록으로 승인한 계획 배정시간입니다. 앱의 실시간 조회·도착 보장이 아닙니다.'+(evidence.source.departureBasis==='planned'?' 지정 출발시각으로 조회한 기록입니다.':evidence.source.departureBasis==='current'?' 조회 당시 기본 출발 기준이며 여행 날짜의 확정값이 아닙니다.':'출발시각을 지정하지 않은 조회 기록입니다.');if(cost!==null&&!suppliedFare)o.uncertainty+=' 요금은 별도로 입력한 계획값이며 조회에서 확인한 요금이 아닙니다.';}
 if(mode==='driving')o.uncertainty+=' 우버 요금은 호출 앱에서 확인하세요.';
 if(mode==='bicycling')o.uncertainty+=' 자전거 경로 지원·도로 적합성·대여 가능 여부와 대여료는 별도로 확인하세요.';
 if(mode==='transit'){if(o.transitTypes?.length)o.label=o.transitTypes.join('·');else o.uncertainty+=' 철도·MRT·버스 세부 경로는 기록되지 않았어요. Google Maps 링크는 일반 대중교통 조회입니다.';}
 if(duration===null)o.uncertainty+=' 이동시간은 확인이 필요해요.';
 if(cost===null)o.uncertainty+=' 이 구간의 요금은 기록되지 않았어요.';
 return o;
}
function flightOption(item){
 const booked=item.reservationStatus==='confirmed'||item.pay==='결제완료'||item.pay==='예약 완료';
 const sourceKind=booked?'booked-flight':'flight-plan',elapsed=(item.end-item.start)/MIN;
 return {mode:'flight',label:booked?'예약된 항공편':'항공 일정',duration:positive(elapsed)?elapsed:null,cost:positive(item.cost)?item.cost:null,sourceKind,sourceLabel:SOURCE_LABELS[sourceKind],sourceURL:null,mapURL:null,recommended:false,recommendationLabel:'',reason:'항공 일정은 지상 이동수단 비교에서 제외돼요.',uncertainty:'항공사에서 운항·탑승 시각을 확인하세요.',itemId:item.id,title:plain(item.title),start:item.start,end:item.end,tz:item.tz,endTz:item.endTz,durationKind:'flight-schedule',actionLabel:'항공 일정 확인',prepaid:booked&&!positive(item.cost),walkingMinutes:null,transferCount:null,segments:[]};
}
function applyRecommendation(options,opts){
 const planned=options.find(o=>o.isCurrentPlan&&o.duration!==null);if(!planned)return;
 // This is an explanation of the current plan, deliberately not an optimizer.
 planned.recommended=true;planned.recommendationLabel='현재 계획 추천';
 if(planned.mode==='walking'){planned.reason='현재 계획은 짧은 구간을 걸어서 연결해요.';if(typeof planned.duration==='number'&&planned.duration>15)planned.reason='현재 계획은 도보 이동이에요. 오래 걷기 부담스러우면 차량 경로를 확인하세요.';}
 else if(planned.mode==='bicycling')planned.reason='현재 계획은 자전거 이동이에요. 실제 이용 가능한 자전거 경로와 대여 여부를 따로 확인하세요.';
 else if(planned.mode==='driving')planned.reason='현재 계획은 차량 이동이에요. 짐이 있거나 걷는 부담을 줄일 때 편해요.';
 else planned.reason=planned.transferCount===0?'현재 계획은 환승 없는 대중교통이에요.':Number.isFinite(planned.transferCount)?'현재 계획은 대중교통으로 환승 '+planned.transferCount+'회예요.':'현재 일정에 잡아둔 대중교통 계획이에요.';
 if(opts.preferences?.avoidLongWalks&&positive(planned.walkingMinutes)&&planned.walkingMinutes>15)planned.reason+=' 도보 '+formatDuration(planned.walkingMinutes)+'가 포함돼 있어 피로하면 차량을 확인하세요.';
}
function decorate(o){
 o.durationText=formatDuration(o.duration);o.costText=o.prepaid?'사전 결제 · 금액 미기록':formatCost(o.cost);
 o.summary=o.sourceKind==='unconfirmed'?UNKNOWN:o.durationText+' · '+o.costText;
 if(o.durationKind==='planning-allocation'&&o.duration!==null)o.durationText='계획 배정 '+o.durationText;
 if(o.durationKind==='schedule-window'&&o.duration!==null)o.durationText='계획 '+o.durationText;
 if(o.sourceKind==='planned-alternative'&&o.duration!==null)o.durationText='원본 참고 '+o.durationText;
 return o;
}
function buildOptions(trip,target,opts={}){
 const route=resolveRoute(trip,target);
 if(isKoreaTaiwanRoute(trip,route.from,route.to)){
  const flight=route.requested||route.item;
  if(isFlight(flight)&&flight.from===route.from&&flight.to===route.to)return [decorate(flightOption(flight))];
  return [decorate(airRequiredOption(trip,route))];
 }
 if(isFlight(route.requested||route.item))return [decorate(flightOption(route.requested||route.item))];
 if(!trip?.places?.[route.to])return [];
 const result=MODES.map(mode=>unknownOption(trip,route,mode));
 const primary=knownPrimary(trip,route,opts);if(primary)result[MODES.indexOf(primary.mode)]=primary;
 const original=route.item&&!route.item.routeStale&&route.item.from===route.from&&route.item.to===route.to?matchingOriginal(trip,route.item,opts):null;
 const alternative=original&&simpleAlternative(original);
 if(alternative&&alternative.mode!==primary?.mode){
  const i=MODES.indexOf(alternative.mode);result[i]={...result[i],...alternative,sourceKind:'planned-alternative',sourceLabel:SOURCE_LABELS['planned-alternative'],durationKind:'reference-estimate',uncertainty:'원본 일정에 적힌 같은 구간의 대안 참고값이에요. 현재 시간·요금은 지도와 호출 앱에서 확인하세요.'};
 }
 applyRecommendation(result,opts);return result.map(decorate);
}
function remainingFlights(trip,now){return (trip?.items||[]).filter(x=>isFlight(x)&&included(x)&&x.status!=='done'&&(!Number.isFinite(now)||x.end>=now)).sort((a,b)=>a.start-b.start).map(x=>decorate(flightOption(x)));}
function referenceGuides(){return clone([
 {id:'airport-mrt-fare',label:'공항철도 공식 요금표',text:'A1 타이베이역–A12 제1터미널 일반 성인 편도 NT$160. 해당 역 구간의 표준요금이며 출발지부터 역까지의 이동비는 별도예요.',sourceURL:'https://www.tymetro.com.tw/tymetro-new/en/_images/document/travel-guide/price.pdf',checkedAt:'2026-10-01'},
 {id:'airport-mrt-time',label:'공항철도 공식 소요시간 안내',text:'제1터미널→타이베이역 열차 탑승시간 참고: 직달 약 35분, 일반 약 50분. 대기·역 접근·터미널 이동시간은 별도이며 실제 운행을 확인하세요.',sourceURL:'https://www.travel.taipei/en/information/taoyuanmetro',timetableURL:'https://www.tymetro.com.tw/tymetro-new/en/_pages/travel-guide/timetable-A1',checkedAt:'2026-10-01'},
 {id:'taipei-taxi',label:'타이베이시 공식 택시 요금 안내',text:'타이베이 일반 택시: 처음 1.25km NT$85, 이후 200m마다 NT$5, 시속 5km 미만 60초마다 NT$5. 23:00–06:00 탑승은 NT$20 추가. 경로 견적이나 우버 요금이 아니에요.',sourceURL:'https://english.dot.gov.taipei/News_Content.aspx?n=C4B79B3C50459041&s=BB2FB8006C15186B&sms=5B794C46F3CDE718',checkedAt:'2026-10-01'}
]);}
return {buildOptions,resolveRoute,countryForPlace,isKoreaTaiwanRoute,remainingFlights,captureProvenance,routeKey,modeOf,isFlight,movementSummary,mapURL,formatDuration,formatCost,escapeHTML,safeURL,plain,referenceGuides,UNKNOWN};
});
