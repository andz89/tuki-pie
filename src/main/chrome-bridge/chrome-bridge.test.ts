import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createConnection,
  createRequestHandler,
} from '../../../packages/pie-extension/connection.js';
import { randomNonce, sign } from '../../../packages/pie-extension/crypto.js';
import {
  EXTENSION_ID,
  extProofText,
} from '../../../packages/pie-extension/protocol.js';
import { ChromeBridge } from './chrome-bridge';

const ORIGIN = `chrome-extension://${EXTENSION_ID}`;
const CODE = 'a'.repeat(43);

async function until(check: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Frozen after each test, so a leftover extension waits instead of retrying
// into the next test's server.
function memoryStorage(initial: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...initial };
  let isFrozen = false;
  return {
    data,
    freeze: () => {
      data.pieStatus = 'replaced';
      isFrozen = true;
    },
    get: async (keys: string[]) =>
      Object.fromEntries(keys.map((key) => [key, data[key]])),
    set: async (values: Record<string, unknown>) => {
      if (!isFrozen) {
        Object.assign(data, values);
      }
    },
  };
}

const bridges: ChromeBridge[] = [];
const extras: Array<{ close: () => void }> = [];
const storages: Array<{ freeze: () => void }> = [];
let bridge: ChromeBridge;

async function startBridge(
  options: Partial<ConstructorParameters<typeof ChromeBridge>[0]> = {},
) {
  const started = new ChromeBridge({
    getCode: () => CODE,
    port: 0,
    ...options,
  });
  bridges.push(started);
  await started.start();
  return started;
}

// The extension's own connection code, pointed at the test server.
function extension(
  code: string,
  actions: Record<string, (args?: unknown) => unknown> = {},
  port = () => bridge.port(),
) {
  const storage = memoryStorage({ pieCode: code });
  storages.push(storage);
  const sent: string[] = [];
  const connection = createConnection({
    openSocket: () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port()}`, { origin: ORIGIN });
      const send = ws.send.bind(ws);
      ws.send = ((data: string) => {
        sent.push(data);
        send(data);
      }) as typeof ws.send;
      extras.push({ close: () => ws.terminate() });
      return ws;
    },
    storage,
    onRequest: createRequestHandler(actions),
  });
  return { connection, storage, sent };
}

function rawClient(origin = ORIGIN) {
  const ws = new WebSocket(`ws://127.0.0.1:${bridge.port()}`, { origin });
  ws.on('error', () => undefined);
  extras.push({ close: () => ws.terminate() });
  return ws;
}

const isClosed = (ws: WebSocket) => ws.readyState === WebSocket.CLOSED;

beforeEach(async () => {
  bridge = await startBridge();
});

afterEach(async () => {
  storages.splice(0).forEach((storage) => storage.freeze());
  extras.splice(0).forEach((extra) => extra.close());
  await Promise.all(bridges.splice(0).map((each) => each.stop()));
});

describe('pairing', () => {
  it('connects when both sides know the code', async () => {
    const ext = extension(CODE);
    await ext.connection.connect();
    await until(() => ext.storage.data.pieStatus === 'connected');
    expect(bridge.status()).toBe('connected');
  });

  it('refuses a wrong code, and the extension never sends its proof', async () => {
    const ext = extension('b'.repeat(43));
    await ext.connection.connect();
    await until(() => ext.storage.data.pieStatus === 'bad-code');
    expect(bridge.status()).toBe('not-connected');
    expect(ext.sent.some((text) => text.includes('"proof"'))).toBe(false);
  });

  it('refuses a website, by its origin', async () => {
    const ws = rawClient('https://evil.example');
    await until(() => isClosed(ws));
    expect(bridge.status()).toBe('not-connected');
  });

  it('closes a connection that sends over 4 KB before pairing', async () => {
    const ws = rawClient();
    await new Promise((resolve) => ws.once('open', resolve));
    ws.send('x'.repeat(5000));
    await until(() => isClosed(ws));
  });

  it('closes a connection that never finishes pairing', async () => {
    bridge = await startBridge({ handshakeMs: 100 });
    const ws = rawClient();
    await until(() => isClosed(ws), 1000);
  });

  it('allows only two connections to be pairing at once', async () => {
    const first = rawClient();
    const second = rawClient();
    await Promise.all(
      [first, second].map((ws) => new Promise((r) => ws.once('open', r))),
    );
    const third = rawClient();
    await until(() => isClosed(third));
    expect(first.readyState).toBe(WebSocket.OPEN);
  });

  it('refuses a proof made with the other side’s text', async () => {
    const ws = rawClient();
    const extNonce = randomNonce();
    const closed = new Promise<number>((resolve) =>
      ws.once('close', (code) => resolve(code)),
    );
    ws.once('open', () =>
      ws.send(JSON.stringify({ type: 'hello', nonce: extNonce })),
    );
    ws.once('message', async (data) => {
      const { nonce } = JSON.parse(data.toString());
      // Signs the app's text instead of the extension's.
      const proof = await sign(CODE, `pie-app|${nonce}|${extNonce}`);
      ws.send(JSON.stringify({ type: 'proof', proof }));
    });
    expect(await closed).toBe(4002);
    expect(bridge.status()).toBe('not-connected');
  });

  it('pairs with a hand-made extension that signs correctly', async () => {
    const ws = rawClient();
    const extNonce = randomNonce();
    const ready = new Promise<void>((resolve) =>
      ws.on('message', (data) => {
        if (JSON.parse(data.toString()).type === 'ready') resolve();
      }),
    );
    ws.once('open', () =>
      ws.send(JSON.stringify({ type: 'hello', nonce: extNonce })),
    );
    ws.once('message', async (data) => {
      const { nonce } = JSON.parse(data.toString());
      const proof = await sign(CODE, extProofText(nonce, extNonce));
      ws.send(JSON.stringify({ type: 'proof', proof }));
    });
    await ready;
    expect(bridge.status()).toBe('connected');
  });
});

describe('a program posing as the app', () => {
  it('is refused, and gets no proof from the extension', async () => {
    const fake = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    extras.push({ close: () => fake.close() });
    await new Promise((resolve) => fake.once('listening', resolve));
    const received: string[] = [];
    fake.on('connection', (ws) => {
      ws.on('message', (data) => {
        received.push(data.toString());
        ws.send(
          JSON.stringify({
            type: 'challenge',
            nonce: randomNonce(),
            proof: 'f'.repeat(64),
          }),
        );
      });
    });
    const ext = extension(
      CODE,
      {},
      () => (fake.address() as { port: number }).port,
    );
    await ext.connection.connect();
    await until(() => ext.storage.data.pieStatus === 'bad-code');
    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0]).type).toBe('hello');
  });
});

