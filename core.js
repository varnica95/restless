// RESTless — core (runs in the page's MAIN world at document_start).
// Wraps fetch / XMLHttpRequest, links requests to the element that triggered
// them, supports dry-run capture, and applies user rewrite rules.
(() => {
  if (window.__apiPeekCore) return;

  const LS_RULES = '__apiPeek.rules';
  const LS_REC = '__apiPeek.recordings';
  const TRIGGER_WINDOW_MS = 2000;
  const MAX_REQUESTS = 500;
  const MAX_PER_ENDPOINT = 50; // polling endpoints keep only their latest calls
  const KEEP_BODIES_PER_ENDPOINT = 5; // older calls of the same endpoint drop their response body
  const MAX_BODY = 20000;
  const MAX_RESPONSE = 200000;

  const origFetch = window.fetch.bind(window);
  const XHR = window.XMLHttpRequest;
  const xhrOpen = XHR.prototype.open;
  const xhrSend = XHR.prototype.send;
  const xhrSetHeader = XHR.prototype.setRequestHeader;

  const listeners = new Set();
  const state = { requests: [], trigger: null, captureMode: null };
  let seq = 0;

  // ---------- storage (localStorage: synchronous, so rules exist before the app's first fetch)
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota / disabled */ } };
  let rules = load(LS_RULES, []);
  // Login profiles: saved Authorization (or other) header values to send as another user.
  // { profiles: [{ id, name, header, value }], active: id | null, app: true = also the app's own calls }
  const LS_AUTH = '__apiPeek.auth';
  let auth = { profiles: [], active: null, app: true, ...load(LS_AUTH, {}) };
  // Origins where a user's token may replace the app's own (the app's API); null = anywhere it already sends one.
  const activeProfile = () => (auth.active ? auth.profiles.find((x) => x.id === auth.active && x.value) || null : null);
  // Header entries with `name` replaced (case-insensitive); added when `add` and missing.
  function withHeader(entries, name, value, add) {
    const low = String(name).toLowerCase();
    let found = false;
    const out = entries.map(([k, v]) => { if (String(k).toLowerCase() === low) { found = true; return [k, value]; } return [k, v]; });
    if (!found && add) out.push([name, value]);
    return { out, found };
  }
  let recordings = load(LS_REC, {});

  // (URL / method capture filters were removed; forget any an older version saved.)
  try { localStorage.removeItem('__apiPeek.settings'); } catch { /* storage blocked */ }

  // Capture is off until the user turns it on for this site (per origin, localStorage).
  // While off, the app's fetch/XHR go straight to the browser: nothing is recorded or changed.
  const LS_ON = '__apiPeek.capture';
  let captureOn = (() => { try { return localStorage.getItem(LS_ON) === '1'; } catch { return false; } })();
  const captureApi = {
    on: () => captureOn,
    set(on) { captureOn = !!on; try { localStorage.setItem(LS_ON, captureOn ? '1' : '0'); } catch { /* storage blocked */ } notify(); },
  };
  // Inspect (dry run) is user-started, so it works even while capture is off.
  const bypass = () => !captureOn && !state.captureMode;


  // Every request (even ones hidden by the capture filter) goes through these hooks.
  const requestHooks = new Set();

  let notifyQueued = false;
  function notify() {
    if (notifyQueued) return;
    notifyQueued = true;
    queueMicrotask(() => { notifyQueued = false; listeners.forEach((fn) => { try { fn(); } catch (e) { console.warn('[RESTless]', e); } }); });
  }

  // ---------- elements
  const ACTIONABLE = 'button, a[href], [role=button], [role=menuitem], [role=tab], input[type=submit], input[type=button], input[type=checkbox], input[type=radio], select, summary, [onclick]';

  function actionable(el) {
    if (!(el instanceof Element)) return null;
    return el.closest(ACTIONABLE) || el;
  }

  // Text fields are identified by their label-ish attributes, not their (changing) value.
  const isField = (el) => el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
    || (el instanceof HTMLInputElement && !['submit', 'button', 'reset', 'image'].includes(el.type));

  function elText(el) {
    const t = (isField(el)
      ? el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || el.type
      : el.getAttribute('aria-label') || el.value || el.innerText || el.textContent || '').trim();
    return t.replace(/\s+/g, ' ').slice(0, 40);
  }

  function elPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && parts.length < 8) {
      let p = cur.tagName.toLowerCase();
      const tid = cur.getAttribute('data-testid') || cur.getAttribute('data-test') || cur.getAttribute('data-cy');
      if (cur.id && !/\d{3,}/.test(cur.id)) { parts.unshift(`${p}#${CSS.escape(cur.id)}`); break; }
      if (tid) p += `[data-testid="${tid}"]`;
      else if (cur.getAttribute('name')) p += `[name="${cur.getAttribute('name')}"]`;
      else if (cur.parentElement) {
        const same = [...cur.parentElement.children].filter((c) => c.tagName === cur.tagName);
        if (same.length > 1) p += `:nth-of-type(${same.indexOf(cur) + 1})`;
      }
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join('>');
  }

  // Key = structural path + visible text. Lookup falls back to tag+text when the path drifts.
  function elementKey(el) {
    el = actionable(el);
    if (!el) return null;
    return `${elPath(el)}::${el.tagName.toLowerCase()}::${elText(el)}`;
  }

  function recordingsFor(el) {
    const key = elementKey(el);
    if (!key) return [];
    if (recordings[key]) return recordings[key];
    const [, tag, text] = key.split('::');
    if (!text) return [];
    for (const [k, v] of Object.entries(recordings)) {
      const [, t2, x2] = k.split('::');
      if (t2 === tag && x2 === text) return v;
    }
    return [];
  }

  // Remember which element the user (or a dry run) just activated.
  // `type` says how to replay it later: click, or input/change for fields.
  const setTrigger = (el, type) => {
    if (el?.closest?.('api-peek-root')) return;
    const key = elementKey(el);
    if (key) state.trigger = { key, type, at: performance.now() };
  };
  const isToggle = (el) => el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
  document.addEventListener('click', (e) => setTrigger(e.target, 'click'), true);
  document.addEventListener('input', (e) => { if (isField(e.target) && !isToggle(e.target)) setTrigger(e.target, 'input'); }, true);
  document.addEventListener('change', (e) => { if (isField(e.target) && !isToggle(e.target)) setTrigger(e.target, 'change'); }, true);
  document.addEventListener('submit', (e) => setTrigger(e.submitter || e.target, 'click'), true);
  // Native (non-JS) form submissions: this bubble listener on window runs after the app's
  // handlers. If nobody prevented default, the browser is about to send the form itself.
  window.addEventListener('submit', (e) => {
    if (e.defaultPrevented) return; // the app handles it with JS (fetch/XHR get captured there)
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (state.captureMode) e.preventDefault(); // dry run: never let a native form navigate
    const method = (e.submitter?.getAttribute('formmethod') || form.method || 'GET').toUpperCase();
    const action = e.submitter?.getAttribute('formaction') || form.action || location.href;
    const fd = new FormData(form, e.submitter || undefined);
    const usp = new URLSearchParams();
    for (const [k, v] of fd) usp.append(k, typeof v === 'string' ? v : v.name);
    let url = new URL(action, location.href);
    let body = null;
    if (method === 'GET') url.search = usp.toString(); else body = usp.toString();
    record({ method, url: url.href, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, bodyKind: body ? 'urlencoded' : null }, 'form');
  });

  // ---------- normalisation
  function headersToObj(h) {
    const out = {};
    if (!h) return out;
    try { new Headers(h).forEach((v, k) => { out[k] = v; }); } catch { /* ignore */ }
    return out;
  }

  function serializeBody(body) {
    if (body == null) return { text: null, kind: null };
    if (typeof body === 'string') {
      const t = body.trim();
      if ((t.startsWith('{') || t.startsWith('[')) && isJson(t)) return { text: body, kind: 'json' };
      return { text: body, kind: 'text' };
    }
    if (body instanceof URLSearchParams) return { text: body.toString(), kind: 'urlencoded' };
    if (body instanceof FormData) {
      const pairs = [];
      for (const [k, v] of body) pairs.push([k, typeof v === 'string' ? v : `[file ${v.name}]`]);
      return { text: JSON.stringify(pairs, null, 2), kind: 'formdata' };
    }
    if (body instanceof Blob) return { text: `[binary ${body.size} bytes]`, kind: 'binary' };
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return { text: `[binary ${body.byteLength} bytes]`, kind: 'binary' };
    return { text: String(body), kind: 'text' };
  }

  function deserializeBody(text, kind) {
    if (kind === 'formdata') {
      const fd = new FormData();
      try { for (const [k, v] of JSON.parse(text)) fd.append(k, v); } catch { /* leave empty */ }
      return fd;
    }
    return text;
  }

  function isJson(t) { try { JSON.parse(t); return true; } catch { return false; } }

  // ---------- stopped endpoints ("Stop capturing"): calls still go out (and rules still apply), they just aren't logged.
  // Keyed like the list's groups: "GET https://host/path". Saved per site.
  const LS_MUTE = '__apiPeek.mute';
  let muted = (() => { try { const v = JSON.parse(localStorage.getItem(LS_MUTE) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } })();
  const muteApi = {
    list: () => Object.entries(muted).map(([key, at]) => ({ key, at })),
    has: (key) => Object.prototype.hasOwnProperty.call(muted, key),
    replace(keys) {
      muted = Object.fromEntries((Array.isArray(keys) ? keys : []).filter((k) => typeof k === 'string').map((k) => [k, Date.now()]));
      try { localStorage.setItem(LS_MUTE, JSON.stringify(muted)); } catch { /* storage blocked */ }
      notify();
    },
    set(key, on) {
      if (on) muted = { ...muted, [key]: Date.now() }; else { const { [key]: _, ...rest } = muted; muted = rest; }
      try { localStorage.setItem(LS_MUTE, JSON.stringify(muted)); } catch { /* storage blocked */ }
      notify();
    },
  };

  // ---------- pinned endpoints: kept at the top of the request list, in this order. Keyed like "Stop capturing"
  // ("GET https://host/path"). Saved per site, so they outlive reloads and Clear.
  const LS_PINS = '__apiPeek.pins';
  let pins = (() => { try { const v = JSON.parse(localStorage.getItem(LS_PINS) || '[]'); return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []; } catch { return []; } })();
  const savePins = () => { try { localStorage.setItem(LS_PINS, JSON.stringify(pins)); } catch { /* storage blocked */ } notify(); };
  const pinsApi = {
    list: () => pins.slice(),
    has: (key) => pins.includes(key),
    set(key, on) { pins = pins.filter((k) => k !== key); if (on) pins.push(key); savePins(); },
    move(key, to) { const i = pins.indexOf(key); if (i < 0) return; pins.splice(i, 1); pins.splice(Math.max(0, Math.min(to, pins.length)), 0, key); savePins(); },
    replace(keys) { pins = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === 'string'))]; savePins(); },
  };

  // ---------- recording
  function record(req, source) {
    const now = performance.now();
    const live = state.trigger && now - state.trigger.at < TRIGGER_WINDOW_MS ? state.trigger : null;
    const trig = live?.key || null;
    const entry = {
      triggerType: live?.type || null,
      id: ++seq,
      source,
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      bodyKind: req.bodyKind,
      triggerKey: trig,
      startedAt: Date.now(),
      status: 'pending',
      responseText: null,
      rewrittenBy: null,
      originalUrl: null,
      originalBody: null,
      dryRun: !!state.captureMode,
      hidden: false,
    };
    entry.group = `${entry.method} ${matchKey(entry.url)}`;
    const stopped = muteApi.has(entry.group);
    if (stopped) entry.hidden = true;
    requestHooks.forEach((fn) => { try { fn(entry); } catch { /* ignore */ } });
    if (entry.hidden) return entry; // hidden from the list: still trapped / rewritten, just not logged
    state.requests.unshift(entry);
    trimGroup(entry.group);
    if (state.requests.length > MAX_REQUESTS) state.requests.length = MAX_REQUESTS;
    if (state.captureMode) state.captureMode.captured.push(entry);
    if (trig) remember(trig, entry);
    notify();
    return entry;
  }

  // Keeps memory flat when the app polls the same endpoint: the newest few calls keep their
  // response body, older ones only their metadata, and very old ones are dropped.
  function trimGroup(group) {
    let n = 0;
    const drop = new Set();
    for (const r of state.requests) {
      if (r.group !== group) continue;
      n++;
      if (n > MAX_PER_ENDPOINT) drop.add(r);
      else if (n > KEEP_BODIES_PER_ENDPOINT && r.responseText) { r.responseText = null; r.responseDropped = true; }
    }
    if (drop.size) state.requests = state.requests.filter((r) => !drop.has(r));
  }

  function remember(key, entry) {
    const list = recordings[key] || [];
    const u = new URL(entry.url);
    const sig = `${entry.method} ${u.origin}${u.pathname}`;
    const item = {
      method: entry.method, url: entry.url, headers: entry.headers,
      body: entry.body && entry.body.length > MAX_BODY ? entry.body.slice(0, MAX_BODY) : entry.body,
      bodyKind: entry.bodyKind, at: entry.startedAt, dryRun: entry.dryRun, sig, triggerKey: key, triggerType: entry.triggerType,
    };
    recordings[key] = [item, ...list.filter((x) => x.sig !== sig)].slice(0, 5);
    save(LS_REC, recordings);
  }

  // ---------- rewrite rules
  // Rule: { id, enabled, method, match: "origin+pathname", label, once,
  //         toMethod: string | null, toPath: "/new/path" or full URL | null,
  //         params: [[k,v],...] | null, headers: [[k,v],...] | null (the full set to send),
  //         body: string | null, bodyKind,
  //         respond: { mode: 'mock' | 'network-error' | 'hang', status, body, contentType } | null,
  //         delayMs: number | null }
  // `method` + `match` identify the app's original call; the rest says what to send instead.
  const matchKey = (url) => { const u = new URL(url, location.href); return u.origin + u.pathname; };
  const NO_BODY = (m) => m === 'GET' || m === 'HEAD';

  // ---------- Offline: every call the app makes fails, as if there's no internet. Per browser tab: kept in
  // sessionStorage, so it survives a reload of this tab (like DevTools' Offline) but not other tabs or a new one.
  const SS_NET = '__apiPeek.offline';
  let net = { offline: (() => { try { return sessionStorage.getItem(SS_NET) === '1'; } catch { return false; } })() };
  const netApi = {
    get: () => net,
    set(patch) {
      net = { offline: !!({ ...net, ...patch }).offline };
      try { if (net.offline) sessionStorage.setItem(SS_NET, '1'); else sessionStorage.removeItem(SS_NET); } catch { /* storage blocked */ }
      try { localStorage.removeItem('__apiPeek.net'); } catch { /* old setting */ }
      notify();
    },
  };
  const netDecision = () => (net.offline ? { respond: { mode: 'network-error' }, tag: 'offline' } : null);

  // Mock endpoints (kind 'mock'): match by path on any host; {name} in the path matches one segment, and
  // {name} in the body is replaced with that value.
  const mockRe = new Map();
  function mockParams(r, url) {
    let re = mockRe.get(r.path);
    if (!re) {
      const names = [];
      const src = String(r.path || '').replace(/\/+$/, '').split(/(\{[^}/]+\})/).map((part) => {
        const m = /^\{([^}/]+)\}$/.exec(part);
        if (m) { names.push(m[1]); return '([^/]+)'; }
        return part.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      }).join('');
      re = { rx: new RegExp(`^${src}/?$`), names };
      mockRe.set(r.path, re);
    }
    let path; try { path = new URL(url, location.href).pathname; } catch { return null; }
    const m = re.rx.exec(path);
    return m ? Object.fromEntries(re.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) : null;
  }
  // The live mock endpoint for this call, with its response (body filled with the path's {values}), or null.
  function findMock(method, url) {
    for (const r of rules) {
      if (!r.enabled || r.kind !== 'mock' || r.method !== method) continue;
      const params = mockParams(r, url);
      if (!params) continue;
      const body = String(r.respond?.body ?? '').replace(/\{([^}/\s"]+)\}/g, (all, n) => (n in params ? params[n] : all));
      return { r, respond: { ...r.respond, mode: 'mock', body } };
    }
    return null;
  }
  function applyRules(method, url, bodyText, bodyKind, origHeaders = null) {
    const key = matchKey(url);
    const hits = rules.filter((r) => r.enabled && r.method === method && r.kind !== 'mock' && r.match === key);
    // A mock endpoint answers only where no rule for the real endpoint does.
    const mock = hits.some((r) => r.respond) ? null : findMock(method, url);
    if (mock) hits.push({ ...mock.r, respond: mock.respond });
    // The app's own calls keep their own login: saved users are only used for your requests (sendCopy).
    const nd = netDecision(url);
    if (!hits.length && !nd) return null;
    let outUrl = url;
    let outMethod = method;
    let outBody = bodyText;
    let outKind = bodyKind;
    let bodyChanged = false;
    let outHeaders = null;
    let respond = null;
    let delayMs = 0;
    for (const r of hits) {
      if (r.respond) respond = r.respond;
      if (r.delayMs > 0) delayMs = Math.max(delayMs, r.delayMs);
      if (r.toPath) {
        const u = new URL(outUrl, location.href);
        const t = new URL(r.toPath, u.origin);
        t.search = u.search;
        outUrl = t.href;
      }
      if (r.toMethod) outMethod = r.toMethod;
      if (r.params) {
        const u = new URL(outUrl, location.href);
        u.search = new URLSearchParams(r.params).toString();
        outUrl = u.href;
      }
      if (r.headers) outHeaders = r.headers;
      if (r.body != null && !NO_BODY(outMethod)) { outBody = r.body; outKind = r.bodyKind || outKind; bodyChanged = true; }
    }
    if (NO_BODY(outMethod) && bodyText != null) { outBody = null; bodyChanged = true; } // GET/HEAD can't carry a body
    // Offline beats every rule.
    let netTag = null;
    if (nd) { respond = nd.respond; netTag = nd.tag; }
    // One-time rules are used up by the first call they rewrite.
    if (hits.some((r) => r.once)) {
      rules = rules.filter((r) => !(r.once && hits.includes(r)));
      save(LS_RULES, rules);
      notify();
    }
    return {
      url: outUrl, method: outMethod, methodChanged: outMethod !== method,
      body: outBody, bodyKind: outKind, bodyChanged,
      headers: outHeaders, headersChanged: !!outHeaders,
      respond, delayMs,
      bodyValue: bodyChanged && outBody != null ? deserializeBody(outBody, outKind) : undefined,
      ruleIds: hits.map((r) => r.id),
      mockPath: mock && !nd ? `${mock.r.method} ${mock.r.path}` : null,
      mockId: mock && !nd ? mock.r.id : null,
      netTag,
    };
  }

  function markRewritten(entry, rw) {
    entry.rewrittenBy = rw.ruleIds.length ? rw.ruleIds : null;
    if (rw.url !== entry.url) { entry.originalUrl = entry.url; entry.url = rw.url; }
    if (rw.methodChanged) { entry.originalMethod = entry.method; entry.method = rw.method; }
    if (rw.bodyChanged) { entry.originalBody = entry.body; entry.body = rw.body; entry.bodyKind = rw.bodyKind; }
    if (rw.headersChanged) { entry.originalHeaders = entry.headers; entry.headers = headersToObj(rw.headers); }
    if (rw.respond) entry.simulated = { mock: `mock ${rw.respond.status}`, hang: 'no response', 'network-error': 'network error' }[rw.respond.mode] || 'simulated';
    if (rw.mockPath) { entry.mocked = rw.mockPath; entry.mockId = rw.mockId; }
    if (rw.delayMs) entry.delayedMs = rw.delayMs;
    if (rw.netTag) entry.netMode = rw.netTag;
  }

  // ---------- simulated responses
  const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);
  const STATUS_TEXT = { 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };
  const statusOf = (r) => Math.min(Math.max(Number(r.status) || 200, 200), 599);
  // Waits `ms`, but gives up early (like a real request) if the app aborts.
  function sleepAbortable(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')); return; }
      const t = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')); }, { once: true });
    });
  }
  const hangForever = (signal) => new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')), { once: true });
  });

  // A body that a rule added to a call which had none needs a content type.
  function withJsonType(headers, rw) {
    const hh = new Headers(rw.headersChanged ? rw.headers : headers || {});
    if (rw.body != null && rw.bodyKind === 'json' && !hh.has('content-type')) hh.set('content-type', 'application/json');
    return hh;
  }

  function captureResponseText(entry, text) {
    if (entry.responseDropped) return; // already trimmed as an old polling call
    entry.responseText = typeof text === 'string' ? text.slice(0, MAX_RESPONSE) : null;
    entry.responseSize = typeof text === 'string' ? text.length : null;
    if (entry.group && !entry.hidden) trimGroup(entry.group);
    notify();
  }

  // ---------- breakpoints: hold the app's call until the user continues, edits or drops it
  const LS_BREAKS = '__apiPeek.breaks';
  let breaks = load(LS_BREAKS, []); // { id, method, match, once, enabled }
  state.paused = []; // [{ entry, resolve }]
  const pauseHooks = new Set();
  const abortError = (signal) => signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError');

  function pauseIfNeeded(entry, signal) {
    const k = matchKey(entry.url);
    const b = breaks.find((x) => x.enabled && x.method === entry.method && x.match === k);
    if (!b) return null;
    if (b.once) { breaks = breaks.filter((x) => x !== b); save(LS_BREAKS, breaks); }
    entry.status = 'paused';
    entry.paused = true;
    return new Promise((resolve) => {
      const item = {
        entry,
        resolve: (decision) => {
          if (!state.paused.includes(item)) return;
          state.paused = state.paused.filter((x) => x !== item);
          entry.paused = false;
          resolve(decision);
          notify();
        },
      };
      state.paused.push(item);
      signal?.addEventListener('abort', () => item.resolve({ action: 'aborted' }), { once: true });
      notify();
      pauseHooks.forEach((fn) => { try { fn(entry); } catch { /* ignore */ } });
    });
  }

  // decision: { action: 'edited', req } | { action: 'original' } | { action: 'drop' }
  function resume(id, decision) {
    const item = state.paused.find((x) => x.entry.id === id);
    if (item) item.resolve(decision);
    return !!item;
  }

  // The edited request from the paused screen, in the same shape applyRules returns.
  function editedToRw(entry, req) {
    const body = NO_BODY(req.method) ? null : (req.body ?? null);
    entry.pausedEdited = true;
    return {
      url: req.url, method: req.method, methodChanged: req.method !== entry.method,
      body, bodyKind: req.bodyKind, bodyChanged: true,
      bodyValue: body != null ? deserializeBody(body, req.bodyKind) : undefined,
      headers: Object.entries(req.headers || {}), headersChanged: true,
      respond: req.respond || null, delayMs: req.delayMs || 0,
      ruleIds: ['paused'],
    };
  }

  // Undo: put removed items back at their old positions, unchanged. Skips any whose endpoint got a new item meanwhile.
  function restoreInto(list, items) {
    const out = list.slice();
    [...items].sort((a, b) => a.index - b.index).forEach(({ item, index }) => {
      if (out.some((x) => x.id === item.id || (x.method === item.method && x.match === item.match))) return;
      out.splice(Math.min(index, out.length), 0, item);
    });
    return out;
  }
  const breaksApi = {
    list: () => breaks,
    restore(items) { breaks = restoreInto(breaks, items); save(LS_BREAKS, breaks); notify(); },
    replace(list) { breaks = Array.isArray(list) ? list.map((b) => ({ ...b })) : []; save(LS_BREAKS, breaks); notify(); },
    add({ method, match, once }) {
      breaks = breaks.filter((b) => !(b.method === method && b.match === match));
      breaks.push({ id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, method, match, once: !!once, enabled: true });
      save(LS_BREAKS, breaks); notify();
    },
    find: (method, match) => breaks.find((b) => b.method === method && b.match === match) || null,
    toggle(id, on) { const b = breaks.find((x) => x.id === id); if (b) { b.enabled = on; save(LS_BREAKS, breaks); notify(); } },
    remove(id) { breaks = breaks.filter((b) => b.id !== id); save(LS_BREAKS, breaks); notify(); },
    clear() { breaks = []; save(LS_BREAKS, breaks); notify(); },
  };

  // ---------- fetch
  async function describeFetch(input, init) {
    init = init || {};
    if (input instanceof Request) {
      const method = (init.method || input.method || 'GET').toUpperCase();
      const headers = { ...headersToObj(input.headers), ...headersToObj(init.headers) };
      let ser;
      if (init.body !== undefined) ser = serializeBody(init.body);
      else if (method !== 'GET' && method !== 'HEAD') ser = serializeBody(await input.clone().text());
      else ser = { text: null, kind: null };
      return { method, url: new URL(input.url, location.href).href, headers, body: ser.text, bodyKind: ser.kind };
    }
    const method = (init.method || 'GET').toUpperCase();
    const ser = serializeBody(init.body);
    return { method, url: new URL(String(input), location.href).href, headers: headersToObj(init.headers), body: ser.text, bodyKind: ser.kind };
  }

  window.fetch = async function apiPeekFetch(input, init) {
    if (bypass()) return origFetch(input, init);
    let desc;
    try { desc = await describeFetch(input, init); } catch { return origFetch(input, init); }
    const entry = record(desc, 'fetch');
    if (state.captureMode) return new Promise(() => {}); // dry run: request never leaves the page

    let fInput = input;
    let fInit = init;
    const signal = (init && init.signal) || (input instanceof Request ? input.signal : undefined);
    const decision = await pauseIfNeeded(entry, signal);
    if (decision?.action === 'aborted') { entry.status = 'aborted'; notify(); throw abortError(signal); }
    if (decision?.action === 'drop') {
      entry.status = 'dropped'; entry.durationMs = Date.now() - entry.startedAt; notify();
      throw new TypeError('Failed to fetch');
    }
    const rw = decision?.action === 'edited'
      ? editedToRw(entry, decision.req)
      : applyRules(desc.method, desc.url, desc.body, desc.bodyKind, desc.headers);
    if (rw) {
      markRewritten(entry, rw);
      if (input instanceof Request && !rw.methodChanged && !rw.bodyChanged && !rw.headersChanged) {
        fInput = new Request(rw.url, input);
      } else if (input instanceof Request) {
        // Rebuild from scratch: a Request can't switch to GET while it still holds a body.
        fInput = rw.url;
        fInit = {
          method: rw.method,
          headers: withJsonType({ ...desc.headers }, rw),
          credentials: input.credentials, cache: input.cache, redirect: input.redirect,
          referrer: input.referrer, referrerPolicy: input.referrerPolicy, integrity: input.integrity,
          keepalive: input.keepalive, signal: input.signal,
          ...(input.mode && input.mode !== 'navigate' ? { mode: input.mode } : {}),
        };
        if (!NO_BODY(rw.method)) fInit.body = rw.bodyChanged ? rw.bodyValue : await input.clone().arrayBuffer();
      } else {
        fInput = rw.url;
        fInit = { ...(init || {}), method: rw.method };
        if (rw.bodyChanged) {
          if (rw.bodyValue === undefined) delete fInit.body; else fInit.body = rw.bodyValue;
          fInit.headers = withJsonType(fInit.headers, rw);
        } else if (rw.headersChanged) {
          fInit.headers = new Headers(rw.headers);
        }
      }
    }
    if (rw?.delayMs) {
      try { await sleepAbortable(rw.delayMs, signal); } catch (err) { entry.status = 'aborted'; notify(); throw err; }
    }
    if (rw?.respond) {
      const r = rw.respond;
      entry.durationMs = Date.now() - entry.startedAt;
      if (r.mode === 'network-error') { entry.status = 'error'; notify(); throw new TypeError('Failed to fetch'); }
      if (r.mode === 'hang') {
        entry.status = 'no response';
        notify();
        try { return await hangForever(signal); } catch (err) { entry.status = 'aborted'; notify(); throw err; }
      }
      const status = statusOf(r);
      const ct = r.contentType || 'application/json';
      const res = new Response(NULL_BODY_STATUS.has(status) ? null : (r.body ?? ''), { status, statusText: STATUS_TEXT[status] || '', headers: { 'content-type': ct } });
      entry.status = status;
      entry.responseHeaders = [['content-type', ct]];
      captureResponseText(entry, NULL_BODY_STATUS.has(status) ? '' : (r.body ?? ''));
      return res;
    }
    try {
      const res = await origFetch(fInput, fInit);
      entry.status = res.status;
      entry.durationMs = Date.now() - entry.startedAt;
      try { entry.responseHeaders = [...res.headers]; } catch { /* ignore */ }
      notify();
      const ct = res.headers.get('content-type') || '';
      if (/json|text|xml|javascript/.test(ct) || !ct) res.clone().text().then((t) => captureResponseText(entry, t), () => {});
      return res;
    } catch (err) {
      entry.status = 'error';
      entry.durationMs = Date.now() - entry.startedAt;
      notify();
      throw err;
    }
  };

  // ---------- XMLHttpRequest
  XHR.prototype.open = function (method, url, ...rest) {
    this.__apiPeek = { method: String(method).toUpperCase(), url: new URL(String(url), location.href).href, headers: {}, rest };
    return xhrOpen.call(this, method, url, ...rest);
  };
  XHR.prototype.setRequestHeader = function (k, v) {
    if (this.__apiPeek) this.__apiPeek.headers[String(k).toLowerCase()] = v;
    return xhrSetHeader.call(this, k, v);
  };
  XHR.prototype.send = function (body) {
    const m = this.__apiPeek;
    if (!m || bypass()) return xhrSend.call(this, body);
    const xhr = this;
    const ser = serializeBody(body);
    const entry = record({ method: m.method, url: m.url, headers: m.headers, body: ser.text, bodyKind: ser.kind }, 'xhr');
    if (state.captureMode) return undefined; // dry run: never sent

    const attachLoadend = () => xhr.addEventListener('loadend', () => {
      entry.status = xhr.status || 'error';
      entry.durationMs = Date.now() - entry.startedAt;
      try {
        entry.responseHeaders = xhr.getAllResponseHeaders().trim().split(/\r?\n/).filter(Boolean)
          .map((line) => { const i = line.indexOf(':'); return [line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]; });
      } catch { /* ignore */ }
      try {
        if (xhr.responseType === '' || xhr.responseType === 'text') captureResponseText(entry, xhr.responseText);
        else if (xhr.responseType === 'json') captureResponseText(entry, JSON.stringify(xhr.response));
        else notify();
      } catch { notify(); }
    });

    // Held back (breakpoint, delay or simulation): an app abort() must still work.
    let cancelled = false;
    let timer = null;
    const holdAbort = () => Object.defineProperty(xhr, 'abort', { configurable: true, value: () => {
      cancelled = true;
      clearTimeout(timer);
      if (entry.paused) resume(entry.id, { action: 'aborted' });
      entry.status = 'aborted';
      notify();
      XHR.prototype.abort.call(xhr);
    } });

    const run = (rw) => {
      if (cancelled) return;
      let sendBody = body;
      if (rw) {
        markRewritten(entry, rw);
        const sendHeaders = rw.headersChanged ? rw.headers : Object.entries(m.headers);
        if (rw.url !== m.url || rw.methodChanged || rw.headersChanged) {
          xhrOpen.call(xhr, rw.method, rw.url, ...m.rest); // re-open clears headers, so set the ones to send
          for (const [k, v] of sendHeaders) { try { xhrSetHeader.call(xhr, k, v); } catch { /* forbidden or invalid name */ } }
        }
        if (rw.bodyChanged) {
          sendBody = rw.bodyValue ?? null;
          if (rw.body != null && rw.bodyKind === 'json' && !sendHeaders.some(([k]) => String(k).toLowerCase() === 'content-type')) xhrSetHeader.call(xhr, 'content-type', 'application/json');
        }
      }
      const go = () => {
        if (cancelled) return;
        if (rw?.respond) fakeXhrResponse(xhr, entry, rw.respond);
        else { attachLoadend(); xhrSend.call(xhr, sendBody); }
      };
      if (rw?.delayMs) { holdAbort(); timer = setTimeout(go, rw.delayMs); } else go();
    };

    const paused = m.rest[0] === false ? null : pauseIfNeeded(entry); // synchronous XHR can't be held
    if (!paused) { run(applyRules(m.method, m.url, ser.text, ser.kind, m.headers)); return undefined; }
    holdAbort();
    paused.then((decision) => {
      if (decision.action === 'aborted' || cancelled) return;
      if (decision.action === 'drop') {
        fakeXhrResponse(xhr, entry, { mode: 'network-error' });
        entry.status = 'dropped';
        notify();
        return;
      }
      run(decision.action === 'edited' ? editedToRw(entry, decision.req) : applyRules(m.method, m.url, ser.text, ser.kind, m.headers));
    });
    return undefined;
  };

  // Makes an unsent XHR look finished: own properties shadow the prototype getters, then the
  // usual events fire (which also runs onload / onreadystatechange / onerror handlers).
  function fakeXhrResponse(xhr, entry, r) {
    const def = (k, v) => Object.defineProperty(xhr, k, { configurable: true, get: () => v });
    const fire = (type) => xhr.dispatchEvent(new ProgressEvent(type));
    entry.durationMs = Date.now() - entry.startedAt;
    if (r.mode === 'hang') { entry.status = 'no response'; notify(); return; }
    if (r.mode === 'network-error') {
      def('readyState', 4); def('status', 0); def('statusText', '');
      entry.status = 'error'; notify();
      xhr.dispatchEvent(new Event('readystatechange')); fire('error'); fire('loadend');
      return;
    }
    const status = statusOf(r);
    const ct = r.contentType || 'application/json';
    const text = NULL_BODY_STATUS.has(status) ? '' : String(r.body ?? '');
    let response = text;
    if (xhr.responseType === 'json') { try { response = text ? JSON.parse(text) : null; } catch { response = null; } }
    else if (xhr.responseType === 'blob') response = new Blob([text], { type: ct });
    else if (xhr.responseType === 'arraybuffer') response = new TextEncoder().encode(text).buffer;
    else if (xhr.responseType === 'document') response = null;
    def('readyState', 4); def('status', status); def('statusText', STATUS_TEXT[status] || '');
    def('response', response);
    if (xhr.responseType === '' || xhr.responseType === 'text') def('responseText', text);
    def('responseURL', entry.url);
    Object.defineProperty(xhr, 'getAllResponseHeaders', { configurable: true, value: () => `content-type: ${ct}\r\n` });
    Object.defineProperty(xhr, 'getResponseHeader', { configurable: true, value: (n) => (String(n).toLowerCase() === 'content-type' ? ct : null) });
    entry.status = status;
    entry.responseHeaders = [['content-type', ct]];
    captureResponseText(entry, text);
    xhr.dispatchEvent(new Event('readystatechange')); fire('load'); fire('loadend');
  }

  // ---------- dry run: click the element with requests trapped, collect what it would send
  // Ends 300 ms after the last captured request, or after `ms` if nothing is sent.
  let idleWaiters = [];
  async function dryRun(el, ms = 1500) {
    const target = actionable(el);
    const mode = { captured: [], lastAt: 0 };
    state.captureMode = mode;
    const t0 = performance.now();
    try {
      target.click();
      for (;;) {
        await new Promise((r) => setTimeout(r, 50));
        const now = performance.now();
        if (mode.captured.length) {
          mode.lastAt = mode.lastAt || now;
          if (mode.captured.length !== mode.seen) { mode.seen = mode.captured.length; mode.lastAt = now; }
          if (now - mode.lastAt >= 300) break;
        } else if (now - t0 >= ms) break;
      }
      return mode.captured;
    } finally {
      state.captureMode = null;
      idleWaiters.forEach((fn) => fn());
      idleWaiters = [];
      notify();
    }
  }
  // ---------- "Apply to app": make the app itself repeat a call (a rule then rewrites it)
  function findByKey(key) {
    if (!key) return null;
    const [path, tag, text] = key.split('::');
    try { for (const el of document.querySelectorAll(path)) if (elText(el) === text) return el; } catch { /* bad selector */ }
    if (text) for (const el of document.getElementsByTagName(tag)) if (elText(el) === text && !el.closest('api-peek-root')) return el;
    return null;
  }

  function replayTrigger(el, type) {
    if ((type === 'input' || type === 'change') && isField(el)) {
      // React ignores input events whose value didn't change; reset its value tracker first.
      const v = el.value;
      try { el._valueTracker?.setValue?.(`${v}​`); } catch { /* not React */ }
      const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
      try { desc?.set?.call(el, v); } catch { /* ignore */ }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (el.form && type === 'change' && el instanceof HTMLInputElement && el.type === 'search') el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else {
      el.click();
    }
  }

  // React Query / SWR / RTK Query refetch on focus, visibility and reconnect.
  function nudgeRefetch() {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    window.dispatchEvent(new Event('online'));
  }

  function waitForCall(method, mk, ms) {
    return new Promise((resolve) => {
      let hook;
      const timer = setTimeout(() => { requestHooks.delete(hook); resolve(null); }, ms);
      hook = (e) => {
        if (e.method === method && matchKey(e.url) === mk && !e.dryRun) {
          clearTimeout(timer); requestHooks.delete(hook); resolve(e);
        }
      };
      requestHooks.add(hook);
    });
  }

  // Returns { how: 'rerun' | 'refocus' | null, entry }
  async function applyToApp(entry, { onStep } = {}) {
    await whenIdle();
    const mk = matchKey(entry.originalUrl || entry.url);
    const origMethod = entry.originalMethod || entry.method;
    const el = findByKey(entry.triggerKey);
    if (el && !isToggle(el)) {
      onStep?.('rerun', el);
      const wait = waitForCall(origMethod, mk, 1500);
      replayTrigger(el, entry.triggerType || 'click');
      const hit = await wait;
      if (hit) return { how: 'rerun', entry: hit, el };
    }
    onStep?.('refocus');
    const wait = waitForCall(origMethod, mk, 1500);
    nudgeRefetch();
    const hit = await wait;
    if (hit) return { how: 'refocus', entry: hit };
    return { how: null };
  }

  const whenIdle = () => (state.captureMode ? new Promise((r) => idleWaiters.push(r)) : Promise.resolve());

  // ---------- find which loaded response populated a table / list
  function findDataSource(el) {
    const container = el.closest('table, [role=grid], [role=table], [role=list], ul, ol, tbody') || el;
    let texts = [...container.querySelectorAll('td, th, li, [role=gridcell], [role=cell], [role=listitem]')]
      .map((n) => (n.innerText || n.textContent || '').trim());
    if (!texts.length) texts = (container.innerText || '').split('\n');
    texts = [...new Set(texts.map((t) => t.trim()).filter((t) => t.length >= 2 && t.length <= 80))].slice(0, 40);
    if (!texts.length) return [];
    const scored = [];
    for (const r of state.requests) {
      if (!r.responseText || r.dryRun) continue;
      let hits = 0;
      for (const t of texts) {
        if (r.responseText.includes(t) || r.responseText.includes(JSON.stringify(t).slice(1, -1))) hits++;
      }
      if (hits >= 2 || hits / texts.length >= 0.3) scored.push({ entry: r, hits, total: texts.length, score: hits / texts.length });
    }
    // Best match first; on a tie, the newest request (it's what the element shows now).
    scored.sort((a, b) => b.score - a.score || b.entry.id - a.entry.id);
    const seen = new Set();
    return scored.filter((s) => { const k = `${s.entry.method} ${matchKey(s.entry.url)}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3);
  }

  // ---------- send an edited copy outside the app (doesn't touch app state)
  const FORBIDDEN = /^(host|content-length|cookie|origin|referer|connection|accept-encoding|sec-|proxy-)/i;
  // asUser: 'app' (the request's own headers, no saved user), a saved user, or undefined (the picked user).
  async function sendCopy({ method, url, headers, body, bodyKind, noAuth = false, asUser }) {
    let h = {};
    for (const [k, v] of Object.entries(headers || {})) if (!FORBIDDEN.test(k)) h[k] = v;
    const prof = noAuth || asUser === 'app' ? null : asUser && typeof asUser === 'object' ? asUser : activeProfile();
    if (prof) h = Object.fromEntries(withHeader(Object.entries(h), prof.header || 'Authorization', prof.value, true).out);
    const init = { method, headers: h, credentials: 'include' };
    if (body != null && method !== 'GET' && method !== 'HEAD') init.body = deserializeBody(body, bodyKind);
    if (bodyKind === 'formdata') delete h['content-type'];
    const t0 = performance.now();
    // A mock endpoint answers your requests too (Run, Bulk, API Docs), without the network.
    const mk = findMock(String(method).toUpperCase(), url);
    if (mk) {
      if (mk.r.delayMs > 0) await new Promise((r) => setTimeout(r, mk.r.delayMs));
      const st = statusOf(mk.respond); const ct = mk.respond.contentType || 'application/json';
      const text = NULL_BODY_STATUS.has(st) ? '' : mk.respond.body;
      return { status: st, statusText: STATUS_TEXT[st] || '', ms: Math.round(performance.now() - t0), text, contentType: ct, headers: [['content-type', ct]], asProfile: null, mocked: `${mk.r.method} ${mk.r.path}`, mockId: mk.r.id };
    }
    // Another server (an environment) often allows the page's origin but not its cookies:
    // if sending with credentials fails there, try once more without them.
    const cross = (() => { try { return new URL(url, location.href).origin !== location.origin; } catch { return false; } })();
    let res;
    try { res = await origFetch(url, init); } catch (err) {
      if (!cross) throw err;
      res = await origFetch(url, { ...init, credentials: 'omit' });
    }
    const text = await res.text();
    return { status: res.status, statusText: res.statusText, ms: Math.round(performance.now() - t0), text, contentType: res.headers.get('content-type') || '', headers: [...res.headers], asProfile: prof ? prof.name : null };
  }

  const authApi = {
    get: () => auth,
    active: () => activeProfile(),
    // next: any of { profiles, active, app }
    set(next) { auth = { ...auth, ...next }; if (auth.active && !auth.profiles.some((x) => x.id === auth.active)) auth.active = null; save(LS_AUTH, auth); notify(); },
  };

  // ---------- rules API
  const rulesApi = {
    list: () => rules,
    upsert(rule) {
      const i = rules.findIndex((r) => r.method === rule.method && r.match === rule.match);
      const full = { enabled: true, id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...rule };
      if (i >= 0) rules[i] = { ...rules[i], ...full, id: rules[i].id }; else rules.push(full);
      save(LS_RULES, rules); notify();
      return i >= 0 ? rules[i] : full;
    },
    toggle(id, on) { const r = rules.find((x) => x.id === id); if (r) { r.enabled = on; save(LS_RULES, rules); notify(); } },
    remove(id) { rules = rules.filter((r) => r.id !== id); save(LS_RULES, rules); notify(); },
    clear() { rules = []; save(LS_RULES, rules); notify(); },
    restore(items) { rules = restoreInto(rules, items); save(LS_RULES, rules); notify(); },
    replace(list) { rules = Array.isArray(list) ? list.map((r) => ({ ...r })) : []; save(LS_RULES, rules); notify(); },
  };

  Object.defineProperty(window, '__apiPeekCore', {
    value: Object.freeze({
      state, rules: rulesApi, actionable, elementKey, elText, recordingsFor, findDataSource,
      dryRun, whenIdle, sendCopy, matchKey, isJson, applyToApp, findByKey, capture: captureApi, mute: muteApi, pins: pinsApi,
      breaks: breaksApi, resume, auth: authApi, net: netApi,
      onPause: (fn) => { pauseHooks.add(fn); return () => pauseHooks.delete(fn); },
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      clearRecordings: () => { recordings = {}; save(LS_REC, recordings); notify(); },
      clearRequests: () => { state.requests = []; notify(); },
      refresh: () => notify(),
    rawFetch: (...a) => origFetch(...a), // not recorded, not rewritten
      // A request you build yourself (New request / Import cURL): listed, never sent by the app.
      addManual({ method = 'GET', url = `${location.origin}/`, headers = {}, body = null, bodyKind = null } = {}) {
        const abs = new URL(url, location.href).href;
        const entry = {
          id: ++seq, source: 'manual', manual: true, method, url: abs, headers, body, bodyKind,
          triggerKey: null, triggerType: null, startedAt: Date.now(), status: 'draft', responseText: null,
          rewrittenBy: null, originalUrl: null, originalBody: null, dryRun: false, hidden: false,
          group: `${method} ${matchKey(abs)}`,
        };
        state.requests.unshift(entry);
        notify();
        return entry;
      },
    }),
    enumerable: false,
  });
})();
