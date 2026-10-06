/* Copy only provided restaurant names after app.js has sanitized the source. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TripDeliveryCopy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const mounted = new WeakMap();
  const selector = '.zh';
  const nameHeaders = new Set(['가게 (앱에서 검색)', '가게명', '식당명', '店名', '餐廳名稱', 'Restaurant name']);
  const dishNames = new Set(['鹽酥雞', '雞排', '滷肉飯', '魯肉飯', '牛肉麵', '小籠包', '刈包', '滷味', '臭臭鍋', '鍋貼', '珍珠奶茶', '豆花', '芒果冰', '胡椒餅', '버블티', '루러우판', '우육면', '또우화', '망고빙수', 'bubble tea']);
  const missingText = '복사할 가게명 정보 없음';

  function snippet(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text && text.length <= 300 ? text : '';
  }

  function restaurantName(value) {
    const text = snippet(value);
    if (!text || text.length > 100 || dishNames.has(text.toLowerCase()) ||
        /https?:\/\/|www\.|[<>]|\bmailto:|\baddress\b|地址|주소|배송|배달\s*(?:주소|메모)|가게명\s*[:：]|店名\s*[:：]/i.test(text) ||
        /(?:市|區|区|路|街|段|巷|弄).*\d+\s*[號号]/.test(text) ||
        /請(?:放|送|幫|帮|留|在)|请(?:放|送|帮|留|在)|櫃[檯台]|不要|\bplease\b/i.test(text) ||
        /^(?:[-—–?？…]+|미정|미확인|없음|가게명|식당명|상호|중국어\s*(?:가게명|이름|명칭)|가게\s*이름|restaurant(?:\s+name)?|unknown|not\s+provided|n\/?a|tbd|placeholder|店名|餐廳名稱|未提供|未知|待確認)$/i.test(text)) return '';
    return text;
  }

  // The original delivery renderer explicitly labels its first column
  // "가게 (앱에서 검색)". Other .zh spans include addresses and instructions.
  // Never infer a name from prose, dish headings, links or an unlabelled table.
  function restaurantCells(root) {
    const result = [];
    for (const table of root.querySelectorAll('table')) {
      const rows = [...table.querySelectorAll('tr')].filter(row => row.closest('table') === table);
      const header = rows.find(row => [...row.children].some(cell => cell.tagName === 'TH'));
      if (!header) continue;
      const headings = [...header.children].filter(cell => ['TH', 'TD'].includes(cell.tagName));
      if (headings.some(cell => Number(cell.getAttribute('colspan') || 1) !== 1 || Number(cell.getAttribute('rowspan') || 1) !== 1)) continue;
      const columns = headings.map((cell, index) => cell.tagName === 'TH' && nameHeaders.has(snippet(cell.textContent)) ? index : -1).filter(index => index >= 0);
      if (columns.length !== 1) continue;
      for (const row of rows) {
        if (row === header || [...row.children].some(cell => cell.tagName === 'TH')) continue;
        const cells = [...row.children].filter(cell => cell.tagName === 'TD');
        if (cells.length !== headings.length || cells.some(cell => Number(cell.getAttribute('colspan') || 1) !== 1)) continue;
        result.push(cells[columns[0]]);
      }
    }
    return result;
  }

  // No permission query: browsers handle the explicitly requested clipboard write.
  // Legacy copy is attempted only for this short snippet, never the page selection.
  async function copyText(text, options = {}) {
    const doc = options.document || (typeof document !== 'undefined' ? document : null);
    const nav = options.navigator || doc?.defaultView?.navigator;
    const current = options.isCurrent || (() => true);
    if (!restaurantName(text) || !current()) return {ok: false, method: 'cancelled'};
    try {
      if (typeof nav?.clipboard?.writeText === 'function') {
        await nav.clipboard.writeText(text);
        return {ok: true, method: 'clipboard'};
      }
    } catch (_) { /* A denied/unavailable clipboard can still support manual copy. */ }
    if (!current()) return {ok: false, method: 'cancelled'};
    if (!doc?.body || typeof doc.execCommand !== 'function') return {ok: false, method: 'manual'};
    const active = doc.activeElement, selection = doc.getSelection?.(), ranges = [];
    try {
      for (let i = 0; selection && i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i).cloneRange());
    } catch (_) { /* Copying does not depend on having an earlier selection. */ }
    const field = doc.createElement('textarea');
    field.value = text;
    field.readOnly = true;
    field.tabIndex = -1;
    field.setAttribute('aria-label', '복사할 가게명');
    field.style.cssText = 'position:fixed;top:0;left:-9999px;width:1px;height:1px;font-size:16px;';
    let copied = false;
    try {
      doc.body.append(field);
      field.focus({preventScroll: true});
      field.select();
      field.setSelectionRange(0, field.value.length);
      copied = doc.execCommand('copy') === true;
    } catch (_) { /* Never claim success for an exception or a false return value. */ }
    finally {
      field.remove();
      if (active?.isConnected) active.focus?.({preventScroll: true});
      try {
        selection?.removeAllRanges();
        ranges.forEach(range => selection?.addRange(range));
      } catch (_) { /* The original selection may no longer exist. */ }
    }
    return {ok: copied, method: copied ? 'legacy' : 'manual'};
  }

  function mount(root, options = {}) {
    if (!root?.querySelectorAll || !root.ownerDocument) return {count: 0};
    let instance = mounted.get(root);
    if (!instance) {
      instance = {count: 0, missing: 0, cells: new WeakSet(), notify: options.notify, status: null, serial: 0, manual: null, empty: null};
      mounted.set(root, instance);
    }
    if (typeof options.notify === 'function') instance.notify = options.notify;
    const doc = root.ownerDocument;
    const announce = message => {
      if (!root.isConnected) return;
      instance.status.textContent = message;
      if (typeof instance.notify === 'function') instance.notify(message);
    };
    for (const cell of restaurantCells(root)) {
      if (instance.cells.has(cell)) continue;
      instance.cells.add(cell);
      const names = [...cell.querySelectorAll(selector)].filter(target => target.closest('td') === cell && !target.closest('small, summary, [data-term], [contenteditable="true"]'));
      const target = names.length === 1 ? names[0] : null;
      const text = target && !target.querySelector('table, details, div, p, ul, ol, li, br, small, .zh, a, button, [data-term]') ? restaurantName(target.textContent) : '';
      if (!text) {
        const missing = doc.createElement('span');
        missing.className = 'delivery-copy-missing';
        missing.textContent = missingText;
        cell.append(missing);
        instance.missing++;
        continue;
      }
      // Put the new button beside links/term buttons, never inside those controls.
      const existingControl = target.closest('a, button, [data-term]');
      const after = existingControl || target;
      if (!root.contains(after) || after === root) continue;
      if (!instance.status) {
        const help = doc.createElement('p');
        help.className = 'delivery-copy-help';
        help.textContent = '가게명 복사를 누른 뒤 배달 앱 검색창에 붙여넣으세요.';
        root.prepend(help);
        instance.status = doc.createElement('p');
        instance.status.className = 'delivery-copy-status';
        instance.status.setAttribute('role', 'status');
        instance.status.setAttribute('aria-live', 'polite');
        instance.status.setAttribute('aria-atomic', 'true');
        root.append(instance.status);
      }
      const control = doc.createElement('span'), button = doc.createElement('button'), badge = doc.createElement('span');
      control.className = 'delivery-copy-control';
      button.className = 'delivery-copy-button';
      button.type = 'button';
      badge.className = 'delivery-copy-label';
      badge.textContent = '가게명 복사';
      badge.setAttribute('aria-hidden', 'true');
      button.append(badge);
      const label = '가게명 복사: ' + text;
      button.setAttribute('aria-label', label);
      control.append(button);
      after.after(control);
      // Plain local-name text itself is tappable. Preserve existing link/search
      // controls by adding a separate copy button alongside them instead.
      if (!existingControl && ['SPAN', 'B', 'STRONG', 'EM', 'I', 'SMALL'].includes(target.tagName) &&
          !target.querySelector('a, button, [data-term]')) {
        button.classList.add('delivery-copy-name');
        button.prepend(target);
      }
      instance.count++;
      let pending = false, reset = null;
      button.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        if (pending) return;
        pending = true;
        clearTimeout(reset);
        instance.manual?.remove();
        instance.manual = null;
        const serial = ++instance.serial;
        badge.textContent = '복사 중';
        button.setAttribute('aria-busy', 'true');
        instance.status.textContent = '';
        const result = await copyText(text, {document: doc, isCurrent: () => root.isConnected && button.isConnected && serial === instance.serial});
        pending = false;
        button.removeAttribute('aria-busy');
        if (!root.isConnected || !button.isConnected) return;
        if (serial !== instance.serial) { badge.textContent = '가게명 복사'; return; }
        if (result.ok) {
          badge.textContent = '복사됨';
          announce('복사했어요: ' + text);
          reset = setTimeout(() => { badge.textContent = '가게명 복사'; }, 1800);
          return;
        }
        badge.textContent = '다시 복사';
        const manual = doc.createElement('span');
        instance.manual = manual;
        manual.className = 'delivery-copy-manual';
        const hint = doc.createElement('span'), field = doc.createElement('textarea');
        hint.textContent = '자동 복사가 제한됐어요. 아래 선택된 글자를 길게 눌러 복사해 주세요.';
        field.value = text;
        field.readOnly = true;
        field.rows = 2;
        field.setAttribute('aria-label', '직접 복사할 가게명');
        field.addEventListener('click', () => field.select());
        manual.append(hint, field);
        const table = button.closest('table');
        if (table && root.contains(table)) table.after(manual);
        else control.append(manual);
        announce(hint.textContent);
        field.focus({preventScroll: true});
        field.select();
        field.setSelectionRange(0, text.length);
      });
    }
    if (!instance.count && !instance.missing && !instance.empty) {
      instance.empty = doc.createElement('p');
      instance.empty.className = 'delivery-copy-missing';
      instance.empty.textContent = missingText;
      root.append(instance.empty);
    } else if (instance.count || instance.missing) {
      instance.empty?.remove();
      instance.empty = null;
    }
    return {count: instance.count, missing: instance.missing};
  }
  return {mount, copyText, snippet, restaurantName};
});
