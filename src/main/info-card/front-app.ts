import path from 'node:path';

// Which app owns the window in front on the screen.
// chrome: Google Chrome. own: Pie Launcher itself. other: anything else,
// the desktop included. null: Windows could not say.
export type FrontApp = 'chrome' | 'own' | 'other' | null;

interface Win32 {
  // The process id of the window in front, or 0 when there is none.
  frontProcessId(): number;
  // The file name of a process, like "chrome.exe", or '' when unknown.
  processName(pid: number): string;
}

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
// Remembered names, so a check is two quick calls, not five.
const MAX_REMEMBERED = 64;

let win32: Win32 | null | undefined;
const names = new Map<number, string>();

// Loaded on first use, and only on Windows. A failed load means the card
// never hides.
function loadWin32(): Win32 | null {
  if (win32 !== undefined) {
    return win32;
  }
  win32 = null;
  if (process.platform !== 'win32') {
    return win32;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi') as typeof import('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    const getForeground = user32.func('void* __stdcall GetForegroundWindow()');
    const getProcessId = user32.func(
      'uint32 __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32 *pid)',
    );
    const openProcess = kernel32.func(
      'void* __stdcall OpenProcess(uint32 access, int inherit, uint32 pid)',
    );
    const queryName = kernel32.func(
      'int __stdcall QueryFullProcessImageNameW(void *process, uint32 flags, _Out_ char16_t *name, _Inout_ uint32 *size)',
    );
    const closeHandle = kernel32.func(
      'int __stdcall CloseHandle(void *handle)',
    );
    win32 = {
      frontProcessId: () => {
        const handle = getForeground();
        if (!handle) {
          return 0;
        }
        const pid = [0];
        getProcessId(handle, pid);
        return pid[0];
      },
      processName: (pid) => {
        const process = openProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if (!process) {
          return '';
        }
        try {
          const name = Buffer.alloc(1040);
          const size = [520];
          if (!queryName(process, 0, name, size)) {
            return '';
          }
          return path.win32.basename(name.toString('utf16le', 0, size[0] * 2));
        } finally {
          closeHandle(process);
        }
      },
    };
  } catch (error) {
    console.warn(
      'Could not load the window functions for the Info Card:',
      error,
    );
  }
  return win32;
}

export function frontApp(): FrontApp {
  const api = loadWin32();
  if (!api) {
    return null;
  }
  try {
    const pid = api.frontProcessId();
    if (pid === 0) {
      return null;
    }
    if (pid === process.pid) {
      return 'own';
    }
    let name = names.get(pid);
    if (name === undefined) {
      name = api.processName(pid).toLowerCase();
      if (names.size >= MAX_REMEMBERED) {
        names.clear();
      }
      names.set(pid, name);
    }
    return name === 'chrome.exe' ? 'chrome' : 'other';
  } catch {
    return null;
  }
}
