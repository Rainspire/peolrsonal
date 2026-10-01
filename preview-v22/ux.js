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
// One bilingual catalog: category, subgroup, phrase ID, and order never depend on language.
const CONVERSATION_GROUPS={
  "hotel": [
    "숙소에서",
    "체크인 · 객실 요청 · 짐 보관"
  ],
  "restaurant": [
    "식당에서",
    "입장 · 주문 · 요청 · 계산"
  ],
  "airport": [
    "공항에서",
    "체크인 · 탑승구 · 수하물"
  ],
  "transport": [
    "택시·MRT에서",
    "목적지 · 승차 · 이동"
  ],
  "shopping": [
    "쇼핑할 때",
    "가격 · 사이즈 · 결제"
  ],
  "sightseeing": [
    "관광할 때",
    "입장권 · 사진 · 길 찾기"
  ],
  "help": [
    "도움이 필요할 때",
    "천천히 말하기 · 설명 · 도움"
  ]
};
const TRAVEL_PHRASES=[
  {
    "id": "hotel-checkin",
    "category": "hotel",
    "subgroup": "체크인·체크아웃",
    "ko": "체크인하고 싶어요",
    "zh": "我想辦理入住。",
    "pinyin": "Wǒ xiǎng bànlǐ rùzhù.",
    "pronunciationKo": "워 샹 빤리 루쭈",
    "en": "I'd like to check in, please.",
    "legacyIds": [
      "checkin"
    ],
    "searchAliases": [
      "I would like to check in, please."
    ]
  },
  {
    "id": "hotel-checkout",
    "category": "hotel",
    "subgroup": "체크인·체크아웃",
    "ko": "체크아웃하고 싶어요",
    "zh": "我想辦理退房。",
    "pinyin": "Wǒ xiǎng bànlǐ tuìfáng.",
    "pronunciationKo": "워 샹 빤리 퉤이팡",
    "en": "I'd like to check out, please.",
    "legacyIds": [
      "checkout"
    ],
    "searchAliases": [
      "I would like to check out, please."
    ]
  },
  {
    "id": "hotel-checkout-time",
    "category": "hotel",
    "subgroup": "체크인·체크아웃",
    "ko": "체크아웃은 몇 시인가요?",
    "en": "What time is check-out?",
    "zh": "請問退房時間是幾點？",
    "pinyin": "Qǐngwèn tuìfáng shíjiān shì jǐ diǎn?",
    "pronunciationKo": "칭원 퉤이팡 스지엔 스 지 디엔",
    "legacyIds": [
      "checkout-time"
    ]
  },
  {
    "id": "hotel-towels",
    "category": "hotel",
    "subgroup": "객실 요청",
    "ko": "수건을 더 주세요",
    "zh": "請再給我幾條毛巾。",
    "pinyin": "Qǐng zài gěi wǒ jǐ tiáo máojīn.",
    "pronunciationKo": "칭 짜이 게이 워 지 탸오 마오진",
    "en": "Could I have some extra towels, please?",
    "legacyIds": [
      "towels"
    ],
    "searchAliases": [
      "수건을 더 받을 수 있을까요?"
    ]
  },
  {
    "id": "hotel-wifi",
    "category": "hotel",
    "subgroup": "객실 요청",
    "ko": "와이파이 비밀번호가 무엇인가요?",
    "zh": "Wi-Fi 密碼是什麼？",
    "pinyin": "Wi-Fi mìmǎ shì shénme?",
    "pronunciationKo": "와이파이 미마 스 션머",
    "en": "What is the Wi-Fi password?",
    "legacyIds": [
      "wifi"
    ]
  },
  {
    "id": "hotel-clean",
    "category": "hotel",
    "subgroup": "객실 요청",
    "ko": "방 청소를 부탁드려요",
    "zh": "請幫我打掃房間。",
    "pinyin": "Qǐng bāng wǒ dǎsǎo fángjiān.",
    "pronunciationKo": "칭 빵 워 다싸오 팡지엔",
    "en": "Could you clean my room, please?",
    "legacyIds": [
      "clean"
    ]
  },
  {
    "id": "hotel-water",
    "category": "hotel",
    "subgroup": "객실 요청",
    "ko": "생수를 더 받을 수 있을까요?",
    "en": "Could I have some more bottled water, please?",
    "zh": "可以再給我幾瓶水嗎？",
    "pinyin": "Kěyǐ zài gěi wǒ jǐ píng shuǐ ma?",
    "pronunciationKo": "커이 짜이 게이 워 지 핑 쉐이 마",
    "legacyIds": [
      "hotel-water"
    ]
  },
  {
    "id": "hotel-wifi-broken",
    "category": "hotel",
    "subgroup": "객실 요청",
    "ko": "와이파이가 작동하지 않아요",
    "en": "The Wi-Fi is not working.",
    "zh": "Wi-Fi 不能用。",
    "pinyin": "Wi-Fi bù néng yòng.",
    "pronunciationKo": "와이파이 부 넝 용",
    "legacyIds": [
      "wifi-broken"
    ]
  },
  {
    "id": "hotel-ac",
    "category": "hotel",
    "subgroup": "객실 요청",
    "ko": "에어컨이 작동하지 않아요",
    "en": "The air conditioner is not working.",
    "zh": "冷氣不能用。",
    "pinyin": "Lěngqì bù néng yòng.",
    "pronunciationKo": "렁치 부 넝 용",
    "legacyIds": [
      "ac"
    ]
  },
  {
    "id": "hotel-luggage",
    "category": "hotel",
    "subgroup": "짐 보관",
    "ko": "짐을 맡아 주세요",
    "zh": "請幫我寄放行李。",
    "pinyin": "Qǐng bāng wǒ jìfàng xínglǐ.",
    "pronunciationKo": "칭 빵 워 지팡 싱리",
    "en": "Could you store my luggage, please?",
    "legacyIds": [
      "luggage"
    ],
    "searchAliases": [
      "짐을 맡길 수 있을까요?"
    ]
  },
  {
    "id": "restaurant-one",
    "category": "restaurant",
    "subgroup": "입장·주문",
    "ko": "한 명이에요",
    "zh": "一位，謝謝。",
    "pinyin": "Yí wèi, xièxiè.",
    "pronunciationKo": "이 웨이, 씨에씨에",
    "en": "A table for one, please."
  },
  {
    "id": "restaurant-water",
    "category": "restaurant",
    "subgroup": "입장·주문",
    "ko": "물 좀 주세요",
    "zh": "請給我一杯水。",
    "pinyin": "Qǐng gěi wǒ yì bēi shuǐ.",
    "pronunciationKo": "칭 게이 워 이 뻬이 쉐이",
    "en": "Could I have a glass of water, please?",
    "legacyIds": [
      "water"
    ],
    "searchAliases": [
      "물 좀 주시겠어요?",
      "Could I have some water, please?"
    ]
  },
  {
    "id": "restaurant-menu",
    "category": "restaurant",
    "subgroup": "입장·주문",
    "ko": "영어 메뉴가 있나요?",
    "en": "Do you have an English menu?",
    "zh": "有英文菜單嗎？",
    "pinyin": "Yǒu Yīngwén càidān ma?",
    "pronunciationKo": "요우 잉원 차이딴 마",
    "legacyIds": [
      "menu"
    ]
  },
  {
    "id": "restaurant-recommend",
    "category": "restaurant",
    "subgroup": "입장·주문",
    "ko": "추천해 주실 음식이 있나요?",
    "en": "What would you recommend?",
    "zh": "有什麼推薦的菜嗎？",
    "pinyin": "Yǒu shénme tuījiàn de cài ma?",
    "pronunciationKo": "요우 션머 퉤이지엔 더 차이 마",
    "legacyIds": [
      "recommend"
    ]
  },
  {
    "id": "restaurant-cilantro",
    "category": "restaurant",
    "subgroup": "음식 요청",
    "ko": "고수 빼 주세요",
    "zh": "請不要加香菜。",
    "pinyin": "Qǐng bú yào jiā xiāngcài.",
    "pronunciationKo": "칭 부 야오 지아 샹차이",
    "en": "No cilantro, please."
  },
  {
    "id": "restaurant-not-spicy",
    "category": "restaurant",
    "subgroup": "음식 요청",
    "ko": "맵지 않게 해 주세요",
    "zh": "請不要加辣。",
    "pinyin": "Qǐng bú yào jiā là.",
    "pronunciationKo": "칭 부 야오 지아 라",
    "en": "Please make it not spicy."
  },
  {
    "id": "restaurant-mild",
    "category": "restaurant",
    "subgroup": "음식 요청",
    "ko": "조금 맵게 해 주세요",
    "zh": "小辣，謝謝。",
    "pinyin": "Xiǎo là, xièxiè.",
    "pronunciationKo": "샤오 라, 씨에씨에",
    "en": "Mildly spicy, please."
  },
  {
    "id": "restaurant-takeaway",
    "category": "restaurant",
    "subgroup": "음식 요청",
    "ko": "남은 음식을 포장해 주실 수 있나요?",
    "en": "Could you pack the leftovers to go, please?",
    "zh": "可以幫我把剩下的食物打包嗎？",
    "pinyin": "Kěyǐ bāng wǒ bǎ shèngxià de shíwù dǎbāo ma?",
    "pronunciationKo": "커이 빵 워 바 셩샤 더 스우 다빠오 마",
    "legacyIds": [
      "takeaway"
    ]
  },
  {
    "id": "restaurant-ingredient",
    "category": "restaurant",
    "subgroup": "음식 요청",
    "ko": "이 음식에는 어떤 재료가 들어가나요?",
    "en": "What ingredients are in this dish?",
    "zh": "這道菜裡面有什麼食材？",
    "pinyin": "Zhè dào cài lǐmiàn yǒu shénme shícái?",
    "pronunciationKo": "쩌 따오 차이 리미엔 요우 션머 스차이",
    "legacyIds": [
      "ingredient"
    ]
  },
  {
    "id": "restaurant-allergen",
    "category": "restaurant",
    "subgroup": "음식 요청",
    "ko": "이 음식에 땅콩이 들어가나요?",
    "en": "Does this dish contain peanuts?",
    "zh": "這道菜裡有花生嗎？",
    "pinyin": "Zhè dào cài lǐ yǒu huāshēng ma?",
    "pronunciationKo": "쩌 따오 차이 리 요우 화셩 마",
    "legacyIds": [
      "allergen"
    ]
  },
  {
    "id": "restaurant-less-spicy",
    "category": "restaurant",
    "subgroup": "음식 요청",
    "ko": "덜 맵게 해 주세요",
    "en": "Could you make it less spicy, please?",
    "zh": "可以做得不那麼辣嗎？",
    "pinyin": "Kěyǐ zuò de bú nàme là ma?",
    "pronunciationKo": "커이 쭈어 더 부 나머 라 마",
    "legacyIds": [
      "spicy"
    ],
    "searchAliases": [
      "덜 맵게 해주세요"
    ]
  },
  {
    "id": "restaurant-card",
    "category": "restaurant",
    "subgroup": "계산·결제",
    "ko": "카드로 결제할 수 있나요?",
    "zh": "可以刷卡嗎？",
    "pinyin": "Kěyǐ shuākǎ ma?",
    "pronunciationKo": "커이 슈아카 마",
    "en": "Can I pay by card?",
    "legacyIds": [
      "card"
    ]
  },
  {
    "id": "restaurant-bill",
    "category": "restaurant",
    "subgroup": "계산·결제",
    "ko": "계산하겠습니다",
    "zh": "我要結帳，謝謝。",
    "pinyin": "Wǒ yào jiézhàng, xièxiè.",
    "pronunciationKo": "워 야오 지에짱, 씨에씨에",
    "en": "I'd like to pay, please."
  },
  {
    "id": "restaurant-bill-request",
    "category": "restaurant",
    "subgroup": "계산·결제",
    "ko": "계산서 주세요",
    "en": "Could I have the bill, please?",
    "zh": "請給我帳單。",
    "pinyin": "Qǐng gěi wǒ zhàngdān.",
    "pronunciationKo": "칭 게이 워 짱딴",
    "legacyIds": [
      "bill"
    ]
  },
  {
    "id": "restaurant-receipt",
    "category": "restaurant",
    "subgroup": "계산·결제",
    "ko": "영수증 주세요",
    "en": "Could I have a receipt, please?",
    "zh": "請給我收據。",
    "pinyin": "Qǐng gěi wǒ shōujù.",
    "pronunciationKo": "칭 게이 워 쇼우쥐",
    "legacyIds": [
      "receipt"
    ]
  },
  {
    "id": "airport-counter",
    "category": "airport",
    "subgroup": "체크인·탑승",
    "ko": "체크인 카운터가 어디인가요?",
    "zh": "請問報到櫃檯在哪裡？",
    "pinyin": "Qǐngwèn bàodào guìtái zài nǎlǐ?",
    "pronunciationKo": "칭원 빠오따오 궤이타이 짜이 나리",
    "en": "Where is the check-in counter, please?"
  },
  {
    "id": "airport-gate",
    "category": "airport",
    "subgroup": "체크인·탑승",
    "ko": "탑승구가 어디인가요?",
    "zh": "請問登機門在哪裡？",
    "pinyin": "Qǐngwèn dēngjīmén zài nǎlǐ?",
    "pronunciationKo": "칭원 떵지먼 짜이 나리",
    "en": "Where is the boarding gate, please?"
  },
  {
    "id": "airport-baggage",
    "category": "airport",
    "subgroup": "도착·수하물",
    "ko": "수하물 찾는 곳이 어디인가요?",
    "zh": "請問行李提領處在哪裡？",
    "pinyin": "Qǐngwèn xínglǐ tílǐngchù zài nǎlǐ?",
    "pronunciationKo": "칭원 싱리 티링추 짜이 나리",
    "en": "Where is baggage claim, please?"
  },
  {
    "id": "airport-help",
    "category": "airport",
    "subgroup": "안내 요청",
    "ko": "도와주실 수 있나요?",
    "zh": "可以幫我一下嗎？",
    "pinyin": "Kěyǐ bāng wǒ yíxià ma?",
    "pronunciationKo": "커이 빵 워 이샤 마",
    "en": "Could you help me, please?"
  },
  {
    "id": "airport-restroom",
    "category": "airport",
    "subgroup": "안내 요청",
    "ko": "화장실이 어디인가요?",
    "zh": "請問洗手間在哪裡？",
    "pinyin": "Qǐngwèn xǐshǒujiān zài nǎlǐ?",
    "pronunciationKo": "칭원 시쇼우지엔 짜이 나리",
    "en": "Where is the restroom, please?"
  },
  {
    "id": "airport-slow",
    "category": "airport",
    "subgroup": "안내 요청",
    "ko": "조금 천천히 말씀해 주세요",
    "zh": "請說慢一點。",
    "pinyin": "Qǐng shuō màn yìdiǎn.",
    "pronunciationKo": "칭 슈어 만 이디엔",
    "en": "Please speak a little more slowly."
  },
  {
    "id": "transport-taxi",
    "category": "transport",
    "subgroup": "택시",
    "ko": "여기로 가 주세요",
    "zh": "請載我到這裡。",
    "pinyin": "Qǐng zài wǒ dào zhèlǐ.",
    "pronunciationKo": "칭 짜이 워 따오 쩌리",
    "en": "Please take me here."
  },
  {
    "id": "transport-stop",
    "category": "transport",
    "subgroup": "택시",
    "ko": "여기서 내려 주세요",
    "zh": "請讓我在這裡下車。",
    "pinyin": "Qǐng ràng wǒ zài zhèlǐ xiàchē.",
    "pronunciationKo": "칭 랑 워 짜이 쩌리 샤처",
    "en": "Please drop me off here.",
    "legacyIds": [
      "dropoff"
    ]
  },
  {
    "id": "transport-duration",
    "category": "transport",
    "subgroup": "택시",
    "ko": "얼마나 걸리나요?",
    "zh": "大概需要多久？",
    "pinyin": "Dàgài xūyào duōjiǔ?",
    "pronunciationKo": "따가이 쉬야오 뚜어지우",
    "en": "About how long will it take?",
    "legacyIds": [
      "duration"
    ],
    "searchAliases": [
      "How long will it take?"
    ]
  },
  {
    "id": "transport-address",
    "category": "transport",
    "subgroup": "택시",
    "ko": "이 주소로 가 주세요",
    "zh": "請載我到這個地址。",
    "pinyin": "Qǐng zài wǒ dào zhège dìzhǐ.",
    "pronunciationKo": "칭 짜이 워 따오 쩌거 띠즈",
    "en": "Please take me to this address.",
    "legacyIds": [
      "address"
    ]
  },
  {
    "id": "transport-mrt",
    "category": "transport",
    "subgroup": "지하철·승차권",
    "ko": "지하철역이 어디인가요?",
    "zh": "請問捷運站在哪裡？",
    "pinyin": "Qǐngwèn jiéyùnzhàn zài nǎlǐ?",
    "pronunciationKo": "칭원 지에윈짠 짜이 나리",
    "en": "Where is the MRT station, please?"
  },
  {
    "id": "transport-ticket",
    "category": "transport",
    "subgroup": "지하철·승차권",
    "ko": "표는 어디서 사나요?",
    "zh": "請問在哪裡買票？",
    "pinyin": "Qǐngwèn zài nǎlǐ mǎi piào?",
    "pronunciationKo": "칭원 짜이 나리 마이 퍄오",
    "en": "Where can I buy a ticket, please?"
  },
  {
    "id": "transport-restroom",
    "category": "transport",
    "subgroup": "길·위치",
    "ko": "화장실이 어디인가요?",
    "zh": "請問洗手間在哪裡？",
    "pinyin": "Qǐngwèn xǐshǒujiān zài nǎlǐ?",
    "pronunciationKo": "칭원 시쇼우지엔 짜이 나리",
    "en": "Where is the restroom, please?",
    "legacyIds": [
      "restroom"
    ],
    "searchAliases": [
      "Where is the restroom?"
    ]
  },
  {
    "id": "shopping-price",
    "category": "shopping",
    "subgroup": "상품 문의",
    "ko": "이것은 얼마인가요?",
    "zh": "這個多少錢？",
    "pinyin": "Zhège duōshǎo qián?",
    "pronunciationKo": "쩌거 뚜어샤오 치엔",
    "en": "How much is this?",
    "legacyIds": [
      "price"
    ]
  },
  {
    "id": "shopping-color",
    "category": "shopping",
    "subgroup": "상품 문의",
    "ko": "다른 색상도 있나요?",
    "zh": "有其他顏色嗎？",
    "pinyin": "Yǒu qítā yánsè ma?",
    "pronunciationKo": "요우 치타 옌써 마",
    "en": "Do you have this in another color?",
    "legacyIds": [
      "color"
    ]
  },
  {
    "id": "shopping-size",
    "category": "shopping",
    "subgroup": "상품 문의",
    "ko": "다른 사이즈도 있나요?",
    "zh": "有其他尺寸嗎？",
    "pinyin": "Yǒu qítā chǐcùn ma?",
    "pronunciationKo": "요우 치타 츠춘 마",
    "en": "Do you have this in another size?",
    "legacyIds": [
      "size"
    ]
  },
  {
    "id": "shopping-bag",
    "category": "shopping",
    "subgroup": "결제·포장",
    "ko": "봉투를 받을 수 있나요?",
    "zh": "可以給我一個袋子嗎？",
    "pinyin": "Kěyǐ gěi wǒ yí ge dàizi ma?",
    "pronunciationKo": "커이 게이 워 이 거 따이쯔 마",
    "en": "Could I have a bag, please?",
    "legacyIds": [
      "bag"
    ],
    "searchAliases": [
      "봉투를 받을 수 있을까요?"
    ]
  },
  {
    "id": "shopping-receipt",
    "category": "shopping",
    "subgroup": "결제·포장",
    "ko": "영수증을 주세요",
    "zh": "請給我收據。",
    "pinyin": "Qǐng gěi wǒ shōujù.",
    "pronunciationKo": "칭 게이 워 쇼우쥐",
    "en": "Could I have a receipt, please?"
  },
  {
    "id": "shopping-card",
    "category": "shopping",
    "subgroup": "결제·포장",
    "ko": "카드로 결제할 수 있나요?",
    "zh": "可以刷卡嗎？",
    "pinyin": "Kěyǐ shuākǎ ma?",
    "pronunciationKo": "커이 슈아카 마",
    "en": "Can I pay by card?"
  },
  {
    "id": "sightseeing-close",
    "category": "sightseeing",
    "subgroup": "관람·입장",
    "ko": "몇 시에 문을 닫나요?",
    "zh": "請問幾點關門？",
    "pinyin": "Qǐngwèn jǐ diǎn guānmén?",
    "pronunciationKo": "칭원 지 디엔 꾸안먼",
    "en": "What time do you close?"
  },
  {
    "id": "sightseeing-ticket",
    "category": "sightseeing",
    "subgroup": "관람·입장",
    "ko": "입장권은 얼마인가요?",
    "zh": "請問門票多少錢？",
    "pinyin": "Qǐngwèn ménpiào duōshǎo qián?",
    "pronunciationKo": "칭원 먼퍄오 뚜어샤오 치엔",
    "en": "How much is admission, please?"
  },
  {
    "id": "sightseeing-wait",
    "category": "sightseeing",
    "subgroup": "관람·입장",
    "ko": "잠시만 기다려 주세요",
    "zh": "請稍等一下。",
    "pinyin": "Qǐng shāo děng yíxià.",
    "pronunciationKo": "칭 샤오 떵 이샤",
    "en": "Please wait a moment."
  },
  {
    "id": "sightseeing-photo",
    "category": "sightseeing",
    "subgroup": "사진",
    "ko": "사진을 찍어 주실 수 있나요?",
    "zh": "可以幫我拍照嗎？",
    "pinyin": "Kěyǐ bāng wǒ pāizhào ma?",
    "pronunciationKo": "커이 빵 워 파이짜오 마",
    "en": "Could you take a photo of me, please?"
  },
  {
    "id": "sightseeing-where",
    "category": "sightseeing",
    "subgroup": "길·위치",
    "ko": "이곳이 어디인가요?",
    "zh": "請問這裡是哪裡？",
    "pinyin": "Qǐngwèn zhèlǐ shì nǎlǐ?",
    "pronunciationKo": "칭원 쩌리 스 나리",
    "en": "Where are we, please?"
  },
  {
    "id": "sightseeing-directions",
    "category": "sightseeing",
    "subgroup": "길·위치",
    "ko": "이곳에 어떻게 가나요?",
    "zh": "請問這個地方怎麼走？",
    "pinyin": "Qǐngwèn zhège dìfāng zěnme zǒu?",
    "pronunciationKo": "칭원 쩌거 띠팡 쩐머 쩌우",
    "en": "How do I get to this place, please?"
  },
  {
    "id": "help-understand",
    "category": "help",
    "subgroup": "말이 통하지 않을 때",
    "ko": "이해하지 못했어요",
    "zh": "我聽不懂。",
    "pinyin": "Wǒ tīng bù dǒng.",
    "pronunciationKo": "워 팅 부 동",
    "en": "I don't understand."
  },
  {
    "id": "help-repeat",
    "category": "help",
    "subgroup": "말이 통하지 않을 때",
    "ko": "다시 한번 말씀해 주세요",
    "zh": "請再說一次。",
    "pinyin": "Qǐng zài shuō yí cì.",
    "pronunciationKo": "칭 짜이 슈어 이 츠",
    "en": "Please say that again."
  },
  {
    "id": "help-english",
    "category": "help",
    "subgroup": "말이 통하지 않을 때",
    "ko": "영어를 하실 수 있나요?",
    "zh": "您會說英文嗎？",
    "pinyin": "Nín huì shuō Yīngwén ma?",
    "pronunciationKo": "닌 훼이 슈어 잉원 마",
    "en": "Do you speak English?"
  },
  {
    "id": "help-write",
    "category": "help",
    "subgroup": "말이 통하지 않을 때",
    "ko": "적어 주실 수 있나요?",
    "zh": "可以幫我寫下來嗎？",
    "pinyin": "Kěyǐ bāng wǒ xiě xiàlái ma?",
    "pronunciationKo": "커이 빵 워 시에 샤라이 마",
    "en": "Could you write it down, please?"
  },
  {
    "id": "help-slow",
    "category": "help",
    "subgroup": "말이 통하지 않을 때",
    "ko": "조금 천천히 말씀해 주세요",
    "zh": "請說慢一點。",
    "pinyin": "Qǐng shuō màn yìdiǎn.",
    "pronunciationKo": "칭 슈어 만 이디엔",
    "en": "Please speak a little more slowly.",
    "legacyIds": [
      "slow"
    ],
    "searchAliases": [
      "Could you speak a little more slowly, please?"
    ]
  },
  {
    "id": "help-problem",
    "category": "help",
    "subgroup": "도움·감사",
    "ko": "문제가 생겼어요. 도와주실 수 있나요?",
    "zh": "我遇到問題了，可以幫我嗎？",
    "pinyin": "Wǒ yùdào wèntí le, kěyǐ bāng wǒ ma?",
    "pronunciationKo": "워 위따오 원티 러, 커이 빵 워 마",
    "en": "I have a problem. Could you help me?"
  },
  {
    "id": "help-thanks",
    "category": "help",
    "subgroup": "도움·감사",
    "ko": "감사합니다",
    "zh": "謝謝。",
    "pinyin": "Xièxiè.",
    "pronunciationKo": "씨에씨에",
    "en": "Thank you."
  },
  {
    "id": "help-help",
    "category": "help",
    "subgroup": "도움·감사",
    "ko": "도와주실 수 있나요?",
    "zh": "可以幫我一下嗎？",
    "pinyin": "Kěyǐ bāng wǒ yíxià ma?",
    "pronunciationKo": "커이 빵 워 이샤 마",
    "en": "Could you help me, please?",
    "legacyIds": [
      "help"
    ]
  }
];
const TRAVEL_PHRASE_ALIASES={
  "請載我到這裡。": {
    "id": "transport-taxi",
    "category": "transport",
    "subgroup": "택시"
  },
  "一位，謝謝。": {
    "id": "restaurant-one",
    "category": "restaurant",
    "subgroup": "입장·주문"
  },
  "可以刷卡嗎？": {
    "id": "restaurant-card",
    "category": "restaurant",
    "subgroup": "계산·결제"
  },
  "不要辣。/小辣。": {
    "category": "restaurant",
    "subgroup": "음식 요청"
  },
  "不要辣。": {
    "id": "restaurant-not-spicy",
    "category": "restaurant",
    "subgroup": "음식 요청"
  },
  "小辣。": {
    "id": "restaurant-mild",
    "category": "restaurant",
    "subgroup": "음식 요청"
  },
  "請幫我寄放行李。": {
    "id": "hotel-luggage",
    "category": "hotel",
    "subgroup": "짐 보관"
  },
  "多少錢？": {
    "id": "shopping-price",
    "category": "shopping",
    "subgroup": "상품 문의"
  }
};
function phraseSubgroups(category){return [...new Set(TRAVEL_PHRASES.filter(x=>x.category===category).map(x=>x.subgroup))];}
function searchPhrases(query,category='all',subgroup=''){
 const q=str(query).trim().toLowerCase();
 return TRAVEL_PHRASES.filter(x=>(category==='all'||x.category===category)&&(!subgroup||x.subgroup===subgroup)&&[x.ko,x.zh,x.en,x.pinyin,x.pronunciationKo,...(x.searchAliases||[])].join(' ').toLowerCase().includes(q));
}
return {resolveDriver,isIndoorTransfer,CONVERSATION_GROUPS,TRAVEL_PHRASES,TRAVEL_PHRASE_ALIASES,PHRASES:TRAVEL_PHRASES,phraseSubgroups,searchPhrases};
});
// Keep classic-script consumers and existing guide integrations on the same catalog.
const TRAVEL_PHRASES=(typeof module==='object'&&module.exports?module.exports:(typeof window!=='undefined'?window:globalThis).TaipeiUX).TRAVEL_PHRASES;
const TRAVEL_PHRASE_ALIASES=(typeof module==='object'&&module.exports?module.exports:(typeof window!=='undefined'?window:globalThis).TaipeiUX).TRAVEL_PHRASE_ALIASES;
