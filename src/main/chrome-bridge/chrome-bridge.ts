import { randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';
import type { RawData, WebSocket } from 'ws';
import { z } from 'zod';
import {
  isNonce,
  randomNonce,
  sameText,
  sign,
} from '../../../packages/pie-extension/crypto.js';
import {
  CLOSE,
  EXTENSION_ID,
  MAX_HANDSHAKE_BYTES,
  MAX_MESSAGE_BYTES,
  MSG,
  PORT,
  appProofText,
  extProofText,
} from '../../../packages/pie-extension/protocol.js';
import type { ChromeStatus } from '../../shared/types';

export const SITE_EVENTS = [
  'committed',
  'loaded',
  'changedInPlace',
  'failed',
  'cancelled',
  'closed',
  'activeTabChanged',
] as const;
export type SiteEventName = (typeof SITE_EVENTS)[number];

const HANDSHAKE_MS = 5000;
const MAX_HANDSHAKING = 2;
const PORT_RETRY_MS = 30000;
const REQUEST_MS = 10000;
// Room for the message around a page that is just under the limit.
const MAX_PAYLOAD = MAX_MESSAGE_BYTES + 64 * 1024;

const Hello = z.object({
  type: z.literal(MSG.HELLO),
  nonce: z.string().refine(isNonce),
});
const Proof = z.object({ type: z.literal(MSG.PROOF), proof: z.string() });
const Reply = z.object({
  type: z.literal(MSG.REPLY),
  id: z.string(),
  ok: z.boolean(),
  result: z.unknown().optional(),
});
const Event = z.object({
  type: z.literal(MSG.EVENT),
  name: z.enum(SITE_EVENTS),
});

interface Waiting {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface ChromeBridgeOptions {
  getCode: () => string;
  port?: number;
  origin?: string;
  handshakeMs?: number;
  portRetryMs?: number;
  requestMs?: number;
}

const byteLength = (data: RawData): number =>
  Array.isArray(data)
    ? data.reduce((total, part) => total + part.length, 0)
    : data.byteLength;

function parse(data: RawData): unknown {
  try {
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

// The app's end of the Chrome connection. It listens on this computer only,
// and trusts a connection only after both sides prove they know the code.
export class ChromeBridge {
  private readonly options: Required<ChromeBridgeOptions>;
  private server: http.Server | null = null;
  private sockets: WebSocketServer | null = null;
  private active: WebSocket | null = null;
  private handshaking = 0;
  private currentStatus: ChromeStatus = 'not-connected';
  private readonly statusListeners = new Set<(status: ChromeStatus) => void>();
  private readonly eventListeners = new Set<(name: SiteEventName) => void>();
  private readonly waiting = new Map<string, Waiting>();
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private isStopped = false;

  constructor(options: ChromeBridgeOptions) {
    this.options = {
      port: PORT,
      origin: `chrome-extension://${EXTENSION_ID}`,
      handshakeMs: HANDSHAKE_MS,
      portRetryMs: PORT_RETRY_MS,
      requestMs: REQUEST_MS,
      ...options,
    };
  }

  // Resolves once listening, or once the port turned out to be in use.
  start(): Promise<void> {
    this.isStopped = false;
    const sockets = new WebSocketServer({
      noServer: true,
      maxPayload: MAX_PAYLOAD,
    });
    const server = http.createServer((_request, response) => {
      response.writeHead(426).end();
    });
    server.on('upgrade', (request, socket, head) => {
      if (
        request.headers.origin !== this.options.origin ||
        this.handshaking >= MAX_HANDSHAKING
      ) {
        socket.destroy();
        return;
      }
      this.handshaking += 1;
      let isCounted = true;
      const release = () => {
        if (isCounted) {
          isCounted = false;
          this.handshaking -= 1;
        }
      };
      socket.once('close', release);
      sockets.handleUpgrade(request, socket, head, (ws) =>
        this.accept(ws, release),
      );
    });
    this.server = server;
    this.sockets = sockets;

    return new Promise((resolve) => {
      server.once('listening', () => {
        if (this.currentStatus === 'port-in-use') {
          this.setStatus('not-connected');
        }
        resolve();
      });
      server.once('error', (error: NodeJS.ErrnoException) => {
        server.close();
        sockets.close();
        this.server = null;
        this.sockets = null;
        if (error.code === 'EADDRINUSE') {
          this.setStatus('port-in-use');
        }
        if (!this.isStopped) {
          this.retryTimer = setTimeout(
            () => void this.start(),
            this.options.portRetryMs,
          );
        }
        resolve();
      });
      server.listen(this.options.port, '127.0.0.1');
    });
  }

  async stop(): Promise<void> {
    this.isStopped = true;
    clearTimeout(this.retryTimer);
    for (const ws of this.sockets?.clients ?? []) {
      ws.terminate();
    }
    this.sockets?.close();
    const server = this.server;
    this.server = null;
    this.sockets = null;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  port(): number | null {
    const address = this.server?.address() as AddressInfo | null | undefined;
    return address?.port ?? null;
  }

  status(): ChromeStatus {
    return this.currentStatus;
  }

  onStatus(listener: (status: ChromeStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onEvent(listener: (name: SiteEventName) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // A new pairing code: the connected Chrome now holds the wrong one.
  dropConnection(): void {
    this.active?.close(CLOSE.BAD_CODE);
  }

  request(
    action: string,
    args?: Record<string, unknown>,
    timeoutMs = this.options.requestMs,
  ): Promise<unknown> {
    const ws = this.active;
    if (!ws) {
      return Promise.reject(new Error('not-connected'));
    }
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error('no-answer'));
      }, timeoutMs);
      this.waiting.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ type: MSG.REQUEST, id, action, args }));
    });
  }

  private accept(ws: WebSocket, release: () => void): void {
    const code = this.options.getCode();
    let stage: 'hello' | 'proof' | 'ready' = 'hello';
    let extNonce = '';
    let appNonce = '';
    // Signing is async, so messages are handled one at a time, in order.
    let queue = Promise.resolve();
    const timer = setTimeout(() => ws.terminate(), this.options.handshakeMs);

    const handshake = async (message: unknown) => {
      if (stage === 'hello') {
        const hello = Hello.safeParse(message);
        if (!hello.success) {
          ws.terminate();
          return;
        }
        extNonce = hello.data.nonce;
        appNonce = randomNonce();
        stage = 'proof';
        ws.send(
          JSON.stringify({
            type: MSG.CHALLENGE,
            nonce: appNonce,
            proof: await sign(code, appProofText(extNonce, appNonce)),
          }),
        );
        return;
      }
      if (stage === 'proof') {
        const proof = Proof.safeParse(message);
        const expected = await sign(code, extProofText(appNonce, extNonce));
        if (!proof.success || !sameText(proof.data.proof, expected)) {
          ws.close(CLOSE.BAD_CODE);
          return;
        }
        stage = 'ready';
        clearTimeout(timer);
        release();
        this.adopt(ws);
      }
    };

    ws.on('message', (data, isBinary) => {
      if (stage === 'ready') {
        this.receive(data);
        return;
      }
      if (isBinary || byteLength(data) > MAX_HANDSHAKE_BYTES) {
        ws.terminate();
        return;
      }
      const message = parse(data);
      queue = queue.then(() => handshake(message)).catch(() => ws.terminate());
    });
    ws.on('error', () => undefined);
    ws.on('close', () => {
      clearTimeout(timer);
      release();
      if (this.active === ws) {
        this.active = null;
        this.failWaiting();
        this.setStatus('not-connected');
      }
    });
  }

  // The newest Chrome wins. Anything sent to the old one won't be answered,
  // so it counts as a dropped connection first.
  private adopt(ws: WebSocket): void {
    const old = this.active;
    this.active = ws;
    if (old) {
      this.failWaiting();
      this.setStatus('not-connected');
      old.close(CLOSE.REPLACED);
    }
    ws.send(JSON.stringify({ type: MSG.READY }));
    this.setStatus('connected');
  }

  private receive(data: RawData): void {
    const message = parse(data);
    const reply = Reply.safeParse(message);
    if (reply.success) {
      const waiting = this.waiting.get(reply.data.id);
      if (waiting) {
        this.waiting.delete(reply.data.id);
        clearTimeout(waiting.timer);
        if (reply.data.ok) {
          waiting.resolve(reply.data.result ?? null);
        } else {
          waiting.reject(new Error('failed'));
        }
      }
      return;
    }
    const event = Event.safeParse(message);
    if (event.success) {
      for (const listener of this.eventListeners) {
        listener(event.data.name);
      }
    }
  }

  private failWaiting(): void {
    for (const [id, waiting] of this.waiting) {
      this.waiting.delete(id);
      clearTimeout(waiting.timer);
      waiting.reject(new Error('not-connected'));
    }
  }

  private setStatus(status: ChromeStatus): void {
    if (status === this.currentStatus) {
      return;
    }
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}
