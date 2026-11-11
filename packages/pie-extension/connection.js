import { isNonce, randomNonce, sameText, sign } from './crypto.js';
import {
  ACTIONS,
  CLOSE,
  MAX_MESSAGE_BYTES,
  MSG,
  PING_MS,
  PORT,
  TOO_LARGE,
  appProofText,
  extProofText,
} from './protocol.js';

// Extensions can't accept connections, so the service worker connects out to
// Pie Launcher. Its state is saved as `pieStatus` for the popup:
//   no-code | connected | not-connected | bad-code | replaced

// Quick retries after a drop, then the 30-second alarm takes over.
const RETRY_DELAYS_MS = [1000, 3000, 10000];
// These wait for a new code, Connect, or Chrome starting, never a timer.
const WAITING = new Set(['bad-code', 'replaced']);
// Except a refused code, tried again this rarely from the 30-second alarm:
// the app may have been set back to this code, or its database restored.
// "replaced" keeps waiting: retrying would take the link back and forth
// with the other Chrome.
const BAD_CODE_RETRY_MS = 5 * 60 * 1000;
const OPEN = 1;
const encoder = new TextEncoder();
// Actions that take over the tab (the debugger, scrolling, focus), so two
// can't run at once. Everything else runs as soon as it arrives.
const ONE_AT_A_TIME = new Set(['capture']);
// How long the app waits when a request doesn't say, as in chrome-bridge.ts.
const DEFAULT_REQUEST_MS = 10000;
const MAX_REQUEST_MS = 5 * 60 * 1000;

// When the app stops waiting for this request.
function deadlineOf(message) {
  const ms = message.timeoutMs;
  const wait =
    Number.isFinite(ms) && ms > 0
      ? Math.min(ms, MAX_REQUEST_MS)
      : DEFAULT_REQUEST_MS;
  return Date.now() + wait;
}

const asText = (data) => (typeof data === 'string' ? data : String(data));

function parse(data) {
  try {
    return JSON.parse(asText(data));
  } catch {
    return null;
  }
}

// Only the fixed list of actions can run. Nothing the app sends is ever run
// as a script.
export function createRequestHandler(actions) {
  return async (action, args) => {
    if (!ACTIONS.includes(action) || !Object.hasOwn(actions, action)) {
      return { ok: false, error: 'unknown-action' };
    }
    try {
      return { ok: true, result: (await actions[action](args)) ?? null };
    } catch {
      return { ok: false, error: 'failed' };
    }
  };
}

export function replyText(id, reply) {
  const text = JSON.stringify({ type: MSG.REPLY, id, ...reply });
  // A character takes at most 3 bytes, so most replies skip the count.
  if (
    text.length * 3 > MAX_MESSAGE_BYTES &&
    encoder.encode(text).length > MAX_MESSAGE_BYTES
  ) {
    return JSON.stringify({ type: MSG.REPLY, id, ok: false, error: TOO_LARGE });
  }
  return text;
}