describe('two Chrome profiles', () => {
  it('lets the newer one take over, and the older one waits', async () => {
    const older = extension(CODE);
    await older.connection.connect();
    await until(() => older.storage.data.pieStatus === 'connected');

    const newer = extension(CODE);
    await newer.connection.connect();
    await until(() => older.storage.data.pieStatus === 'replaced');
    await until(() => newer.storage.data.pieStatus === 'connected');

    // The older one doesn't knock the newer one off again.
    await older.connection.connect();
    await pause(1300);
    expect(older.storage.data.pieStatus).toBe('replaced');
    expect(newer.storage.data.pieStatus).toBe('connected');
    expect(bridge.status()).toBe('connected');
  });
});

describe('requests and events', () => {
  async function connected(
    actions: Record<string, (args?: unknown) => unknown>,
  ) {
    const ext = extension(CODE, actions);
    await ext.connection.connect();
    // Both sides, because the extension finishes a moment after the app.
    await until(
      () =>
        bridge.status() === 'connected' &&
        ext.storage.data.pieStatus === 'connected',
    );
    return ext;
  }

  it('answers a read', async () => {
    await connected({ read: () => ({ url: 'https://a.com/' }) });
    await expect(bridge.request('read')).resolves.toEqual({
      url: 'https://a.com/',
    });
  });

  it('matches each answer to its own request', async () => {
    let call = 0;
    await connected({
      read: async () => {
        call += 1;
        const mine = call;
        await pause(mine === 1 ? 100 : 0);
        return mine;
      },
    });
    const [first, second] = await Promise.all([
      bridge.request('read'),
      bridge.request('read'),
    ]);
    expect([first, second]).toEqual([1, 2]);
  });

  it('refuses an action outside the fixed list', async () => {
    await connected({ read: () => 1 });
    await expect(bridge.request('runScript')).rejects.toThrow();
  });

  it('passes events on with their site, or null from an old extension', async () => {
    const ext = await connected({});
    const names: string[] = [];
    bridge.onEvent((name, site) => names.push(`${name}:${site}`));
    ext.connection.sendEvent('loaded', '2');
    ext.connection.sendEvent('loaded');
    await until(() => names.length === 2);
    expect(names).toEqual(['loaded:2', 'loaded:null']);
  });

  it('drops events with an unknown name', async () => {
    const ext = await connected({});
    const names: string[] = [];
    bridge.onEvent((name) => names.push(name));
    ext.connection.sendEvent('somethingElse');
    ext.connection.sendEvent('loaded');
    await until(() => names.length === 1);
    expect(names).toEqual(['loaded']);
  });

  it('ends a waiting read when the connection drops', async () => {
    await connected({ read: () => new Promise(() => undefined) });
    const waiting = bridge.request('read');
    bridge.dropConnection();
    await expect(waiting).rejects.toThrow('not-connected');
    await until(() => bridge.status() === 'not-connected');
  });

  it('refuses requests while nothing is connected', async () => {
    await expect(bridge.request('read')).rejects.toThrow('not-connected');
  });
});

describe('a new pairing code', () => {
  it('disconnects Chrome, which then says the code does not match', async () => {
    const ext = extension(CODE);
    await ext.connection.connect();
    await until(() => bridge.status() === 'connected');
    bridge.dropConnection();
    await until(() => ext.storage.data.pieStatus === 'bad-code');
  });
});

describe('the port', () => {
  it('reports when another program holds it', async () => {
    const statuses: string[] = [];
    const second = new ChromeBridge({
      getCode: () => CODE,
      port: bridge.port() ?? 0,
      portRetryMs: 60000,
    });
    bridges.push(second);
    second.onStatus((status) => statuses.push(status));
    await second.start();
    expect(second.status()).toBe('port-in-use');
    expect(statuses).toEqual(['port-in-use']);
  });
});

describe('the listener', () => {
  it('listens on this computer only', async () => {
    const spy = vi.spyOn(WebSocketServer.prototype, 'handleUpgrade');
    const ws = rawClient();
    await new Promise((resolve) => ws.once('open', resolve));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    // The server was asked for 127.0.0.1, which never accepts other machines.
    expect(
      (
        bridges[0] as unknown as { server: { address(): { address: string } } }
      ).server.address().address,
    ).toBe('127.0.0.1');
  });
});
