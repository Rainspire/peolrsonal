/* Button explanations: 3-second hold, immediate accessible descriptions, no action on release. */
(function (host, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.TripButtonHelp = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const HOLD_MS = 3000;
  const MOVE_PX = 10;
  const SELECTOR = 'button,[role="button"]';
  const EXCLUDED = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-drag-id],.drag-handle,.grab,.leaflet-container,[data-hold-help-off]';
  const ACTIONS = Object.freeze({
    undo: '직전에 변경한 일정이나 기록을 이전 상태로 되돌립니다.',
    close: '현재 열린 화면을 닫습니다. 저장하지 않은 입력이 있으면 먼저 확인합니다.',
    plan: '날짜별 전체 일정과 방문 순서를 봅니다.',
    prep: '출발 전 준비와 예약 확인 목록을 봅니다.',
    'more-page': '선택한 더보기 항목의 내용을 엽니다.',
    'more-back': '더보기 메뉴로 돌아갑니다.',
    settings: '화면 설정, 데이터 백업, 앱 설치와 업데이트를 관리합니다.',
    import: '여행 또는 백업 JSON 파일을 고릅니다. 기존 기록을 바꿀 때는 확인 후 적용합니다.',
    export: '일정과 지출 기록을 백업 파일로 저장합니다. 영수증 사진은 별도 사진 백업이 필요합니다.',
    legacy: '같은 사이트에 남아 있는 v1 준비 체크, 완료 기록, 환율을 가져옵니다.',
    install: '홈 화면에 앱을 설치하거나 설치 방법을 확인합니다.',
    'cache-info': '인터넷 없이 사용할 앱 파일과 개인 일정의 준비 상태를 확인합니다.',
    'persist-storage': '브라우저에 이 기기의 기록을 오래 보관하도록 요청합니다. 별도 백업도 권장합니다.',
    'check-update': '인터넷에 연결해 새 앱 버전이 준비됐는지 확인합니다.',
    'apply-update': '현재 기록을 저장한 뒤 준비된 새 앱 버전을 적용하고 화면을 다시 엽니다.',
    'rate-settings': '환율을 자동으로 받을지 직접 입력할지 설정합니다.',
    'refresh-rate': '인터넷에서 최신 환율을 다시 조회합니다. 이미 기록한 지출 원화는 바꾸지 않습니다.',
    editmode: '일정의 편집, 복제, 순서 변경, 삭제 도구를 표시하거나 숨깁니다.',
    add: '새 방문 또는 이동 일정을 입력하는 화면을 엽니다.',
    'add-place': '이 장소를 넣은 새 일정을 작성합니다. 저장 전에는 일정에 추가되지 않습니다.',
    edit: '이 일정의 시간, 장소, 비용과 메모를 편집합니다.',
    'toggle-event': '이 일정의 장소, 메모와 실행 버튼을 펼치거나 접습니다.',
    'map-visit': '일정 지도에서 이 방문 장소의 위치를 확인합니다.',
    reveal: '선택한 일정이 있는 날짜로 이동해 상세 내용을 펼칩니다.',
    'search-reveal': '검색 화면을 닫고 해당 일정의 상세 내용을 펼칩니다.',
    'search-guide': '전체 여행 가이드를 엽니다.',
    start: '이 일정을 시작한 시각을 기록합니다.',
    done: '이 일정을 완료한 것으로 기록합니다.',
    skip: '이 일정을 건너뛴 것으로 표시합니다. 실제 예약은 취소하지 않습니다.',
    'cancel-item': '앱 안에서 일정을 취소한 것으로 기록합니다. 실제 예약은 직접 취소해야 합니다.',
    unmark: '이 일정의 진행 상태를 대기로 되돌립니다.',
    delete: '확인 후 이 일정을 목록에서 삭제합니다. 실제 예약은 취소하지 않습니다.',
    duplicate: '이 방문 일정을 복사해 새 방문을 만듭니다. 예약 확정 상태는 복사하지 않습니다.',
    up: '이 방문을 한 칸 앞으로 옮깁니다. 바뀐 이동시간과 일정을 확인하세요.',
    down: '이 방문을 한 칸 뒤로 옮깁니다. 바뀐 이동시간과 일정을 확인하세요.',
    route: '이 구간의 출발지, 도착지와 이동수단별 경로를 확인합니다.',
    'place-route': '이 장소로 가는 경로를 확인하는 화면을 엽니다.',
    'route-day': '선택한 날짜의 일정 지도를 크게 열어 전체 방문 동선을 확인합니다.',
    driver: '기사에게 보여줄 목적지 이름과 주소를 크게 표시합니다.',
    'place-info': '장소의 이름, 주소와 저장된 정보를 확인합니다.',
    conversation: '상황별 여행 표현을 중국어 또는 영어로 찾아 크게 보여줍니다.',
    english: '여행에서 사용할 영어 표현을 확인합니다.',
    receipts: '영수증 사진 추가, 분석 결과 검토와 보관한 지출을 관리합니다.',
    'receipt-queue': '영수증 분석 진행 상황을 보고 검토를 마친 항목을 지출에 저장합니다.',
    expense: '실제로 쓴 금액과 결제수단을 입력해 지출로 기록합니다.',
    cash: '처음 준비한 현금과 추가 인출·충전 금액을 관리합니다.',
    'budget-settings': '위스키와 선물·쇼핑 예산을 변경합니다.',
    'delete-expense': '확인 후 이 지출 기록을 삭제합니다. 예산과 현금 잔액 계산에도 반영됩니다.',
    delay: '실제 진행 상황을 입력하고 뒤 일정의 시간 조정안을 확인합니다.',
    'delay-review': '대기 중인 지연 조정안을 확인합니다. 승인하기 전에는 적용하지 않습니다.',
    'dismiss-delay': '이 지연 조정안을 적용하지 않고 닫습니다.',
    'prep-reset': '확인 후 준비 체크 표시를 초기화합니다. 실제 예약은 취소하지 않습니다.',
    'restore-original': '확인 후 일정·완료·메모를 처음 불러온 원본으로 되돌립니다. 지출과 준비 체크는 유지합니다.',
    'schedule-last': '가장 최근 일정 조정 기록을 확인합니다.',
    conflicts: '시간 겹침과 이동시간을 확인하고 일정 조정안을 검토합니다.',
    'schedule-review': '시간 겹침과 이동시간을 확인하고 일정 조정안을 검토합니다. 승인 전에는 바뀌지 않습니다.'
  });
  const IDS = Object.freeze({
    undoBtn: ACTIONS.undo, searchBtn: '일정, 장소와 여행 가이드를 검색합니다.', settingsBtn: ACTIONS.settings,
    fxBtn: '대만달러와 원화 환산 계산기를 엽니다.', cacheBtn: ACTIONS['cache-info'], closeSheet: ACTIONS.close,
    keepDraft: '입력 중인 내용을 유지하고 편집 화면으로 돌아갑니다.',
    discardDraft: '저장하지 않은 입력을 버리고 현재 화면을 닫습니다.',
    confirmYes: '화면에 안내된 변경을 확정합니다. 위의 내용을 먼저 확인하세요.',
    applyDelay: '화면에서 확인한 지연 조정안을 일정에 적용합니다.',
    approveSchedule: '검토한 시간 조정안을 일정에 적용합니다. 확인이 필요한 항목은 먼저 검토하세요.',
    previewRouteTimes: '입력한 구간별 소요시간으로 일정 조정안을 다시 계산합니다. 승인 전에는 저장하지 않습니다.',
    quickUpdate: ACTIONS['apply-update'], copyPlace: '이 장소의 이름과 주소를 복사합니다.',
    openTaxi: '기사에게 보여줄 목적지 이름과 주소를 크게 표시합니다.',
    copyTaxi: '기사에게 보여줄 목적지 정보를 복사합니다.', taxiInfo: '현재 목적지의 장소 이름과 주소 등 저장된 정보를 봅니다.',
    languageZh: '여행 표현을 중국어 번체로 표시합니다.', languageEn: '여행 표현을 영어로 표시합니다.',
    backConversation: '회화 상황 선택 화면으로 돌아갑니다.', backConversationSubgroups: '이 상황의 세부 분류로 돌아갑니다.',
    backConversationList: '같은 상황의 표현 목록으로 돌아갑니다.', copyConversation: '현재 표시된 외국어 문장을 복사합니다.'
  });
  const MAP_ACTIONS = Object.freeze({
    expand: '지도를 크게 보거나 원래 크기로 되돌립니다.', 'zoom-in': '지도를 확대해 가까이 봅니다.',
    'zoom-out': '지도를 축소해 넓게 봅니다.', fit: '현재 지역의 전체 방문 동선이 보이도록 지도를 맞춥니다.',
    hotel: '지도를 숙소 위치로 이동합니다.', 'hotel-info': '숙소 이름과 주소 등 저장된 정보를 확인합니다.'
  });
  const FORMS = Object.freeze({
    rateForm: '입력한 환율 설정을 저장합니다.', editForm: '입력한 일정 내용을 저장합니다.',
    expenseForm: '입력한 금액과 결제수단을 실제 지출로 저장합니다.', cashForm: '입력한 초기 현금과 인출·충전 누계를 저장합니다.',
    budgetForm: '입력한 쇼핑 예산을 저장합니다.', settingsForm: '선택한 화면과 일정 관리 설정을 저장합니다.'
  });
  // These exact labels are verified receipt controls. Unrecognized button text is never guessed.
  const RECEIPT_LABELS = Object.freeze({
    '영수증 사진 여러 장 추가': '기기에 보관할 영수증 사진을 선택하거나 촬영하는 화면을 엽니다.',
    '사진 여러 장 추가': '여러 영수증 사진을 선택해 분석 대기열에 추가합니다.',
    '분석 대기열 · 일괄 검토': ACTIONS['receipt-queue'], '사진 포함 백업': '영수증 사진과 인식 내용을 백업합니다. 휴지통 사진도 포함됩니다.',
    '영수증 백업 복원': '사진 포함 영수증 백업 파일을 골라 복원합니다. 지출은 자동 추가하지 않습니다.',
    '휴지통 보기': '보관함에서 숨긴 영수증을 확인하고 복원합니다.', '영수증 보관함': '보관한 영수증과 연결된 지출을 봅니다.',
    '검토 완료 항목 전체 선택': '직접 검토를 마친 영수증을 일괄 지출 저장 대상으로 선택합니다.',
    '분석 취소 · 직접 검토': '자동 분석을 멈추고 영수증 내용을 직접 확인할 수 있도록 합니다.',
    '원본 보고 검토': '영수증 원본과 인식한 날짜·상호·금액을 비교하고 수정합니다.',
    '검토 내용 수정': '검토한 영수증 내용을 다시 확인하고 수정합니다.',
    '분석 다시 시도': '분석에 실패한 영수증의 글자 인식을 다시 시도합니다.',
    '휴지통으로 이동': '이 영수증을 휴지통에 숨깁니다. 사진과 이미 기록된 지출은 유지됩니다.',
    '검토하고 지출 연결': '영수증 내용을 확인하고 실제 지출에 연결할 준비를 합니다.',
    '영수증 보관함에서 숨기기': '이 영수증을 휴지통으로 옮길지 확인합니다. 기존 지출은 유지됩니다.',
    '휴지통으로 옮기기': '사진을 휴지통에 숨깁니다. 지출은 유지되며 나중에 복원할 수 있습니다.',
    '영수증 보관함으로 복원': '휴지통에 숨긴 사진을 영수증 보관함으로 되돌립니다.',
    '보관함으로 복원': '휴지통에 숨긴 사진을 영수증 보관함으로 되돌립니다.',
    '원본·상세 보기': '보관한 영수증 사진과 확인한 내역을 봅니다.',
    '수정 내용 임시 저장 · 나중에 검토': '수정한 내용을 임시로 보관합니다. 아직 지출에는 추가하지 않습니다.',
    '검토 완료 · 일괄 저장 대기': '직접 확인한 영수증을 검토 완료로 표시합니다. 대기열에서 선택해 지출로 저장하세요.'
  });
  let instance = 0;
  const installations = new WeakMap();
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key) ? object[key] : '';
  const clean = value => typeof value === 'string' ? value.trim().slice(0, 1200) : '';

  function descriptionFor(button, descriptions) {
    if (button.hasAttribute('data-hold-help')) return clean(button.getAttribute('data-hold-help'));
    if (button.hasAttribute('data-help')) return clean(button.getAttribute('data-help'));
    const data = button.dataset || {};
    if (descriptions) {
      const result = typeof descriptions === 'function' ? descriptions(button) : own(descriptions, button.id) || own(descriptions, data.action);
      if (result === false) return '';
      if (clean(result)) return clean(result);
    }
    if (own(IDS, button.id)) return IDS[button.id];
    if (own(ACTIONS, data.action)) return ACTIONS[data.action];
    if (data.mapAction === 'online') return button.getAttribute('aria-pressed') === 'true'
      ? '온라인 배경지도를 끄고 저장된 좌표의 오프라인 동선도로 돌아갑니다.'
      : 'OpenStreetMap 배경지도를 불러옵니다. 인터넷이 필요하며 표시 영역 정보가 지도 제공자에게 전달됩니다.';
    if (own(MAP_ACTIONS, data.mapAction)) return MAP_ACTIONS[data.mapAction];
    if (data.mapPoint !== undefined) return '지도에서 이 장소를 선택하고 연결된 방문 일정과 장소 정보를 확인합니다.';
    if (data.mapVisit !== undefined) return '지도에서 이 방문을 선택하고 해당 일정과 연결합니다.';
    if (data.mapPlace !== undefined) return ACTIONS['place-info'];
    if (data.mapLeg !== undefined) return '이 이동 구간의 이동수단, 시간과 비용을 확인합니다.';
    if (data.mapRegion !== undefined) return '지도를 선택한 지역으로 옮겨 해당 지역의 동선을 봅니다.';
    const tabs = { home: '오늘의 일정 진행과 여행 경비 요약을 봅니다.', plan: ACTIONS.plan, money: '여행 예산, 실제 지출과 현금 잔액을 봅니다.', places: '여행 장소 목록에서 정보와 길찾기를 확인합니다.', more: '여행 준비, 회화와 가이드 등 더보기 메뉴를 엽니다.' };
    if (own(tabs, data.tab)) return tabs[data.tab];
    if (data.day !== undefined) return '선택한 날짜의 일정과 동선을 봅니다.';
    if (data.filter !== undefined) return own({all:'등록된 장소를 모두 봅니다.',used:'일정에서 사용하는 장소만 봅니다.',saved:'저장해 둔 장소만 봅니다.'}, data.filter);
    if (data.term !== undefined) return '선택한 여행 가이드 설명을 엽니다.';
    if (data.conversationCategory !== undefined) return '이 상황의 세부 분류와 여행 표현을 찾아봅니다.';
    if (data.conversationSubgroup !== undefined) return '이 세부 상황에서 쓸 수 있는 여행 표현을 봅니다.';
    if (data.conversationPhrase !== undefined) return '이 표현을 크게 표시해 상대에게 보여줍니다.';
    if (data.delayMin !== undefined) return '지연 조정에 사용할 분 단위를 선택합니다. 적용 전 조정안을 확인하세요.';
    if (data.quick !== undefined && button.closest('#sheet')) return '이 금액을 환율 계산기에 입력합니다.';
    if (button.type === 'submit' && button.form && own(FORMS, button.form.id)) return FORMS[button.form.id];
    if (button.matches('.receipt-row')) return '이 영수증의 원본 사진과 기록한 지출 내역을 엽니다.';
    if (button.closest('[class*="receipt-"]')) {
      const label = button.textContent.replace(/\s+/g, ' ').trim();
      if (own(RECEIPT_LABELS, label)) return RECEIPT_LABELS[label];
      if (/^검토 완료한 선택 \d+건 지출 저장$/.test(label)) return '선택한 검토 완료 영수증만 실제 지출에 저장합니다. 이미 연결된 항목은 중복 저장하지 않습니다.';
    }
    if (data.receiptRestore !== undefined) return '검사한 영수증 사진을 보관함에 복원합니다. 지출은 자동 추가하지 않습니다.';
    return '';
  }

  function install(options) {
    options = options || {};
    const root = options.root || (typeof document !== 'undefined' ? document : null);
    if (!root || !root.addEventListener) throw new TypeError('TripButtonHelp.install requires a document or element root');
    if (installations.has(root)) return installations.get(root);
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    const win = doc.defaultView;
    const uid = 'trip-button-help-' + (++instance) + '-';
    const entries = new Map();
    const listeners = [];
    let serial = 0, active = null, blocked = null, tooltip = null, destroyed = false;
    const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); listeners.push(() => target.removeEventListener(type, fn, opts)); };
    const inside = button => !!button && button.isConnected && (root === doc || root === button || root.contains(button));
    function eligible(button) {
      return inside(button) && button.matches(SELECTOR) && !button.closest(EXCLUDED) && !button.matches(':disabled') &&
        !button.closest('[inert],[hidden],[aria-hidden="true"],[aria-disabled="true"]');
    }
    function from(target) {
      const element = target && (target.nodeType === 1 ? target : target.parentElement);
      if (!element || element.closest(EXCLUDED)) return null;
      const button = element.closest(SELECTOR);
      return eligible(button) ? button : null;
    }
    const mount = button => button.closest('dialog[open]') || doc.body || doc.documentElement;
    const tokens = button => (button.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    function forget(button) {
      const entry = entries.get(button);
      if (!entry) return;
      const ids = tokens(button).filter(id => id !== entry.id);
      if (ids.length) button.setAttribute('aria-describedby', ids.join(' ')); else button.removeAttribute('aria-describedby');
      if (!entry.hadReady) button.classList.remove('trip-button-help-ready');
      entry.span.remove(); entries.delete(button);
    }
    function ensure(button) {
      if (!eligible(button)) { forget(button); return null; }
      const text = descriptionFor(button, options.descriptions);
      if (!text) { forget(button); return null; }
      let entry = entries.get(button);
      if (!entry) {
        const span = doc.createElement('span');
        entry = { span, id: uid + (++serial), text, hadReady: button.classList.contains('trip-button-help-ready') };
        span.id = entry.id; span.className = 'trip-button-help-description'; span.setAttribute('data-button-help-owned', '');
        entries.set(button, entry); button.classList.add('trip-button-help-ready');
      }
      entry.text = text;
      if (entry.span.textContent !== text) entry.span.textContent = text;
      const parent = mount(button); if (entry.span.parentNode !== parent) parent.appendChild(entry.span);
      const ids = tokens(button); if (!ids.includes(entry.id)) button.setAttribute('aria-describedby', ids.concat(entry.id).join(' '));
      return entry;
    }
    function clearBlocked() {
      if (blocked && blocked.timer !== null) win.clearTimeout(blocked.timer);
      blocked = null;
    }
    function armBlockedExpiry() {
      if (!blocked) return;
      if (blocked.timer !== null) win.clearTimeout(blocked.timer);
      const token = blocked;
      token.timer = win.setTimeout(() => { if (blocked === token) blocked = null; }, 800);
    }
    function cancel() {
      if (active) { win.clearTimeout(active.timer); active.button.classList.remove('trip-button-help-pressing'); }
      active = null;
      if (tooltip) tooltip.remove();
      tooltip = null;
    }
    function position(button) {
      if (!tooltip) return;
      const r = button.getBoundingClientRect(), t = tooltip.getBoundingClientRect();
      const viewport = win.visualViewport;
      const leftEdge = viewport ? viewport.offsetLeft : 0, topEdge = viewport ? viewport.offsetTop : 0;
      const width = viewport ? viewport.width : win.innerWidth, height = viewport ? viewport.height : win.innerHeight;
      const tipWidth = Math.min(t.width || 320, Math.max(0, width - 24)), tipHeight = t.height || 76;
      const left = Math.max(leftEdge + 12, Math.min(r.left + r.width / 2 - tipWidth / 2, leftEdge + width - tipWidth - 12));
      let top = r.top - tipHeight - 12;
      if (top < topEdge + 12) top = r.bottom + 12;
      top = Math.max(topEdge + 12, Math.min(top, topEdge + height - tipHeight - 12));
      tooltip.style.left = left + 'px'; tooltip.style.top = top + 'px';
    }
    function begin(button, mode, event) {
      cancel(); clearBlocked();
      const entry = ensure(button); if (!entry) return;
      const press = { button, mode, pointerId: event.pointerId, x: event.clientX, y: event.clientY, shown: false, timer: null };
      active = press; button.classList.add('trip-button-help-pressing');
      press.timer = win.setTimeout(() => {
        if (active !== press || !eligible(button) || doc.hidden || (mode === 'keyboard' && doc.activeElement !== button)) { cancel(); return; }
        const current = ensure(button); if (!current) { cancel(); return; }
        press.shown = true;
        blocked = { button, mode, pointerId: press.pointerId, timer: null };
        tooltip = doc.createElement('div'); tooltip.className = 'trip-button-help-tooltip';
        tooltip.setAttribute('role', 'tooltip'); tooltip.setAttribute('aria-hidden', 'true'); tooltip.setAttribute('data-button-help-owned', '');
        tooltip.textContent = current.text;
        mount(button).appendChild(tooltip); position(button);
      }, HOLD_MS);
    }
    function pointerDown(event) {
      if (active && (event.pointerId !== active.pointerId || active.mode !== 'pointer')) cancel();
      if (event.button !== 0 || event.isPrimary === false) return;
      const button = from(event.target);
      if (button) begin(button, 'pointer', event);
      else { cancel(); clearBlocked(); }
    }
    function pointerMove(event) {
      if (!active || active.mode !== 'pointer' || event.pointerId !== active.pointerId) return;
      if (!eligible(active.button) || Math.hypot(event.clientX - active.x, event.clientY - active.y) > MOVE_PX) cancel();
    }
    function pointerEnd(event) {
      if (active && active.mode === 'pointer' && event.pointerId === active.pointerId) cancel();
      if (blocked && blocked.mode === 'pointer' && event.pointerId === blocked.pointerId) armBlockedExpiry();
    }
    function keyDown(event) {
      const button = from(event.target);
      if (event.key === 'Escape') { cancel(); return; }
      if (event.key !== ' ' && event.key !== 'Spacebar') { if (active && active.mode === 'keyboard') cancel(); return; }
      // Native buttons activate Space on keyup; custom role=button widgets may activate on keydown.
      if (!button || button.tagName !== 'BUTTON' || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.repeat || active && active.mode === 'keyboard' && active.button === button) return;
      begin(button, 'keyboard', event);
    }
    function keyUp(event) {
      if (event.key !== ' ' && event.key !== 'Spacebar') return;
      const button = from(event.target);
      if (blocked && blocked.mode === 'keyboard' && blocked.button === button) {
        event.preventDefault(); event.stopImmediatePropagation(); armBlockedExpiry();
      }
      if (active && active.mode === 'keyboard') cancel();
    }
    function click(event) {
      const button = from(event.target);
      if (!blocked || button !== blocked.button) { if (active) cancel(); return; }
      if (blocked.mode === 'pointer' && event.pointerId !== undefined && event.pointerId >= 0 && blocked.pointerId !== undefined && event.pointerId !== blocked.pointerId) return;
      event.preventDefault(); event.stopImmediatePropagation(); cancel(); clearBlocked();
    }
    function focusOut(event) { if (active && active.button === event.target) cancel(); }
    function contextMenu(event) {
      if (active && active.mode === 'pointer' && from(event.target) === active.button) event.preventDefault();
    }
    function refresh() {
      if (destroyed) return;
      for (const button of entries.keys()) if (!eligible(button)) forget(button);
      if (root.matches && root.matches(SELECTOR)) ensure(root);
      root.querySelectorAll(SELECTOR).forEach(ensure);
      if (active && (!eligible(active.button) || !entries.has(active.button))) cancel();
      if (blocked && !inside(blocked.button)) clearBlocked();
    }
    // Capture observes gestures only. Never capture a pointer or cancel pointer/scroll defaults.
    listen(root, 'pointerdown', pointerDown, { capture: true, passive: true });
    listen(doc, 'pointermove', pointerMove, { capture: true, passive: true });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(doc, type, pointerEnd, { capture: true, passive: true });
    listen(doc, 'click', click, true);
    listen(root, 'keydown', keyDown, true); listen(doc, 'keyup', keyUp, true);
    listen(root, 'focusin', event => { const button = from(event.target); if (button) ensure(button); }, true);
    listen(root, 'focusout', focusOut, true); listen(root, 'contextmenu', contextMenu, true);
    for (const type of ['scroll', 'visibilitychange', 'close', 'cancel', 'trip:button-help-cancel', 'trip:navigation']) listen(doc, type, cancel, { capture: true, passive: true });
    for (const type of ['blur', 'pagehide', 'beforeunload', 'popstate', 'hashchange', 'resize']) listen(win, type, cancel, { passive: true });
    if (win.visualViewport) for (const type of ['scroll', 'resize']) listen(win.visualViewport, type, cancel, { passive: true });
    if (win.navigation) listen(win.navigation, 'navigate', cancel);
    const observer = win.MutationObserver ? new win.MutationObserver(records => {
      if (records.some(record => {
        if (record.target.nodeType === 1 && record.target.closest('[data-button-help-owned]')) return false;
        if (record.type === 'attributes') return true;
        return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType !== 1 || !node.hasAttribute('data-button-help-owned'));
      })) refresh();
    }) : null;
    refresh();
    if (observer) observer.observe(doc, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled','hidden','inert','aria-hidden','aria-disabled','aria-pressed','id','data-help','data-hold-help','data-hold-help-off','data-action','data-map-action','data-tab'] });
    function destroy() {
      if (destroyed) return; destroyed = true; cancel(); clearBlocked();
      if (observer) observer.disconnect(); listeners.splice(0).forEach(remove => remove());
      for (const button of entries.keys()) forget(button);
      installations.delete(root);
    }
    const api = { destroy, refresh, cancel };
    installations.set(root, api);
    return api;
  }
  return { install, descriptionFor, HOLD_MS, MOVE_PX };
});
