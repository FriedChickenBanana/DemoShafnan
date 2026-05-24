import { MSG } from './shared/messages.js';

const BACKEND_URL = 'http://localhost:3000';
const SHARED_SECRET = '91969f00c52bd04936f46202f665af0907a9fc6cc07b89b968bc80cb769d2c9b';

// ── Session ID ──────────────────────────────────────────────────────────────
async function getOrCreateSessionId() {
  return new Promise((resolve) => {
    chrome.storage.local.get('sessionId', ({ sessionId }) => {
      if (sessionId) return resolve(sessionId);
      const newId = crypto.randomUUID();
      chrome.storage.local.set({ sessionId: newId }, () => resolve(newId));
    });
  });
}

// ── HMAC signing ─────────────────────────────────────────────────────────────
async function signRequest(body) {
  const timestamp = Date.now().toString();
  const message = timestamp + JSON.stringify(body);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SHARED_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { timestamp, signature: sigHex };
}

// ── API call helper ──────────────────────────────────────────────────────────
async function callBackend(path, body) {
  const sessionId = await getOrCreateSessionId();
  const { timestamp, signature } = await signRequest(body);
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
}

// ── Context menu ─────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'factcheck-selection',
    title: 'TruthLens: Fact-check this claim',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'analyse-area',
    title: 'TruthLens: Analyse selected area',
    contexts: ['page', 'image'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'factcheck-selection' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, { type: MSG.SHOW_VERDICT, status: 'loading', text: info.selectionText });
    try {
      const result = await callBackend('/factcheck/text', { text: info.selectionText });
      chrome.tabs.sendMessage(tab.id, { type: MSG.SHOW_VERDICT, status: 'done', result, text: info.selectionText });
    } catch (err) {
      chrome.tabs.sendMessage(tab.id, { type: MSG.SHOW_VERDICT, status: 'error', error: err.message });
    }
  }
  if (info.menuItemId === 'analyse-area') {
    chrome.tabs.sendMessage(tab.id, { type: 'START_REGION_DRAW' });
  }
});

// ── Message handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === MSG.GET_SESSION_ID) {
    getOrCreateSessionId().then(sendResponse);
    return true; // async
  }

  if (msg.type === MSG.FACTCHECK_TEXT) {
    callBackend('/factcheck/text', { text: msg.text })
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'CAPTURE_AND_CROP') {
    // captureVisibleTab requires activeTab permission, triggered by user gesture
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true;
  }

  if (msg.type === MSG.FACTCHECK_IMAGE) {
    callBackend('/factcheck/image', { imageBase64: msg.imageBase64 })
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