export function createConnection({ openSocket, storage, onRequest }) {
  let socket = null;
  let isReady = false;
  let connecting = false;
  let reconnectPending = false;
  let retryAttempt = 0;
  let retryTimer;
  let pingTimer;
  // The capture running now, which the next one waits for.
  let turn = Promise.resolve();

  const setStatus = (status) => storage.set({ pieStatus: status });

  const send = (ws, message) => {
    if (ws.readyState === OPEN) {
      ws.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  function scheduleRetry() {
    if (retryAttempt >= RETRY_DELAYS_MS.length) {
      return;
    }
    clearTimeout(retryTimer);
    retryTimer = setTimeout(
      () => void connect(),
      RETRY_DELAYS_MS[retryAttempt],
    );
    retryAttempt += 1;
  }

  function open(code) {
    const ws = openSocket(`ws://127.0.0.1:${PORT}`);
    socket = ws;
    isReady = false;
    const extNonce = randomNonce();
    let appNonce = null;
    let hasProved = false;
    let refusedApp = false;
    // Signing is async, so messages are handled one at a time, in order.
    let queue = Promise.resolve();

    const handle = async (message) => {
      if (socket !== ws || message === null) {
        return;
      }
      if (!isReady) {
        if (
          message.type === MSG.CHALLENGE &&
          appNonce === null &&
          isNonce(message.nonce)
        ) {
          appNonce = message.nonce;
          const expected = await sign(code, appProofText(extNonce, appNonce));
          // An app that can't prove the code never gets this side's proof.
          if (!sameText(message.proof, expected)) {
            refusedApp = true;
            ws.close();
            return;
          }
          send(ws, {
            type: MSG.PROOF,
            proof: await sign(code, extProofText(appNonce, extNonce)),
          });
          hasProved = true;
        } else if (message.type === MSG.READY && hasProved) {
          isReady = true;
          retryAttempt = 0;
          await setStatus('connected');
          clearInterval(pingTimer);
          pingTimer = setInterval(() => send(ws, { type: MSG.PING }), PING_MS);
        }
        return;
      }
      if (message.type === MSG.REQUEST && typeof message.id === 'string') {
        // Not awaited: a slow capture must not hold up a quick read.
        void runRequest(ws, message);
      }
    };

    async function runRequest(ws, message) {
      const deadline = deadlineOf(message);
      const answer = async () => {
        // The app gave up while this waited its turn: running it now would
        // only take the tab over for nothing.
        if (Date.now() > deadline) {
          return;
        }
        const reply = await onRequest(message.action, message.args);
        send(ws, replyText(message.id, reply));
      };
      if (!ONE_AT_A_TIME.has(message.action)) {
        await answer().catch(() => undefined);
        return;
      }
      const run = turn.then(answer);
      turn = run.catch(() => undefined);
      await turn;
    }

    ws.onopen = () => send(ws, { type: MSG.HELLO, nonce: extNonce });
    ws.onmessage = (event) => {
      const message = parse(event.data);
      queue = queue.then(() => handle(message)).catch(() => undefined);
    };
    ws.onerror = () => undefined;
    ws.onclose = (event) => {
      if (socket !== ws) {
        return;
      }
      socket = null;
      isReady = false;
      clearInterval(pingTimer);
      const status =
        refusedApp || event.code === CLOSE.BAD_CODE
          ? 'bad-code'
          : event.code === CLOSE.REPLACED
            ? 'replaced'
            : 'not-connected';
      void setStatus(status);
      if (status === 'not-connected') {
        scheduleRetry();
      }
      if (status === 'bad-code') {
        void storage.set({ pieRetryAt: Date.now() + BAD_CODE_RETRY_MS });
      }
    };
  }

  async function connect({ force = false } = {}) {
    if (connecting || socket) {
      return;
    }
    connecting = true;
    try {
      const { pieCode, pieStatus, pieRetryAt } = await storage.get([
        'pieCode',
        'pieStatus',
        'pieRetryAt',
      ]);
      const canRetry =
        pieStatus === 'bad-code' &&
        Number.isFinite(pieRetryAt) &&
        Date.now() >= pieRetryAt;
      if (!force && WAITING.has(pieStatus) && !canRetry) {
        return;
      }
      if (typeof pieCode !== 'string' || pieCode === '') {
        await setStatus('no-code');
        return;
      }
      open(pieCode);
    } finally {
      connecting = false;
      if (reconnectPending) {
        reconnectPending = false;
        reconnect();
      }
    }
  }

  // A new code, Connect, or Chrome starting: try again even after being
  // replaced or refused.
  function reconnect() {
    if (connecting) {
      reconnectPending = true;
      return;
    }
    const old = socket;
    socket = null;
    isReady = false;
    clearInterval(pingTimer);
    clearTimeout(retryTimer);
    retryAttempt = 0;
    old?.close();
    void connect({ force: true });
  }

  function sendEvent(name) {
    if (socket && isReady) {
      send(socket, { type: MSG.EVENT, name });
    }
  }

  return { connect, reconnect, sendEvent };
}
