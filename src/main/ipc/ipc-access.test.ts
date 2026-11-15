import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHANNEL_ROLES, assertSender, setWindowRole } from './ipc-access';
import type { WindowRole } from './ipc-access';

function fakeSender(role: WindowRole | null) {
  const mainFrame = {};
  const sender = { mainFrame };
  if (role) {
    setWindowRole(sender as never, role);
  }
  return { sender, mainFrame };
}

describe('assertSender', () => {
  it("lets a window's main frame use its own channels", () => {
    const { sender, mainFrame } = fakeSender('panel');
    expect(() =>
      assertSender('panel:shortcut-add', {
        sender,
        senderFrame: mainFrame,
      } as never),
    ).not.toThrow();
  });

  it("refuses another window's channel", () => {
    const { sender, mainFrame } = fakeSender('pie');
    expect(() =>
      assertSender('panel:shortcut-add', {
        sender,
        senderFrame: mainFrame,
      } as never),
    ).toThrow(/not allowed/);
  });

  it('refuses a frame inside the window', () => {
    const { sender } = fakeSender('panel');
    expect(() =>
      assertSender('panel:shortcut-add', { sender, senderFrame: {} } as never),
    ).toThrow(/not allowed/);
  });

  it('refuses a window that never said what it is', () => {
    const { sender, mainFrame } = fakeSender(null);
    expect(() =>
      assertSender('settings:get', { sender, senderFrame: mainFrame } as never),
    ).toThrow(/not allowed/);
  });

  it('refuses a channel with no rule', () => {
    const { sender, mainFrame } = fakeSender('panel');
    expect(() =>
      assertSender('made:up', { sender, senderFrame: mainFrame } as never),
    ).toThrow(/not allowed/);
  });

  it('lets only the settings window change any setting', () => {
    expect(CHANNEL_ROLES['settings:update']).toEqual(['panel']);
  });
});

// Each preload's invoke calls, so the rules can't drift from the bridges.
// A shared bridge file serves every window that loads it.
const PRELOAD_ROLES: Record<string, WindowRole[]> = {
  'preload.ts': ['pie'],
  'panel-preload.ts': ['panel'],
  'notes-preload.ts': ['notes'],
  'page-info-preload.ts': ['page-info'],
  'saved-sites-preload.ts': ['saved-sites'],
  'saved-sites-api.ts': ['page-info', 'saved-sites'],
  'reminder-preload.ts': ['reminder'],
  'screenshot-preload.ts': ['screenshot'],
};

function invokedChannels(file: string): string[] {
  const source = readFileSync(
    path.join(__dirname, '../../preload', file),
    'utf8',
  );
  const channels = readFileSync(
    path.join(__dirname, '../../shared/ipc-channels.ts'),
    'utf8',
  );
  const valueOf = (key: string) =>
    new RegExp(`\\b${key}: '([^']+)'`).exec(channels)?.[1];
  return [...source.matchAll(/invoke\(\s*IpcChannels\.(\w+)/g)].map(
    ([, key]) => valueOf(key) ?? key,
  );
}

describe('the channel rules', () => {
  it.each(Object.entries(PRELOAD_ROLES))(
    'let %s use every channel its bridge calls',
    (file, roles) => {
      for (const channel of invokedChannels(file)) {
        for (const role of roles) {
          expect(CHANNEL_ROLES[channel], channel).toContain(role);
        }
      }
    },
  );

  it('give no window a channel its bridge does not call', () => {
    const used = new Map<string, Set<WindowRole>>();
    for (const [file, roles] of Object.entries(PRELOAD_ROLES)) {
      for (const channel of invokedChannels(file)) {
        const users = used.get(channel) ?? new Set();
        roles.forEach((role) => users.add(role));
        used.set(channel, users);
      }
    }
    for (const [channel, roles] of Object.entries(CHANNEL_ROLES)) {
      expect([...roles].sort(), channel).toEqual(
        [...(used.get(channel) ?? [])].sort(),
      );
    }
  });
});
