/* Small same-document history controller. Snapshots contain navigation only. */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.TripNavigation=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const STATE_KEY='__taipeiNavigation',VERSION=1;
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 function snapshot(value){
  const text=JSON.stringify(value);
  if(text===undefined)throw new TypeError('Navigation snapshot must be JSON serializable.');
  return {value:JSON.parse(text),text};
 }
 function create(options={}){
  const win=options.window||globalThis.window,history=win?.history;
  if(typeof options.read!=='function'||typeof options.apply!=='function')throw new TypeError('Navigation requires read and apply callbacks.');
  let started=false,destroyed=false,usable=!!history,applying=false,current=null,pending=null,queued=null,blocked=null,serial=0;
  const report=error=>{try{options.onError?.(error);}catch(_){} };
  function owned(state){
   const entry=object(state)?state[STATE_KEY]:null;
   return object(entry)&&entry.version===VERSION&&typeof entry.session==='string'&&entry.session.length>0&&Number.isSafeInteger(entry.index)&&entry.index>=0&&Object.prototype.hasOwnProperty.call(entry,'snapshot')?entry:null;
  }
  function sameSession(entry){return !!entry&&!!current&&entry.session===current.session;}
  function entryCopy(entry){return {...entry,snapshot:snapshot(entry.snapshot).value};}
  function capture(value){try{return snapshot(value===undefined?options.read():value);}catch(error){report(error);return null;}}
  function invalidateBlock(){blocked=null;}
  function disable(error){usable=false;pending=null;queued=null;invalidateBlock();report(error);}
  function write(method,entry){
   try{
    // Retain state belonging to the host or another same-document integration.
    const base=object(history.state)?history.state:{};
    history[method]({...base,[STATE_KEY]:entry},'');
    current=entryCopy(entry);
    return true;
   }catch(error){disable(error);return false;}
  }
  function apply(entry){
   current=entryCopy(entry);applying=true;
   try{options.apply(snapshot(entry.snapshot).value);}catch(error){report(error);}
   finally{applying=false;}
   // The host may sanitize stale IDs or non-restorable transient dialogs.
   const actual=capture();
   if(actual&&actual.text!==JSON.stringify(current.snapshot))write('replaceState',{...current,snapshot:actual.value});
  }
  function dirty(){try{return !!options.dirty?.();}catch(error){report(error);return true;}}
  function warn(delta){
   const token={id:++serial,session:current?.session,index:current?.index};blocked=token;
   const retry=()=>{
    if(blocked!==token||destroyed||pending||!usable||!current||current.session!==token.session||current.index!==token.index)return false;
    blocked=null;return travel(delta,true);
   };
   try{options.onBlocked?.(retry);}catch(error){report(error);}
  }
  function travel(delta,force=false){
   if(destroyed||!started||!usable||!current||pending||!Number.isSafeInteger(delta)||!delta||current.index+delta<0)return false;
   if(!force&&dirty()){warn(delta);return true;}
   invalidateBlock();pending={kind:'travel',target:current.index+delta,force};
   try{history.go(delta);return true;}catch(error){disable(error);return false;}
  }
  function freshEntry(value){
   const session=win?.crypto?.randomUUID?.()||'nav-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   return {version:VERSION,session,index:0,snapshot:value};
  }
  function commit(kind,captured){
   if(!captured||destroyed||!usable)return false;
   invalidateBlock();
   if(!current)return write('replaceState',freshEntry(captured.value));
   if(kind==='sync'&&captured.text===JSON.stringify(current.snapshot))return false;
   const next={...current,index:current.index+(kind==='sync'?1:0),snapshot:captured.value};
   return write(kind==='sync'?'pushState':'replaceState',next);
  }
  function flush(){const next=queued;queued=null;if(next)commit(next.kind,next.captured);}
  function record(kind,value){
   if(destroyed||applying)return false;
   if(!started)start();
   if(!usable)return false;
   const captured=capture(value);if(!captured)return false;
   if(pending){
    // A close/back may be immediately followed by a new view or a save result.
    // Preserve its live DOM and serialize the history write after traversal.
    queued={kind,captured};return true;
   }
   return commit(kind,captured);
  }
  function onPop(event){
   if(destroyed||!started||!usable)return;
   const target=owned(event.state);
   if(!sameSession(target)){
    // Root/native exit and foreign history are never intercepted or repushed.
    current=null;pending=null;queued=null;invalidateBlock();return;
   }
   if(pending?.kind==='restore'){
    const restore=pending;
    if(target.index!==restore.index){
     // Consecutive browser Back presses can run ahead of our correction.
     // Never enqueue another correction for a move in the user's direction:
     // history.go deltas execute asynchronously against the then-current cursor.
     // Wait until the correction has moved the cursor in its own direction.
     const movement=target.index-restore.lastIndex;restore.lastIndex=target.index;
     if(Math.sign(movement)===Math.sign(restore.correction)){
      restore.correction=restore.index-target.index;
      try{history.go(restore.correction);}catch(error){disable(error);}
     }
     return;
    }
    pending=null;current=entryCopy(target);
    if(queued){flush();return;}
    warn(restore.delta);return;
   }
   const travelRequest=pending;
   pending=null;
   if(queued){current=entryCopy(target);flush();return;}
   const delta=target.index-current.index;
   if(!delta){current=entryCopy(target);return;}
   const approved=travelRequest?.kind==='travel'&&travelRequest.force&&travelRequest.target===target.index;
   if(!approved&&dirty()){
    pending={kind:'restore',index:current.index,delta,lastIndex:target.index,correction:-delta};
    try{history.go(-delta);}catch(error){disable(error);}
    return;
   }
   invalidateBlock();apply(target);
  }
  function start(){
   if(started||destroyed)return api;started=true;
   if(!usable){report(new Error('Browser history is unavailable.'));return api;}
   win.addEventListener('popstate',onPop);
   let old;
   try{old=owned(history.state);}catch(error){disable(error);return api;}
   if(old&&(!Number.isFinite(history.length)||old.index<history.length)){
    try{apply(old);}catch(error){disable(error);}
   }else{
    const initial=capture();if(initial)write('replaceState',freshEntry(initial.value));
   }
   return api;
  }
  const api={
   start,
   sync:value=>record('sync',value),
   replace:value=>record('replace',value),
   back:({force=false}={})=>{
    // An app close must not leave the document; the browser owns root Back.
    if(!current||current.index<=0||pending||!usable||destroyed)return false;
    return travel(-1,force);
   },
   destroy(){if(destroyed)return;destroyed=true;win?.removeEventListener('popstate',onPop);pending=null;queued=null;blocked=null;},
   get isApplying(){return applying;},
   get isPending(){return !!pending;},
   get canBack(){return !!current&&current.index>0&&usable&&!destroyed;},
   get available(){return usable&&!destroyed;},
   get state(){return current?entryCopy(current):null;}
  };
  return api;
 }
 return {create,STATE_KEY,VERSION};
});
