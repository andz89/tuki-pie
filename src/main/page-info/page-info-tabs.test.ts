import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { PageInfoUpdate, SiteTabList } from '../../shared/types';
import type { PageInfoController } from './page-info-controller';
import { PageInfoTabs } from './page-info-tabs';

// A controller that only remembers its state and reports changes.
function fakeTab(id: string, send: (update: PageInfoUpdate) => void) {
  let update: PageInfoUpdate = {
    tabId: id,
    status: 'idle',
    address: null,
    report: null,
    message: null,
    siteVisible: false,
    chromeConnected: true,
    reportId: 0,
  };
  const controller = {
    state: () => update,
    dispose: vi.fn(),
    setSiteVisible: vi.fn(),
    check: vi.fn((address: string) => {
      if (address === 'bad') {
        throw new Error('Enter a web address, like example.com.');
      }
    }),
    change: (changes: Partial<PageInfoUpdate>) => {
      update = { ...update, ...changes };
      send(update);
    },
  };
  return {
    controller: controller as unknown as PageInfoController,
    fake: controller,
    forget: vi.fn(),
    destroy: vi.fn(),
  };
}

let made: Map<string, ReturnType<typeof fakeTab>>;
let sendUpdate: Mock<(update: PageInfoUpdate) => void>;
let sendTabs: Mock<(tabs: SiteTabList) => void>;
let tabs: PageInfoTabs;

const lastTabs = (): SiteTabList => sendTabs.mock.lastCall![0];
const ids = () => lastTabs().tabs.map(({ id }) => id);

beforeEach(() => {
  made = new Map();
  sendUpdate = vi.fn();
  sendTabs = vi.fn();
  tabs = new PageInfoTabs({
    make: (id, send) => {
      const tab = fakeTab(id, send);
      made.set(id, tab);
      return tab;
    },
    sendUpdate,
    sendTabs,
  });
});

describe('site tabs', () => {
  it('starts with one empty tab', () => {
    expect(lastTabs()).toEqual({
      tabs: [{ id: '1', title: 'New tab', address: null, status: 'idle' }],
      activeId: '1',
    });
    expect(tabs.active()).toBe(made.get('1')?.controller);
  });

  it('makes a new tab the active one and shows its state', () => {
    tabs.add();
    expect(ids()).toEqual(['1', '2']);
    expect(lastTabs().activeId).toBe('2');
    expect(sendUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ tabId: '2' }),
    );
  });

  it('checks an address in the new tab at once', () => {
    tabs.add('https://b.com/');
    expect(made.get('2')!.fake.check).toHaveBeenCalledWith('https://b.com/');
    expect(lastTabs().activeId).toBe('2');
  });

  it('leaves no tab behind for a refused address', () => {
    expect(() => tabs.add('bad')).toThrow('Enter a web address');
    expect(ids()).toEqual(['1']);
    expect(lastTabs().activeId).toBe('1');
    expect(made.get('2')!.forget).toHaveBeenCalledOnce();
  });

  it('sends the state before the strip', () => {
    const order: string[] = [];
    sendUpdate.mockImplementation(() => void order.push('update'));
    sendTabs.mockImplementation(() => void order.push('tabs'));
    tabs.add();
    expect(order).toEqual(['update', 'tabs']);
  });

  it('hides the viewer when the active tab closes', () => {
    made.get('1')!.fake.change({ siteVisible: true });
    tabs.add();
    tabs.switchTo('1');
    tabs.close('1');
    expect(made.get('1')!.fake.setSiteVisible).toHaveBeenCalledWith(false);
  });

  it('leaves the viewer alone when another tab closes', () => {
    made.get('1')!.fake.change({ siteVisible: true });
    tabs.add();
    tabs.close('2');
    expect(made.get('1')!.fake.setSiteVisible).not.toHaveBeenCalled();
  });

  it('sends only the active tab’s changes to the window', () => {
    tabs.add();
    sendUpdate.mockClear();
    made.get('1')?.fake.change({ status: 'checking', address: 'https://a/' });
    expect(sendUpdate).not.toHaveBeenCalled();
    made.get('2')?.fake.change({ status: 'checking' });
    expect(sendUpdate).toHaveBeenCalledOnce();
  });

  it('names a tab by its title, then its address', () => {
    const one = made.get('1')!.fake;
    one.change({ address: 'https://a.com/' });
    expect(lastTabs().tabs[0].title).toBe('https://a.com/');
    one.change({
      report: { meta: { title: ' Shop ' } } as PageInfoUpdate['report'],
    });
    expect(lastTabs().tabs[0].title).toBe('Shop');
  });

  it('shows the saved state when switching back', () => {
    made.get('1')!.fake.change({ address: 'https://a.com/', status: 'done' });
    tabs.add();
    made.get('2')!.fake.change({ siteVisible: true });
    tabs.switchTo('1');
    expect(sendUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ tabId: '1', address: 'https://a.com/' }),
    );
    expect(made.get('2')!.fake.setSiteVisible).toHaveBeenCalledWith(false);
  });

  it('ignores a tab that does not exist', () => {
    tabs.switchTo('9');
    tabs.close('9');
    expect(lastTabs().activeId).toBe('1');
  });

  it('closing a tab ends it and closes its Chrome tab', () => {
    tabs.add();
    tabs.close('1');
    const closed = made.get('1')!;
    expect(closed.fake.dispose).toHaveBeenCalledOnce();
    expect(closed.destroy).toHaveBeenCalledOnce();
    expect(closed.forget).toHaveBeenCalledOnce();
    expect(ids()).toEqual(['2']);
  });

  it('moves to the tab on the right after closing the active one', () => {
    tabs.add();
    tabs.add();
    tabs.switchTo('2');
    tabs.close('2');
    expect(lastTabs().activeId).toBe('3');
    tabs.close('3');
    expect(lastTabs().activeId).toBe('1');
  });

  it('keeps the active tab when closing another', () => {
    tabs.add();
    tabs.close('1');
    expect(lastTabs().activeId).toBe('2');
  });

  it('replaces the last tab with an empty one', () => {
    tabs.close('1');
    expect(ids()).toEqual(['2']);
    expect(lastTabs().activeId).toBe('2');
  });

  it('ends every tab when the window closes, and goes quiet', () => {
    tabs.add();
    tabs.dispose();
    expect(made.get('1')!.forget).toHaveBeenCalledOnce();
    expect(made.get('2')!.forget).toHaveBeenCalledOnce();
    sendTabs.mockClear();
    made.get('2')!.fake.change({ status: 'checking' });
    expect(sendTabs).not.toHaveBeenCalled();
  });

  it('sends the strip only when it changed', () => {
    const one = made.get('1')!.fake;
    one.change({ status: 'checking' });
    sendTabs.mockClear();
    one.change({ message: 'late tags' });
    expect(sendTabs).not.toHaveBeenCalled();
  });
});
