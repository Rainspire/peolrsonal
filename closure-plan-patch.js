/* Narrow local visit/endpoint corrections. No date, time, booking, note or money edits. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.TripClosurePlanPatch=factory(root.TripCore);})(typeof globalThis!=='undefined'?globalThis:this,function(C){
'use strict';
const clone=C.clone,own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),same=(a,b)=>JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
const fail=message=>{throw Error(message);};
function object(v){return v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
function keys(v,allowed,required=[]){if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k))||required.some(k=>!own(v,k)))fail('허용되지 않은 변경 파일 항목입니다.');}
function word(v,max=1000){if(typeof v!=='string'||!v.trim()||v.length>max)fail('변경 파일의 문구를 확인하세요.');return v;}
function id(v){if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(v))fail('변경 파일의 ID를 확인하세요.');return v;}
function source(v){try{const u=new URL(v);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch(_){}fail('변경 근거는 안전한 HTTPS 주소여야 합니다.');}
function parse(input){
 const raw=typeof input==='string'?input:JSON.stringify(input);if(raw.length>200000)fail('일정 변경 파일이 너무 큽니다.');let p;try{p=JSON.parse(raw);}catch(_){fail('일정 변경 파일을 읽을 수 없습니다.');}
 keys(p,['kind','version','patchId','title','summary','places','items'],['kind','version','patchId','title','summary','places','items']);if(p.kind!=='taipei-closure-plan-patch'||p.version!==1)fail('지원하지 않는 일정 변경 파일입니다.');id(p.patchId);word(p.title);word(p.summary,5000);if(!Array.isArray(p.places)||p.places.length>3||!Array.isArray(p.items)||!p.items.length||p.items.length>12)fail('이 파일은 장소 3곳·일정 12개까지의 작은 변경만 지원합니다.');
 const placeIds=new Set(),itemIds=new Set();for(const q of p.places){keys(q,['placeId','place','sourceURL'],['placeId','place','sourceURL']);id(q.placeId);if(placeIds.has(q.placeId))fail('중복된 장소입니다.');placeIds.add(q.placeId);keys(q.place,['n','zh','addr','ll'],['n','addr']);word(q.place.n);word(q.place.addr);if(q.place.zh!==undefined)word(q.place.zh);if(q.place.ll!==undefined&&(!Array.isArray(q.place.ll)||q.place.ll.length!==2||!q.place.ll.every(Number.isFinite)||Math.abs(q.place.ll[0])>90||Math.abs(q.place.ll[1])>180))fail('장소 좌표를 확인하세요.');source(q.sourceURL);}
 for(const row of p.items){keys(row,['itemId','before','set','reason','sourceURL'],['itemId','before','set','reason','sourceURL']);id(row.itemId);if(itemIds.has(row.itemId))fail('중복된 일정 변경입니다.');itemIds.add(row.itemId);keys(row.before,['k','dayId','start','end','title','place','from','to','travel','body','sub'],['k','dayId','start','end','title']);if(row.before.k==='s'&&!own(row.before,'place')||row.before.k==='m'&&['from','to','travel'].some(k=>!own(row.before,k)))fail('변경 전 장소·경로의 확인값이 필요합니다.');if(!['s','m'].includes(row.before.k)||!Number.isFinite(row.before.start)||!Number.isFinite(row.before.end)||row.before.end<row.before.start)fail('변경 전 일정의 시간·종류를 확인하세요.');id(row.before.dayId);word(row.before.title);keys(row.set,['title','place','from','to','body','sub']);if(!Object.keys(row.set).length)fail('변경할 내용이 없습니다.');for(const [k,v]of Object.entries(row.set)){if(['place','from','to'].includes(k))id(v);else{if(typeof v!=='string'||v.length>(k==='body'?50000:1000))fail('변경할 문구가 올바르지 않습니다.');if(k==='title')word(v);if(['body','sub'].includes(k)&&!own(row.before,k))fail('안내문 변경에는 기존 안내문의 확인값이 필요합니다.');}}
 if(row.before.k==='s'&&['from','to'].some(k=>own(row.set,k))||row.before.k==='m'&&own(row.set,'place'))fail('방문과 이동의 장소 필드가 섞였습니다.');word(row.reason,5000);source(row.sourceURL);}
 return p;
}
function preview(trip,input){
 C.validateTrip(trip);const patch=parse(input),candidate=clone(trip),issues=[],rows=[],placeRows=[];C.bindRouteAnchors(candidate);
 for(const q of patch.places){const old=trip.places[q.placeId];if(old&&!Object.entries(q.place).every(([k,v])=>same(old[k],v)))issues.push('“'+q.place.n+'” ID에 다른 장소가 저장되어 있습니다. 기존 장소를 덮어쓰지 않습니다.');else if(!old){candidate.places[q.placeId]=clone(q.place);placeRows.push(clone(q));}}
 const already=patch.items.every(row=>{const x=trip.items.find(n=>n.id===row.itemId);return x&&Object.entries(row.set).every(([k,v])=>same(x[k],v));})&&patch.places.every(q=>trip.places[q.placeId]&&Object.entries(q.place).every(([k,v])=>same(trip.places[q.placeId][k],v)));
 if(already)return {status:'already',canApply:false,issues:[],rows:[],placeRows:[],patch,trip:clone(trip),baseFingerprint:JSON.stringify(trip)};
 for(const row of patch.items){const old=trip.items.find(x=>x.id===row.itemId),next=candidate.items.find(x=>x.id===row.itemId);if(!old){issues.push('변경 대상 일정이 없습니다: '+row.itemId);continue;}
  const mismatch=Object.keys(row.before).filter(k=>!same(old[k],row.before[k]));if(mismatch.length){issues.push('“'+old.title+'”의 '+mismatch.join('·')+' 내용이 변경 파일과 다릅니다. 현재 일정을 유지합니다.');continue;}
  if(old.status!=='pending'||C.protectedItem(old)||old.isFlight){issues.push('“'+old.title+'”은 진행·완료 또는 보호된 일정이라 이 파일로 바꾸지 않습니다.');continue;}
  if(['place','from','to'].some(k=>row.set[k]&&!candidate.places[row.set[k]])){issues.push('“'+old.title+'”의 새 장소가 없습니다.');continue;}
  Object.assign(next,clone(row.set));next.closurePlanChange={patchId:patch.patchId,reason:row.reason,sourceURL:row.sourceURL,placeChanged:old.k==='s'&&old.place!==next.place};const routeChanged=old.k==='m'&&(old.from!==next.from||old.to!==next.to);
  if(routeChanged){next.previousRouteGuidance={patchId:patch.patchId,from:old.from,to:old.to,body:old.body||'',sub:old.sub||'',seg:clone(old.seg||[]),steps:clone(old.steps||[]),kv:clone(old.kv||[]),tip:old.tip||'',alt:old.alt||'',durationMinutes:old.durationMinutes??null,cost:old.cost,routePlanObservation:clone(old.routePlanObservation||null)};Object.assign(next,{routeStale:true,durationMinutes:null,timeStatus:'target',fareStatus:'unconfirmed',routeSourceInvalidated:true,seg:[],steps:[],kv:[],tip:'',alt:'',body:'출발 목표만 유지한 변경 구간입니다. 새 경로의 소요시간·요금을 확인해 주세요.'});delete next.routePlanObservation;delete next.routePlanPatch;}
  rows.push({itemId:row.itemId,before:clone(old),after:clone(next),reason:row.reason,sourceURL:row.sourceURL,routeChanged});
 }
 // Verify the local graph, including extra phone-created links that the patch
 // did not know about. A replaced visit cannot leave an old endpoint attached.
 const changedVisits=new Set(rows.filter(r=>r.before.k==='s'&&r.before.place!==r.after.place).map(r=>r.itemId));
 for(const m of candidate.items.filter(x=>x.k==='m'&&C.included(x))){for(const side of ['from','to']){const stopId=m[side+'StopId'];if(changedVisits.has(stopId)){const stop=candidate.items.find(x=>x.id===stopId);if(m[side]!==stop?.place)issues.push('“'+m.title+'”의 연결 장소가 맞지 않습니다. 이 기기의 추가 이동 구간도 함께 확인해야 합니다.');else m[side+'StopPlace']=stop.place;}}}
 C.bindRouteAnchors(candidate);C.validateTrip(candidate);
 // Before/after cards include finalized route-anchor metadata, while notes,
 // dates, durations of visits, spending, status and bookings are never changed.
 for(const row of rows)row.after=clone(candidate.items.find(x=>x.id===row.itemId));
 return {status:issues.length?'blocked':'ready',canApply:!issues.length&&rows.length>0,issues,rows,placeRows,patch,trip:candidate,baseFingerprint:JSON.stringify(trip)};
}
function apply(trip,view){if(!view||JSON.stringify(trip)!==view.baseFingerprint)fail('현재 일정이 바뀌었습니다. 변경 파일을 다시 열어 비교하세요.');const checked=preview(trip,view.patch);if(!checked.canApply)fail(checked.status==='already'?'이미 반영한 변경입니다.':checked.issues[0]||'변경안을 적용할 수 없습니다.');if(JSON.stringify(checked.rows)!==JSON.stringify(view.rows)||JSON.stringify(checked.placeRows)!==JSON.stringify(view.placeRows))fail('검토한 변경안이 달라졌습니다. 다시 비교하세요.');return clone(checked.trip);}
return Object.freeze({parse,preview,apply});
});
