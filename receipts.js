/* Taipei Pocket receipt tools. Local OCR only; parsed fields are review suggestions. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ReceiptCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const VERSION='1.0.0', MAX_TEXT=100000, MAX_IMAGE_BYTES=20*1024*1024;
const normalize=s=>String(s??'').normalize('NFKC').replace(/\r\n?/g,'\n').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/[‐‑–—−]/g,'-').replace(/[ \t]+/g,' ').trim();
const pad=n=>String(n).padStart(2,'0');
const compact=s=>s.replace(/([\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g,'$1');
function validDate(y,m,d){if(y<1912||y>2199||m<1||m>12||d<1||d>31)return null;const t=new Date(Date.UTC(y,m-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d?`${y}-${pad(m)}-${pad(d)}`:null;}
function yearValue(s){const n=Number(s);return s.length<=3?n+1911:n;}
function periodForDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;const [year,month,day]=date.split('-').map(Number);if(!validDate(year,month,day))return null;const startMonth=month%2?month:month-1;return {year,startMonth,endMonth:startMonth+1,label:`${year}년 ${startMonth}–${startMonth+1}월`};}
function parseMoney(token){if(!/^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(token))return null;const n=Number(token.replace(/,/g,''));return Number.isFinite(n)&&Math.abs(n)<=100000000?n:null;}
function parseReceipt(input,options={}){
 const text=normalize(input).slice(0,MAX_TEXT),lines=text.split('\n').map(compact).filter(Boolean),warnings=[],confidence={},fieldEvidence={};
 const out={text,date:null,time:null,merchant:null,total:null,currency:null,invoiceNumber:null,randomNumber:null,sellerTaxId:null,buyerTaxId:null,lotteryPeriod:null,needsReview:true,confidence,fieldEvidence,warnings};
 function set(k,v,c,line){out[k]=v;confidence[k]=c;fieldEvidence[k]=line||'';}
 function warn(code){if(!warnings.includes(code))warnings.push(code);}
 if(String(input??'').length>MAX_TEXT)warn('text-truncated');
 // Never repair O/0, I/1 or S/5 in identifiers without the user's review.
 const invoiceMatches=[];for(const line of lines){for(const m of line.toUpperCase().matchAll(/(?:^|[^A-Z0-9])([A-Z]{2})[ -]?(\d{8})(?!\d)/g))invoiceMatches.push({value:m[1]+m[2],line});}
 const invoices=[...new Set(invoiceMatches.map(x=>x.value))];
 if(invoices.length===1)set('invoiceNumber',invoices[0],.95,invoiceMatches[0].line);else if(invoices.length>1)warn('multiple-invoice-numbers');
 const dates=[];
 for(const line of lines){
  for(const m of line.matchAll(/(?:^|[^\d])((?:19|20|21)\d{2}|\d{2,3})\s*[\/年.\-]\s*(\d{1,2})\s*[\/月.\-]\s*(\d{1,2})(?:日)?(?![\d月])/g)){
   const value=validDate(yearValue(m[1]),+m[2],+m[3]);if(value)dates.push({value,line,score:/交易日期|開立日期|發票日期|消費日期|日期|DATE/i.test(line)?3:2});else warn('invalid-date');
  }
  const m=line.match(/^(?:(?:交易日期|開立日期|發票日期|日期|DATE)\s*[: ]\s*)?((?:19|20|21)\d{6}|\d{7})(?=$|\s)/i);
  if(m){const s=m[1],l=s.length-4,value=validDate(yearValue(s.slice(0,l)),+s.slice(l,l+2),+s.slice(l+2));if(value)dates.push({value,line,score:1});else warn('invalid-date');}
 }
 dates.sort((a,b)=>b.score-a.score);
 if(dates.length){const best=dates.filter(d=>d.score===dates[0].score),uniq=[...new Set(best.map(d=>d.value))];if(uniq.length===1)set('date',uniq[0],dates[0].score>=2?.9:.72,dates[0].line);else warn('multiple-dates');}
 const timeLines=out.date?[...lines.filter(l=>l===fieldEvidence.date),...lines.filter(l=>/時間|TIME/i.test(l))]:lines.filter(l=>/時間|TIME/i.test(l));
 for(const line of timeLines){const m=line.match(/(?:^|[^\d])(\d{1,2}):(\d{2})(?::\d{2})?(?!\d)/);if(m&&+m[1]<24&&+m[2]<60){set('time',`${pad(+m[1])}:${m[2]}`,.85,line);break;}}
 const periodMatches=[];for(const line of lines){const m=line.match(/((?:19|20|21)\d{2}|\d{2,3})\s*年\s*(\d{1,2})\s*(?:-|~|至)\s*(\d{1,2})\s*月/);if(m){const year=yearValue(m[1]),startMonth=+m[2],endMonth=+m[3];if(year>=1912&&year<=2199&&startMonth%2===1&&endMonth===startMonth+1&&endMonth<=12)periodMatches.push({year,startMonth,endMonth,label:`${year}년 ${startMonth}–${endMonth}월`,line});else warn('invalid-lottery-period');}}
 if(periodMatches.length){const first=periodMatches[0];if(periodMatches.some(p=>p.year!==first.year||p.startMonth!==first.startMonth))warn('multiple-lottery-periods');else{const {line,...value}=first;set('lotteryPeriod',value,.95,line);}}
 const derived=out.date?periodForDate(out.date):null;
 if(out.lotteryPeriod&&derived&&(derived.year!==out.lotteryPeriod.year||derived.startMonth!==out.lotteryPeriod.startMonth))warn('date-period-mismatch');
 if(!out.lotteryPeriod&&derived&&out.invoiceNumber)set('lotteryPeriod',derived,.75,'derived-from-date');
 for(const line of lines){
  const random=line.match(/(?:隨機碼|随机码|RANDOM\s*(?:NO|NUMBER)?)\s*[:：]?\s*(\d{4})(?!\d)/i);if(random)set('randomNumber',random[1],.9,line);
  const seller=line.match(/(?:賣方(?:統(?:一編)?號)?|卖方|店家統編|SELLER(?:\s*(?:ID|TAX\s*ID))?)\s*[:：]?\s*(\d{8})(?!\d)/i);
  const buyer=line.match(/(?:買方(?:統(?:一編)?號)?|买方|BUYER(?:\s*(?:ID|TAX\s*ID))?)\s*[:：]?\s*(\d{8})(?!\d)/i);
  if(seller)set('sellerTaxId',seller[1],.9,line);if(buyer&&buyer[1]!=='00000000')set('buyerTaxId',buyer[1],.9,line);
 }
 if(out.buyerTaxId)warn('buyer-tax-id-check-lottery-eligibility');
 const currencyTests=[['TWD',/(?:NT\s*\$|NTD\b|TWD\b|新[臺台]幣)/i],['KRW',/(?:KRW\b|₩|원)/i],['USD',/(?:USD\b|US\s*\$)/i],['JPY',/(?:JPY\b|円)/i],['EUR',/(?:EUR\b|€)/i],['CNY',/(?:CNY\b|RMB\b|人民币)/i]];
 const currencies=currencyTests.filter(([,re])=>re.test(text)).map(([code])=>code);
 if(currencies.length===1)set('currency',currencies[0],.97,currencies[0]);else if(currencies.length>1)warn('multiple-currencies');
 else if(out.invoiceNumber&&(/電子發票|統一發票|隨機碼|賣方|買方/.test(text)||periodMatches.length)){set('currency','TWD',.72,'taiwan-invoice-context');warn('currency-inferred-twd');}
 else if(options.defaultCurrency&&['TWD','KRW','USD','JPY','EUR','CNY'].includes(options.defaultCurrency)){set('currency',options.defaultCurrency,.45,'user-selected-context');warn('currency-needs-confirmation');}
 // Total labels are ranked, while tendered cash, change, tax and subtotal are excluded.
 const amountCandidates=[];
 const amountRE=/^\s*[:：=]?\s*(?:(?:NT\s*\$|TWD|NTD|USD|US\$|KRW|JPY|EUR|CNY|RMB|\$|₩|€|¥)\s*)?(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d,.])/i;
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  const re=/(?:總(?:金)?額|總計|合計|應付(?:金額)?|應收(?:金額)?|含稅(?:總)?(?:金額|合計)|GRAND\s+TOTAL|TOTAL\s*(?:AMOUNT|DUE)?|AMOUNT\s+DUE)/ig;
  for(const m of line.matchAll(re)){
   const before=line.slice(0,m.index),label=m[0];if(/(?:SUB\s*|小|稅[額金]?|税[額金]?|未稅|折扣|優惠|退稅|退款|點數|積分|數量|件數)\s*$/i.test(before)||/SUBTOTAL|小計|稅額合計|税额合计|退稅總額/.test(line))continue;
   if(/^[A-Z]/i.test(label)&&/[A-Z]$/i.test(before))continue;
   let tail=line.slice(m.index+label.length),match=tail.match(amountRE),evidence=line;
   if(!match&&!tail.trim()&&i+1<lines.length){match=lines[i+1].match(amountRE);evidence+='\n'+lines[i+1];}
   if(match){const source=evidence.includes('\n')?lines[i+1]:tail;if(/^\s*(?:件|項|筆|個|包|瓶|杯|點|分|PCS\b|ITEMS?\b|POINTS?\b)/i.test(source.slice(match[0].length)))continue;const value=parseMoney(match[1]);if(value!==null){const score=/應付|應收|GRAND|DUE|總計|總額|總金額/i.test(label)?3:2;amountCandidates.push({value,score,line:evidence});}}
  }
 }
 amountCandidates.sort((a,b)=>b.score-a.score);
 if(amountCandidates.length){const best=amountCandidates.filter(c=>c.score===amountCandidates[0].score),uniq=[...new Set(best.map(c=>c.value))];if(uniq.length>1)warn('multiple-totals');else if(uniq[0]<=0)warn('zero-or-refund-total');else set('total',uniq[0],.94,best[0].line);}
 if(!out.total)warn('total-not-confident');
 // A labeled merchant is stronger than a likely top-of-receipt header. Never geocode.
 for(const line of lines){const m=line.match(/^(?:商店名稱|商家名稱|店名|賣方名稱|MERCHANT|STORE)\s*[:：]\s*(.{2,80})$/i);if(m){set('merchant',m[1],.88,line);break;}}
 if(!out.merchant){const header=lines.slice(0,8).find(line=>{
  if(line.length<2||line.length>80||!/[A-Za-z\u3400-\u9fff]/.test(line))return false;
  if(/電子發票|統一發票|發票證明|收執聯|交易明細|消費明細|購物明細|收據|RECEIPT|INVOICE|COPY|WELCOME|THANK|謝謝|歡迎|[縣市].*[路街段巷]|地址|電話|TEL|FAX|統編|統一編號|賣方|買方|隨機|日期|時間|DATE|TIME|總計|合計|總額|TOTAL|小計|SUBTOTAL|TWD|NT\$|AMOUNT|現金|找零|找回|應付|應收|CASH|CHANGE|稅額|稅金|TAX/i.test(line))return false;
  if(/\d{2,4}\s*[-\/年.]\s*\d{1,2}|\b[A-Z]{2}[ -]?\d{8}\b|\d{7,}|^\d+\s*$/.test(line))return false;
  return true;
 });if(header){set('merchant',header,.5,header);warn('merchant-is-header-suggestion');}}
 if(!out.date)warn('date-not-found');if(!out.merchant)warn('merchant-not-found');if(!out.currency)warn('currency-not-found');
 if(out.currency&&out.currency!=='TWD')warn('non-twd-currency');
 if(/作廢|VOID|取消交易/i.test(text))warn('void-invoice');
 if(/VAT\s*REFUND|退稅|退税/i.test(text))warn('tax-refund-check-lottery-eligibility');
 out.fingerprint=receiptFingerprint(out);return out;
}
function receiptFingerprint(record){
 const invoice=normalize(record.invoiceNumber).toUpperCase().replace(/[ -]/g,''),p=record.lotteryPeriod||periodForDate(record.date),amount=Number(record.total);
 if(/^[A-Z]{2}\d{8}$/.test(invoice)&&p&&Number.isInteger(p.year)&&Number.isInteger(p.startMonth))return {key:`invoice:${p.year}-${pad(p.startMonth)}:${invoice}`,strength:'strong'};
 const merchant=normalize(record.merchant).toLowerCase().replace(/[\s.,，。·]/g,'');
 if(record.date&&merchant&&Number.isFinite(amount)&&amount>0)return {key:`fields:${record.date}|${merchant}|${record.currency||'?'}|${amount.toFixed(2)}`,strength:'weak'};
 return {key:null,strength:'none'};
}
// Pin assets to this app's own origin. No CDN fallback and no network OCR endpoint.
const ASSET_VERSION='tesseract-6.0.1',ASSET_DIR='receipt-assets/';
const ASSET_FILES=['tesseract.min.js','worker.min.js','core/tesseract-core.wasm.js','core/tesseract-core-simd.wasm.js','core/tesseract-core-lstm.wasm.js','core/tesseract-core-simd-lstm.wasm.js','lang/eng.traineddata.gz','lang/chi_tra.traineddata.gz'];
const ASSET_HASHES={"tesseract.min.js":"10fff78484067759c43028a02a72d76d0b90eb17302bb23b58a9ec5410bc928b","worker.min.js":"38645599043239c0eb6db08a6504a92dcdc292200535f3e9339cd77c4443b842","core/tesseract-core.wasm.js":"e66872f6a76f5ad414d73d21512245df0de3060ad4871a97c47efceaab27b955","core/tesseract-core-simd.wasm.js":"3b0678c47a8dea6abb931b214171c08b742a5b9a9fcbbb1a028a08d5de6e9d4c","core/tesseract-core-lstm.wasm.js":"775a35df6f2ae100e02609443e6bd5cafcd07983dd6175454ca4a432a7730687","core/tesseract-core-simd-lstm.wasm.js":"9d7c43fb206dc9f48475228b46bf35f888fa9e6259da2e67d5a75c77049f2dc7","lang/chi_tra.traineddata.gz":"11fe2610dab05d8a880d02f193ce70203f4c4bbe061b987d5529a2c038a22743","lang/eng.traineddata.gz":"45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91"};
const scriptBase=typeof document!=='undefined'&&document.currentScript?.src?new URL('./',document.currentScript.src).href:null;
let worker=null,workerPromise=null,scriptPromise=null,activeProgress=null,busy=false,generation=0;
function assetBase(){if(!root.location)throw Error('OCR requires a browser.');const url=new URL(ASSET_DIR,scriptBase||root.location.href);if(url.origin!==root.location.origin)throw Error('OCR assets must be on the same origin.');return url;}
function getOCRAssets(){const base=assetBase();return ASSET_FILES.map(p=>new URL(p,base).href);}
function getOCRCacheName(){return `taipei-receipt-ocr:${assetBase().pathname}:${ASSET_VERSION}`;}
async function getOCRStatus(){if(!root.caches)return {ready:false,assets:0,expected:ASSET_FILES.length,bytes:22193983};const cache=await root.caches.open(getOCRCacheName()),hits=await Promise.all(getOCRAssets().map(url=>cache.match(url)));return {ready:hits.every((r,i)=>r&&r.headers.get('X-Receipt-Asset-SHA256')===ASSET_HASHES[ASSET_FILES[i]]),assets:hits.filter((r,i)=>r&&r.headers.get('X-Receipt-Asset-SHA256')===ASSET_HASHES[ASSET_FILES[i]]).length,expected:ASSET_FILES.length,bytes:22193983};}
async function cacheOCRAssets(options={}){
 if(!root.caches)throw Error('Local OCR preparation needs a secure browser with offline storage.');
 const cache=await root.caches.open(getOCRCacheName()),urls=getOCRAssets();
 for(let i=0;i<urls.length;i++){
  if(options.signal?.aborted)throw abortError();
  const expected=ASSET_HASHES[ASSET_FILES[i]],cached=await cache.match(urls[i]);
  if(!cached||cached.headers.get('X-Receipt-Asset-SHA256')!==expected){
   const response=await root.fetch(urls[i],{signal:options.signal,credentials:'same-origin',cache:'no-cache'});if(!response.ok||response.type==='opaque')throw Error('OCR model download failed. Connect and try again, or enter the receipt manually.');
   const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
   if(hash!==expected)throw Error('OCR file verification failed. Please reconnect and prepare OCR again.');
   const headers=new Headers(response.headers);headers.set('X-Receipt-Asset-SHA256',expected);headers.delete('content-encoding');headers.delete('content-length');await cache.put(urls[i],new Response(bytes,{status:200,headers}));
  }
  options.onProgress?.({status:'preparing offline OCR',progress:(i+1)/urls.length});
 }
 return getOCRStatus();
}
function abortError(){const error=new Error('OCR cancelled');error.name='AbortError';return error;}
function notify(message){try{activeProgress?.(message);}catch(_){/* UI callback must not break OCR */}}
function loadScript(){if(root.Tesseract)return Promise.resolve();if(scriptPromise)return scriptPromise;scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('tesseract.min.js',assetBase()).href;s.async=true;s.onload=()=>root.Tesseract?resolve():reject(Error('OCR library unavailable'));s.onerror=()=>reject(Error('OCR files are unavailable. Connect once to prepare local OCR, or enter the receipt manually.'));document.head.append(s);}).catch(error=>{scriptPromise=null;throw error;});return scriptPromise;}
async function prepareOCR(options={}){
 if(options.signal?.aborted)throw abortError();activeProgress=options.onProgress||activeProgress;
 if(worker)return worker;if(workerPromise)return workerPromise;
 const token=generation;
 workerPromise=(async()=>{await cacheOCRAssets(options);await loadScript();if(token!==generation||options.signal?.aborted)throw abortError();const base=assetBase();
  let rejectInit;const initError=new Promise((_,reject)=>{rejectInit=reject;});
  const next=await Promise.race([root.Tesseract.createWorker(['chi_tra','eng'],1,{workerPath:new URL('worker.min.js',base).href,corePath:new URL('core/',base).href,langPath:new URL('lang/',base).href.replace(/\/$/,''),workerBlobURL:false,gzip:true,cacheMethod:'write',cachePath:ASSET_VERSION,logger:notify,errorHandler:error=>rejectInit(Error(String(error)))}),initError]);
  if(token!==generation||options.signal?.aborted){await next.terminate();throw abortError();}
  await next.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'3'});worker=next;return worker;
 })().finally(()=>{workerPromise=null;});return workerPromise;
}
async function terminateOCR(){generation++;const previous=worker;worker=null;if(previous)await previous.terminate();}
async function analyzeReceipt(file,options={}){
 if(busy)throw Error('Another receipt is being read. Please wait or cancel it first.');
 if(!file||typeof file.arrayBuffer!=='function'||typeof file.size!=='number')throw Error('Choose an image file.');
 if(file.size>MAX_IMAGE_BYTES||file.size===0)throw Error('Choose an image smaller than 20 MB.');
 if(!/^image\/(?:jpeg|png|webp|bmp)$/.test(file.type))throw Error('Use a JPEG, PNG or WebP image. HEIC and PDF need conversion first.');
 if(options.signal?.aborted)throw abortError();busy=true;activeProgress=options.onProgress||null;
 let rejectAbort;const abortPromise=new Promise((_,reject)=>{rejectAbort=reject;});
 const abort=()=>{terminateOCR().catch(()=>{});rejectAbort(abortError());};options.signal?.addEventListener('abort',abort,{once:true});
 try{const work=(async()=>{const local=await prepareOCR(options);if(options.signal?.aborted)throw abortError();const result=await local.recognize(file,{}, {text:true});if(options.signal?.aborted)throw abortError();const parsed=parseReceipt(result.data.text,options);parsed.ocrConfidence=Number.isFinite(result.data.confidence)?result.data.confidence:null;if(parsed.ocrConfidence!==null&&parsed.ocrConfidence<65)parsed.warnings.unshift('low-ocr-confidence');return parsed;})();return await Promise.race([work,abortPromise]);}
 finally{options.signal?.removeEventListener('abort',abort);activeProgress=null;busy=false;}
}
return {VERSION,MAX_IMAGE_BYTES,normalize,validDate,periodForDate,parseMoney,parseReceipt,receiptFingerprint,getOCRAssets,getOCRCacheName,getOCRStatus,cacheOCRAssets,prepareOCR,terminateOCR,analyzeReceipt};
});
