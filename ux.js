'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TaipeiUX=factory();})(typeof window!=='undefined'?window:globalThis,function(){
const KNOWN=new Set('icn,tpe,tms,hotel,ximen,shinyeh,cityhall,t101,dtf,kav,plaza,sysh,xlb,yonghe,tamsui,dark,fort,oxford,white,mackay,agei,beitou,spring,mala,redhouse,momentum,guilin,cksst,ding,cks,regent,comeme,dongmen,jiavin,laihao,shangshin,smoothie,jiapin,taihe,wang,longshan,bopiliao,spa,a1,bonita,inpar,hongrou,beimen,dihua,wharf,louis,zhenwei,real58,mjk,lounge,gh,sunny,kitchen12,nanxi,huashan,food101,s44,fuyou,xiahai,leecake,chifeng'.split(','));
const str=x=>String(x??'');
const BAD=/한국|대한민국|서울|인천|Korea|Seoul|Incheon|仁川|首爾/i;
const CITY=/Taiwan|台灣|臺灣|台北|臺北|新北|桃園/i;
const ROAD=/路|街|大道|巷|弄|號|No\.?\s*\d/i;
function isIndoorTransfer(item){return !!item&&(item.from==='lounge'||item.to==='lounge'||item.place==='lounge'||/공항\s*(내|내부)|라운지|lounge|airside|出境管制區/i.test(str(item.title)));}
function resolveDriver(id,p,item=null){
 const no=reason=>({eligible:false,reason});if(!p||id==='icn'||id==='lounge')return no('restricted_place');
 const addr=str(p.addr).trim(),description=str(p.n)+' '+str(p.zh)+' '+addr;
 if(BAD.test(description))return no('not_taiwan');
 if(item){if(item.isFlight===true||item.tz===9)return no('flight_or_korea');if(isIndoorTransfer(item))return no('indoor');
  if(item.k==='m'&&(item.travel||item.mode)!=='driving')return no('not_driving');
  if(item.k!=='m'&&/입국|수하물|보안|탑승|출국\s*수속|체크인\s*[·/]\s*수하물|기상|휴식|쉬기|쉬는|낮잠|수면|취침|짐\s*(정리|싸기|회수|찾기)|체크아웃|캐리어|선물.*두기|짐.*맡기|체크인.*잠|준비/i.test(str(item.title)))return no('activity_not_destination');}
 if(!addr)return no('missing_address');
 if(!KNOWN.has(id)&&p.verifiedTaiwan!==true)return no('unverified_place');
 if(!(CITY.test(addr)&&ROAD.test(addr)))return no('unverified_address');
 return {eligible:true,reason:'taiwan_destination'};
}
const PHRASES=[
 ['bill','restaurant','계산서 주세요','Could I have the bill, please?'],
 ['card','restaurant','카드로 결제할 수 있나요?','Can I pay by card?'],
 ['takeaway','restaurant','남은 음식을 포장해 주실 수 있나요?','Could you pack the leftovers to go, please?'],
 ['water','restaurant','물 좀 주시겠어요?','Could I have some water, please?'],
 ['menu','restaurant','영어 메뉴가 있나요?','Do you have an English menu?'],
 ['recommend','restaurant','추천해 주실 음식이 있나요?','What would you recommend?'],
 ['ingredient','restaurant','이 음식에는 어떤 재료가 들어가나요?','What ingredients are in this dish?'],
 ['allergen','restaurant','이 음식에 땅콩이 들어가나요?','Does this dish contain peanuts?'],
 ['spicy','restaurant','덜 맵게 해주세요','Could you make it less spicy, please?'],
 ['receipt','restaurant','영수증 주세요','Could I have a receipt, please?'],
 ['towels','hotel','수건을 더 받을 수 있을까요?','Could I have some extra towels, please?'],
 ['hotel-water','hotel','생수를 더 받을 수 있을까요?','Could I have some more bottled water, please?'],
 ['luggage','hotel','짐을 맡길 수 있을까요?','Could you store my luggage, please?'],
 ['checkin','hotel','체크인하고 싶어요','I would like to check in, please.'],
 ['checkout','hotel','체크아웃하고 싶어요','I would like to check out, please.'],
 ['clean','hotel','방 청소를 부탁드려요','Could you clean my room, please?'],
 ['wifi','hotel','와이파이 비밀번호가 무엇인가요?','What is the Wi-Fi password?'],
 ['wifi-broken','hotel','와이파이가 작동하지 않아요','The Wi-Fi is not working.'],
 ['ac','hotel','에어컨이 작동하지 않아요','The air conditioner is not working.'],
 ['checkout-time','hotel','체크아웃은 몇 시인가요?','What time is check-out?'],
 ['bag','shopping','봉투를 받을 수 있을까요?','Could I have a bag, please?'],
 ['price','shopping','이것은 얼마인가요?','How much is this?'],
 ['color','shopping','다른 색상도 있나요?','Do you have this in another color?'],
 ['size','shopping','다른 사이즈도 있나요?','Do you have this in another size?'],
 ['address','move','이 주소로 가 주세요','Please take me to this address.'],
 ['dropoff','move','여기서 내려 주세요','Please drop me off here.'],
 ['duration','move','얼마나 걸리나요?','How long will it take?'],
 ['restroom','move','화장실이 어디인가요?','Where is the restroom?'],
 ['slow','move','조금 천천히 말씀해 주세요','Could you speak a little more slowly, please?'],
 ['help','move','도와주실 수 있나요?','Could you help me, please?']
].map(([id,category,ko,en])=>({id,category,ko,en}));
function searchPhrases(query,category='all'){const q=str(query).trim().toLowerCase();return PHRASES.filter(x=>(category==='all'||x.category===category)&&(x.ko+' '+x.en).toLowerCase().includes(q));}
return {resolveDriver,isIndoorTransfer,PHRASES,searchPhrases};
});
