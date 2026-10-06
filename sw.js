'use strict';
// Bump VERSION whenever any app-shell asset changes. Does not touch user storage.
const VERSION='2.9.0',PREFIX='taipei-pocket:'+self.registration.scope+':',CACHE=PREFIX+VERSION;
const PATHS=['./','./navigation.js','./delivery-copy.js','./delivery-copy.css','./closure-plan-patch.js','./place-reviews-data.js','./place-reviews.js','./place-reviews.css','./index.html','./core.js','./app.js','./ux.js','./schedule-proposals.js','./receipts.js','./receipt-ui.js','./receipt-ui.css','./receipt-queue.js','./route-options.js','./route-plan-patch.js','./itinerary-map.js','./itinerary-map.css','./button-help.js','./button-help.css','./connection-status.js','./connection-status.css','./vendor/leaflet/leaflet.js','./vendor/leaflet/leaflet.css','./vendor/leaflet/images/layers.png','./vendor/leaflet/images/layers-2x.png','./vendor/leaflet/images/marker-icon.png','./vendor/leaflet/images/marker-icon-2x.png','./vendor/leaflet/images/marker-shadow.png','./styles.css','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./icon-maskable.png'];
const URLS=PATHS.map(p=>new URL(p,self.registration.scope).href);
const SHELL_URLS=['./','./index.html'].map(p=>new URL(p,self.registration.scope).href);
function navigationShell(response){
 // Never turn opaque, cross-origin or host sign-in responses into an app shell.
 if(!response?.ok||!['basic','default'].includes(response.type))return null;
 if(response.url){if(!SHELL_URLS.includes(new URL(response.url).href))return null;}
 else if(response.redirected)return null;
 if(!response.redirected)return response;
 // Clean-URL hosts may redirect index.html to the root during precaching.
 // Navigation rejects that redirect history; clone() alone preserves it.
 // A fresh same-origin Response keeps the bytes, status and security headers.
 const copy=response.clone();
 return new Response(copy.body,{status:copy.status,statusText:copy.statusText,headers:copy.headers});
}
async function appNavigation(request){
 try{
  const cache=await caches.open(CACHE);
  // Prefer the canonical root, which normally avoids the clean-URL redirect.
  for(const url of SHELL_URLS){
   try{const shell=navigationShell(await cache.match(url));if(shell)return shell;}catch(error){/* Try the other cached shell, then the network. */}
  }
 }catch(error){/* Cache access failure must not prevent an online navigation. */}
 return fetch(request);
}
self.addEventListener('install',e=>e.waitUntil((async()=>{try{const cache=await caches.open(CACHE);await cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})));}catch(error){await caches.delete(CACHE);throw error;}})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const req=e.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 // This marker must always use the network; shell cache is not evidence of a connection.
 if(url.pathname===new URL('./connection-check.txt',self.registration.scope).pathname){e.respondWith(fetch(req,{cache:'no-store'}));return;}
 const ocrBase=new URL('./receipt-assets/',self.registration.scope);const ocrPath=url.pathname.slice(ocrBase.pathname.length);if(url.origin===ocrBase.origin&&url.pathname.startsWith(ocrBase.pathname)&&['tesseract.min.js','worker.min.js','core/tesseract-core.wasm.js','core/tesseract-core-simd.wasm.js','core/tesseract-core-lstm.wasm.js','core/tesseract-core-simd-lstm.wasm.js','lang/eng.traineddata.gz','lang/chi_tra.traineddata.gz'].includes(ocrPath)){const ocrCache='taipei-receipt-ocr:'+ocrBase.pathname+':tesseract-6.0.1';e.respondWith((async()=>{const cache=await caches.open(ocrCache);const canonical=new URL(url.href);canonical.search='';return await cache.match(canonical.href)||await fetch(req);})());return;}
 if(req.mode==='navigate'){
  // Keep sign-in, logout and other host routes on the network. Only the app's
  // root/index navigation can use our offline shell.
  const rootPath=new URL('./',self.registration.scope).pathname,indexPath=new URL('./index.html',self.registration.scope).pathname;
  if(url.pathname!==rootPath&&url.pathname!==indexPath)return;
  e.respondWith(appNavigation(req));return;
 }
 url.search='';if(URLS.includes(url.href))e.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(url.href)||await fetch(req);})());
});
self.addEventListener('message',e=>{
 if(e.data?.type==='SKIP_WAITING'){e.waitUntil(self.skipWaiting());return;}
 if(e.data?.type==='CACHE_STATUS')e.waitUntil((async()=>{const cache=await caches.open(CACHE),hits=await Promise.all(URLS.map(url=>cache.match(url)));e.ports[0]?.postMessage({ready:hits.every(Boolean),version:VERSION,assets:hits.filter(Boolean).length,expected:URLS.length});})());
});
