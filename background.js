// RESTless — service worker: toolbar icon + badge, keyboard shortcut.

// Tabs that were open before the extension was installed or reloaded have no content script, so the
// message has no receiver. Then the scripts are injected into that tab (allowed by activeTab, which the
// icon click or shortcut grants) and the panel is opened. Requests made before that aren't captured.
const send = (tabId, type) => chrome.tabs.sendMessage(tabId, { type }, { frameId: 0 });
const noReceiver = (e) => /Receiving end does not exist|Could not establish connection/i.test(String(e?.message || e));
async function inject(tabId) {
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ['core.js', 'openapi.js', 'ui.js'], world: 'MAIN', injectImmediately: true });
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ['bridge.js'], injectImmediately: true });
}
async function toggle(tab, type = 'log') {
  if (!tab?.id) return;
  try { await send(tab.id, type); return; } catch (e) { if (!noReceiver(e)) return; }
  try {
    await inject(tab.id);
    await send(tab.id, type);
  } catch {
    // chrome:// pages, the Chrome Web Store, the New Tab page and PDFs can't run extensions.
    chrome.action.setTitle({ tabId: tab.id, title: 'RESTless can\'t run on this page (Chrome blocks extensions here). Open your app\'s page and click again.' }).catch(() => {});
    chrome.action.setBadgeText({ tabId: tab.id, text: '!' }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#d97706' }).catch(() => {});
  }
}

// Toolbar icon and the "toggle-panel" shortcut both show / hide the panel.
chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener((command, tab) => {
  const type = { 'toggle-panel': 'log' }[command];
  if (!type) return;
  if (tab) toggle(tab, type);
  else chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => toggle(t, type));
});

const BLUE = '#3b6cff';
const ORANGE = '#d97706';
const RED = '#dc2626';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'badge' && sender.tab?.id != null && sender.frameId === 0) {
    const tabId = sender.tab.id;
    const { count = 0, paused = 0, offline = false } = msg;
    // Offline wins (the whole tab has no network), then paused calls, so they're hard to miss.
    const text = offline ? 'OFF' : paused ? `‖${paused}` : count ? (count > 999 ? '999+' : String(count)) : '';
    chrome.action.setBadgeText({ tabId, text }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId, color: offline ? RED : paused ? ORANGE : BLUE }).catch(() => {});
    if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' }).catch(() => {});
    chrome.action.setTitle({
      tabId,
      title: offline ? 'RESTless: this tab is offline. Every call the app makes fails.' : paused ? `RESTless: ${paused} call${paused === 1 ? '' : 's'} paused` : `RESTless: ${count} request${count === 1 ? '' : 's'} captured. Click to show or hide.`,
    }).catch(() => {});
    return false;
  }
  if (msg?.type === 'getShortcuts') {
    chrome.commands.getAll().then((list) => sendResponse(list.map(({ name, shortcut, description }) => ({ name, shortcut, description }))));
    return true; // async response
  }
  if (msg?.type === 'openShortcuts') {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    return false;
  }
  return false;
});
