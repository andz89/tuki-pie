import { describe, expect, it, vi } from 'vitest';
import { setWindowRole } from '../ipc/ipc-access';
import { isPermissionAllowed, limitPermissions } from './permissions';

const appWindow = {};
setWindowRole(appWindow as never, 'page-info');
const otherPage = {};

describe('isPermissionAllowed', () => {
  it("lets the app's own pages write to the clipboard", () => {
    expect(
      isPermissionAllowed(appWindow as never, 'clipboard-sanitized-write'),
    ).toBe(true);
  });

  it.each(['media', 'geolocation', 'notifications', 'clipboard-read'])(
    'refuses %s',
    (permission) => {
      expect(isPermissionAllowed(appWindow as never, permission)).toBe(false);
    },
  );

  it('refuses a page that is not one of the app windows', () => {
    expect(
      isPermissionAllowed(otherPage as never, 'clipboard-sanitized-write'),
    ).toBe(false);
    expect(isPermissionAllowed(null, 'clipboard-sanitized-write')).toBe(false);
  });
});

describe('limitPermissions', () => {
  it('answers requests and checks with the same rule', () => {
    const session = {
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
    };
    limitPermissions(session as never);
    const answer = vi.fn();
    session.setPermissionRequestHandler.mock.calls[0][0](
      appWindow,
      'media',
      answer,
    );
    expect(answer).toHaveBeenCalledWith(false);
    const check = session.setPermissionCheckHandler.mock.calls[0][0];
    expect(check(appWindow, 'clipboard-sanitized-write')).toBe(true);
  });
});
