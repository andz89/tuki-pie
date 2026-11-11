import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConnection,
  createRequestHandler,
  replyText,
} from './connection.js';
import { MAX_MESSAGE_BYTES } from './protocol.js';

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
}

let sockets: FakeSocket[];
let data: Record<string, unknown>;

const storage = {
  get: async (keys: string[]) =>
    Object.fromEntries(keys.map((key) => [key, data[key]])),
  set: async (values: Record<string, unknown>) => {
    Object.assign(data, values);
  },
};

function connection() {
  return createConnection({
    openSocket: () => {
      const socket: FakeSocket = {
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
      };
      sockets.push(socket);
      return socket;
    },
    storage,
    onRequest: vi.fn(),
  });
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  data = { pieCode: 'code' };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('connecting', () => {
  it('waits for a code before connecting', async () => {
    data = {};
    await connection().connect();
    expect(sockets).toHaveLength(0);
    expect(data.pieStatus).toBe('no-code');
  });

  it('says hello with a nonce once open', async () => {
    await connection().connect();
    sockets[0].onopen?.();
    const hello = JSON.parse(sockets[0].send.mock.calls[0][0]);
    expect(hello.type).toBe('hello');
    expect(hello.nonce).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('after the connection closes', () => {
  it('retries after 1, 3 and 10 seconds when the app went away', async () => {
    await connection().connect();
    sockets[0].onclose?.({ code: 1006 });
    await flush();
    expect(data.pieStatus).toBe('not-connected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
    sockets[1].onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(sockets).toHaveLength(3);
    sockets[2].onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(10000);
    expect(sockets).toHaveLength(4);
    sockets[3].onclose?.({ code: 1006 });
    // After that, only the 30-second alarm tries again.
    await vi.advanceTimersByTimeAsync(60000);
    expect(sockets).toHaveLength(4);
  });

  it.each([
    [4001, 'replaced'],
    [4002, 'bad-code'],
  ])('stops retrying after close code %i', async (code, status) => {
    const linked = connection();
    await linked.connect();
    sockets[0].onclose?.({ code });
    await flush();
    expect(data.pieStatus).toBe(status);
    await vi.advanceTimersByTimeAsync(60000);
    // The alarm doesn't try either.
    await linked.connect();
    expect(sockets).toHaveLength(1);
  });

  it('tries again after being replaced when asked to', async () => {
    const linked = connection();
    await linked.connect();
    sockets[0].onclose?.({ code: 4001 });
    await flush();
    linked.reconnect();
    await flush();
    expect(sockets).toHaveLength(2);
  });
});

describe('requests', () => {
  it('runs only actions on the fixed list', async () => {
    const handler = createRequestHandler({
      read: () => 'page',
      runScript: () => 'nope',
    });
    await expect(handler('read')).resolves.toEqual({
      ok: true,
      result: 'page',
    });
    await expect(handler('runScript')).resolves.toEqual({
      ok: false,
      error: 'unknown-action',
    });
    await expect(handler('__proto__')).resolves.toMatchObject({ ok: false });
  });

  it('turns a failed action into a failed reply', async () => {
    const handler = createRequestHandler({
      read: () => {
        throw new Error('boom');
      },
    });
    await expect(handler('read')).resolves.toEqual({
      ok: false,
      error: 'failed',
    });
  });

  it('replaces an answer over 32 MB with a failure', () => {
    const big = 'x'.repeat(MAX_MESSAGE_BYTES);
    expect(JSON.parse(replyText('1', { ok: true, result: big }))).toEqual({
      type: 'reply',
      id: '1',
      ok: false,
      error: 'too-large',
    });
  });

  it('sends a normal answer as it is', () => {
    expect(JSON.parse(replyText('1', { ok: true, result: 'page' }))).toEqual({
      type: 'reply',
      id: '1',
      ok: true,
      result: 'page',
    });
  });
});
