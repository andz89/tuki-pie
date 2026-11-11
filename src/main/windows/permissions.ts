import type { Session, WebContents } from 'electron';
import { hasWindowRole } from '../ipc/ipc-access';

// The one thing the app's own pages ask for: Page Info's copy buttons.
const APP_PERMISSIONS = new Set(['clipboard-sanitized-write']);

export function isPermissionAllowed(
  contents: WebContents | null,
  permission: string,
): boolean {
  return (
    contents !== null &&
    hasWindowRole(contents) &&
    APP_PERMISSIONS.has(permission)
  );
}

// No camera, microphone, location, notifications from a page, or anything
// else, for any page in this session.
export function limitPermissions(target: Session): void {
  target.setPermissionRequestHandler((contents, permission, answer) =>
    answer(isPermissionAllowed(contents, permission)),
  );
  target.setPermissionCheckHandler((contents, permission) =>
    isPermissionAllowed(contents, permission),
  );
}
