/* Live connectivity is deliberately separate from app-shell readiness.
 * IMPORTANT: connection-check.txt must NEVER enter a service-worker precache or
 * offline fallback. The SW should let this path go straight to the network.
 * A no-store, nonce-bearing GET carries no trip data, cookies, or referrer.
 * A successful check proves this app's host was reachable at checkedAt only;
 * it cannot promise that maps, exchange-rate providers, or booking sites work.
 */
(function (host, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.TripConnectionStatus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EXPECTED_BODY = 'trip-connection-check-v1\n';
  const TIMEOUT_MS = 5000;
  const STALE_MS = 60000;
  const installations = new WeakMap();
  let nonce = 0;
  const LABELS = Object.freeze({ online: '✓ 온라인', offline: '○ 오프라인', checking: '↻ 연결 확인 중', unknown: '? 연결 확인 필요' });
  const DETAILS = Object.freeze({
    online: '최근 확인에서 이 앱의 호스트에 연결했습니다. 외부 지도·환율·예약 사이트의 연결은 다를 수 있습니다.',
    offline: '기기가 오프라인 상태입니다. 미리 준비한 앱과 이 기기에 저장된 정보는 계속 사용할 수 있습니다.',
    checking: '실제 서버 연결을 확인하고 있습니다. 기기의 네트워크 표시만으로 온라인이라고 판단하지 않습니다.',
    unknown: '기기는 네트워크 연결을 표시하지만 앱 서버의 응답을 확인하지 못했습니다. 인터넷·로그인 Wi-Fi·서버 문제일 수 있습니다.'
  });

  function create(options) {
    const button = options && options.button;
    const doc = button && button.ownerDocument;
    const win = doc && doc.defaultView;
    if (!win || !button.addEventListener || button.tagName !== 'BUTTON') throw new TypeError('A status button is required');
    if (installations.has(button)) installations.get(button).destroy();
    const onExplain = typeof options.onExplain === 'function' ? options.onExplain : function () {};
    const onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    const now = () => win.Date.now();
    const browserOnline = () => win.navigator.onLine !== false;
    let destroyed = false, sequence = 0, pending = null, expiryTimer = null;
    let state = {
      state: 'checking', label: LABELS.checking, detail: DETAILS.checking,
      reason: 'checking', observedAt: now(), checkedAt: null, lastVerifiedAt: null,
      browserOnline: browserOnline()
    };
    const original = {};
    const attributes = ['title', 'aria-label', 'aria-description', 'aria-live', 'aria-atomic', 'aria-haspopup', 'data-state', 'data-hold-help'];
    for (const name of attributes) original[name] = button.getAttribute(name);
    const hadClass = button.classList.contains('trip-connection-status');
    button.classList.add('trip-connection-status');
    button.setAttribute('aria-live', 'polite');
    button.setAttribute('aria-atomic', 'true');
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('data-hold-help', '현재 연결 상태와 온라인·오프라인에서 사용할 수 있는 기능을 설명합니다.');

    function getState() { return Object.freeze({ ...state }); }
    function render() {
      button.textContent = state.label + ' · 설명';
      button.setAttribute('data-state', state.state);
      button.setAttribute('aria-label', state.label + '. 연결 상태와 오프라인 기능 안내');
      button.setAttribute('aria-description', state.detail);
      button.setAttribute('title', state.detail + ' 눌러서 사용 가능한 기능을 확인하세요.');
    }
    function setState(kind, reason, completed, isOnline) {
      if (destroyed) return;
      const time = now();
      state = {
        state: kind, label: LABELS[kind], detail: reason === 'stale' ? '최근 확인 후 시간이 지났어요. 현재 연결은 다시 확인해 주세요.' : DETAILS[kind], reason,
        observedAt: time,
        checkedAt: completed ? time : state.checkedAt,
        lastVerifiedAt: kind === 'online' ? time : state.lastVerifiedAt,
        browserOnline: typeof isOnline === 'boolean' ? isOnline : browserOnline()
      };
      render();
      // UI consumers may update an already-open sheet; this component never
      // opens one itself. An unrelated UI exception must not strand a probe.
      try { onChange(getState()); } catch (_) {}
    }
    // Settle cancelled callers too, even if a browser/fetch mock ignores abort.
    function cancelPending() {
      if (!pending) return;
      const old = pending;
      pending = null;
      old.settled = true;
      win.clearTimeout(old.timer);
      old.controller.abort();
      old.resolve(getState());
    }
    function clearExpiry() {
      if (expiryTimer !== null) win.clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    function expireVerifiedState() {
      clearExpiry();
      const verifiedAt = state.lastVerifiedAt, verifiedSequence = sequence;
      // One UI-only expiry, not polling. A long-open foreground tab must not
      // claim an old success as the current connection indefinitely.
      expiryTimer = win.setTimeout(() => {
        expiryTimer = null;
        if (destroyed || sequence !== verifiedSequence || state.state !== 'online' || state.lastVerifiedAt !== verifiedAt) return;
        if (!browserOnline()) becomeOffline();
        else setState('unknown', 'stale', false);
      }, STALE_MS);
    }
    function becomeOffline() {
      if (destroyed) return;
      sequence++;
      clearExpiry();
      setState('offline', 'browser-offline', true, false);
      cancelPending();
    }
    function isCurrent(request) {
      return !destroyed && pending === request && !request.settled && request.id === sequence;
    }
    function finish(request, kind, reason) {
      if (!isCurrent(request)) return;
      // A connection may disappear before its event is delivered.
      if (!browserOnline()) { becomeOffline(); return; }
      request.settled = true;
      win.clearTimeout(request.timer);
      pending = null;
      setState(kind, reason, true);
      if (!destroyed && request.id === sequence && state.state === 'online') expireVerifiedState();
      request.resolve(getState());
    }
    async function acceptResponse(request, response) {
      if (!isCurrent(request)) return;
      if (!response || response.status !== 200 || response.ok !== true || !response.headers || typeof response.headers.get !== 'function') {
        finish(request, 'unknown', 'invalid-response'); return;
      }
      if (response.redirected || response.type === 'opaqueredirect') { finish(request, 'unknown', 'redirect'); return; }
      if (response.type === 'opaque' || response.type === 'error') { finish(request, 'unknown', 'invalid-response'); return; }
      // Cached canonical/older nonce responses and synthetic SW fallbacks lack
      // the exact current request URL. Do not accept even a matching marker.
      // A live CDN edge may legitimately return HIT/Age headers: reaching it
      // still proves host connectivity. That is distinct from an offline
      // browser/SW replay, prevented by no-store + nonce + network-only path.
      if (response.url !== request.url) { finish(request, 'unknown', 'cached-response'); return; }
      const body = await response.text();
      if (!isCurrent(request)) return;
      finish(request, body === EXPECTED_BODY ? 'online' : 'unknown', body === EXPECTED_BODY ? 'verified' : 'unexpected-body');
    }
    function check() {
      if (destroyed) return Promise.resolve(getState());
      if (!browserOnline()) { becomeOffline(); return Promise.resolve(getState()); }
      sequence++;
      clearExpiry();
      setState('checking', 'checking', false);
      cancelPending();
      if (destroyed) return Promise.resolve(getState());
      if (typeof win.fetch !== 'function' || typeof win.AbortController !== 'function') {
        setState('unknown', 'unsupported', true); return Promise.resolve(getState());
      }
      const url = new win.URL('./connection-check.txt', win.location.href);
      if (!/^https?:$/.test(url.protocol) || url.origin !== win.location.origin) {
        setState('unknown', 'unsupported-origin', true); return Promise.resolve(getState());
      }
      // Ephemeral timing/sequence only. Never include location, itinerary,
      // expenses, identifiers, persisted values, or the current page query.
      url.search = '?_connection=' + now().toString(36) + '-' + (++nonce).toString(36);
      url.hash = '';
      const request = { id: sequence, controller: new win.AbortController(), url: url.href, settled: false, timer: null, resolve: null };
      const promise = new Promise(resolve => { request.resolve = resolve; });
      pending = request;
      request.timer = win.setTimeout(() => {
        if (!isCurrent(request)) return;
        finish(request, 'unknown', 'timeout');
        request.controller.abort();
      }, TIMEOUT_MS);
      try {
        const result = win.fetch(request.url, {
          method: 'GET', mode: 'same-origin', cache: 'no-store', credentials: 'omit',
          redirect: 'error', referrerPolicy: 'no-referrer', signal: request.controller.signal
        });
        Promise.resolve(result).then(response => acceptResponse(request, response)).catch(() => {
          finish(request, 'unknown', 'fetch-failed');
        });
      } catch (_) { finish(request, 'unknown', 'fetch-failed'); }
      return promise;
    }
    function explain() {
      if (destroyed) return;
      if (!pending && (state.reason === 'stale' || (state.checkedAt !== null && now() - state.checkedAt >= STALE_MS))) check();
      onExplain(getState());
    }
    function resume() {
      if (destroyed || doc.visibilityState === 'hidden' || pending) return;
      if (state.checkedAt === null || now() - state.checkedAt >= STALE_MS || state.browserOnline !== browserOnline()) check();
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      sequence++;
      clearExpiry();
      cancelPending();
      button.removeEventListener('click', explain);
      win.removeEventListener('online', check);
      win.removeEventListener('offline', becomeOffline);
      win.removeEventListener('pageshow', resume);
      doc.removeEventListener('visibilitychange', resume);
      for (const name of attributes) {
        if (original[name] === null) button.removeAttribute(name);
        else button.setAttribute(name, original[name]);
      }
      if (!hadClass) button.classList.remove('trip-connection-status');
      if (installations.get(button) === api) installations.delete(button);
    }
    const api = Object.freeze({ getState, check, destroy });
    installations.set(button, api);
    button.addEventListener('click', explain);
    win.addEventListener('online', check);
    win.addEventListener('offline', becomeOffline);
    win.addEventListener('pageshow', resume);
    doc.addEventListener('visibilitychange', resume);
    render();
    check();
    return api;
  }
  return Object.freeze({ create, EXPECTED_BODY, TIMEOUT_MS, STALE_MS });
});
