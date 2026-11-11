import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChromeStatus, SuggestionGroup } from '../../shared/types';
import { SuggestionSync } from './suggestion-sync';

const GROUPS: SuggestionGroup[] = [
  {
    id: 'g',
    name: 'Day',
    collapsed: false,
    values: [
      { value: '01', label: null, hidden: false },
      { value: '02', label: null, hidden: true },
    ],
  },
];

let status: ChromeStatus;
let statusListener: ((status: ChromeStatus) => void) | undefined;
let enabled: boolean;
const request = vi.fn(async () => null);

function makeSync() {
  return new SuggestionSync({
    list: () => GROUPS,
    isEnabled: () => enabled,
    bridge: {
      status: () => status,
      onStatus: (listener) => {
        statusListener = listener;
        return () => undefined;
      },
      request,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  status = 'not-connected';
  statusListener = undefined;
  enabled = true;
});

describe('SuggestionSync', () => {
  it('sends the visible list when connected', () => {
    status = 'connected';
    makeSync().push();
    expect(request).toHaveBeenCalledExactlyOnceWith('setSuggestions', {
      enabled: true,
      groups: [{ name: 'Day', values: [{ value: '01' }] }],
    });
  });

  it('sends the switch being off', () => {
    status = 'connected';
    enabled = false;
    makeSync().push();
    expect(request).toHaveBeenCalledWith(
      'setSuggestions',
      expect.objectContaining({ enabled: false }),
    );
  });

  it('sends nothing while Chrome is not connected', () => {
    makeSync().push();
    expect(request).not.toHaveBeenCalled();
  });

  it('sends when Chrome connects', () => {
    makeSync();
    statusListener?.('not-connected');
    expect(request).not.toHaveBeenCalled();
    status = 'connected';
    statusListener?.('connected');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('ignores a failed send', async () => {
    status = 'connected';
    request.mockRejectedValueOnce(new Error('no-answer'));
    expect(() => makeSync().push()).not.toThrow();
    await Promise.resolve();
  });
});
