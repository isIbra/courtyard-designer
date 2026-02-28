/**
 * WebSocket relay — bridges HTTP API requests to the single connected browser tab.
 *
 * State:
 *   browserSocket — the single connected browser tab
 *   pending — reqId -> { resolve, reject, timer }
 */

let browserSocket = null;
const pending = new Map();
const TIMEOUT = 8000;
let reqCounter = 0;

export function handleUpgrade(ws) {
  // Only one browser tab at a time
  if (browserSocket) {
    try { browserSocket.close(); } catch {}
  }
  browserSocket = ws;
  console.log('[WS-Relay] Browser connected');

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const { reqId, ok, result, error } = msg;
    if (!reqId) return;

    const entry = pending.get(reqId);
    if (!entry) return;
    pending.delete(reqId);
    clearTimeout(entry.timer);

    if (ok) {
      entry.resolve(result);
    } else {
      entry.reject(new Error(error || 'Unknown error from browser'));
    }
  });

  ws.on('close', () => {
    console.log('[WS-Relay] Browser disconnected');
    if (browserSocket === ws) browserSocket = null;
    // Reject all pending
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Browser disconnected'));
      pending.delete(id);
    }
  });

  ws.on('error', () => {
    // close will fire after this
  });
}

export function relay(method, params) {
  return new Promise((resolve, reject) => {
    if (!browserSocket || browserSocket.readyState !== 1) {
      return reject(new Error('No browser connected'));
    }

    const reqId = `r${++reqCounter}`;
    const timer = setTimeout(() => {
      pending.delete(reqId);
      reject(new Error(`Timeout waiting for browser response (${method})`));
    }, TIMEOUT);

    pending.set(reqId, { resolve, reject, timer });

    browserSocket.send(JSON.stringify({ reqId, method, params }));
  });
}

export function isConnected() {
  return browserSocket !== null && browserSocket.readyState === 1;
}
