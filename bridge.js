if (!globalThis.__restlessBridge) {
globalThis.__restlessBridge = true;
// RESTless — isolated-world bridge between the extension and the MAIN-world UI:
// relays context-menu / toolbar / shortcut messages, the toolbar badge, and syncs preferences.
const DEFAULT_PREFS = { modifier: 'ctrl', action: 'click', dock: 'push', width: 460, theme: 'dark', position: 'right', height: 340, float: null, maxTabs: 5 };
const postPrefs = (prefs) => window.postMessage({ __apiPeek: 'prefs', prefs: { ...DEFAULT_PREFS, ...(prefs || {}) } }, '*');
const sendStored = () => chrome.storage.sync.get('prefs').then(({ prefs }) => postPrefs(prefs), () => postPrefs());

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'log') { window.postMessage({ __apiPeek: msg.type }, '*'); sendResponse({ ok: true }); }
});

// Calls into the service worker fail harmlessly if the extension was reloaded under this page.
const toWorker = (msg) => { try { return chrome.runtime.sendMessage(msg).catch(() => null); } catch { return Promise.resolve(null); } };

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data) return;
  if (e.data.__apiPeek === 'getPrefs') sendStored();
  if (e.data.__apiPeek === 'badge' && window === window.top) {
    toWorker({ type: 'badge', count: Number(e.data.count) || 0, paused: Number(e.data.paused) || 0, offline: e.data.offline === true });
  }
  if (e.data.__apiPeek === 'getShortcuts') {
    toWorker({ type: 'getShortcuts' }).then((list) => { if (Array.isArray(list)) window.postMessage({ __apiPeek: 'shortcuts', list }, '*'); });
  }
  if (e.data.__apiPeek === 'openShortcuts') toWorker({ type: 'openShortcuts' });
  if (e.data.__apiPeek === 'savePrefs' && e.data.prefs) {
    const p = e.data.prefs;
    const num = (v, lo, hi) => (Number.isFinite(v) ? Math.round(Math.min(Math.max(v, lo), hi)) : null);
    const ok = ['ctrl', 'alt', 'shift', 'meta'].includes(p.modifier) && ['click', 'hover'].includes(p.action)
      && ['push', 'overlay'].includes(p.dock) && ['light', 'dark', 'system'].includes(p.theme)
      && ['right', 'left', 'top', 'bottom', 'float'].includes(p.position);
    if (ok) {
      const f = p.float && typeof p.float === 'object'
        ? { x: num(p.float.x, 0, 10000), y: num(p.float.y, 0, 10000), w: num(p.float.w, 200, 10000), h: num(p.float.h, 200, 10000) }
        : null;
      chrome.storage.sync.set({ prefs: {
        modifier: p.modifier, action: p.action, dock: p.dock, theme: p.theme, position: p.position,
        width: num(p.width, 320, 4000) ?? DEFAULT_PREFS.width,
        height: num(p.height, 200, 4000) ?? DEFAULT_PREFS.height,
        float: f,
        maxTabs: num(p.maxTabs, 1, 20) ?? DEFAULT_PREFS.maxTabs,
      } });
    }
  }
});

// Other tabs pick up a change right away.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.prefs) postPrefs(changes.prefs.newValue);
});

sendStored(); // in case the UI asked before this script was listening
}
