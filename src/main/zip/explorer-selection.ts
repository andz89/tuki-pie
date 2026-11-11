import { execFile } from 'node:child_process';
import { systemToolPath } from '../system-tools';

// The window classes of a File Explorer window.
const EXPLORER_CLASSES = new Set(['CabinetWClass', 'ExploreWClass']);

const READ_TIMEOUT_MS = 10000;

interface Win32 {
  // The window in front: its handle for later calls, and its number.
  foregroundWindow(): { handle: unknown; id: bigint } | null;
  className(handle: unknown): string;
  title(handle: unknown): string;
}

// An Explorer window. Its title is the name of the tab that is showing.
export interface ExplorerWindow {
  id: bigint;
  title: string;
}

let win32: Win32 | null | undefined;

// Loaded on first use, and only on Windows. A failed load means no Zip.
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
    const getForeground = user32.func('void* __stdcall GetForegroundWindow()');
    const getClassName = user32.func(
      'int __stdcall GetClassNameW(void *hwnd, _Out_ char16_t *name, int max)',
    );
    const getText = user32.func(
      'int __stdcall GetWindowTextW(void *hwnd, _Out_ char16_t *text, int max)',
    );
    const readText = (
      read: (handle: unknown, out: Buffer, max: number) => unknown,
      handle: unknown,
    ) => {
      const text = Buffer.alloc(1024);
      const length = read(handle, text, 512) as number;
      return text.toString('utf16le', 0, length * 2);
    };
    win32 = {
      foregroundWindow: () => {
        const handle = getForeground();
        return handle ? { handle, id: BigInt(koffi.address(handle)) } : null;
      },
      className: (handle) => readText(getClassName, handle),
      title: (handle) => readText(getText, handle),
    };
  } catch (error) {
    console.warn('Could not load the window functions for Zip:', error);
  }
  return win32;
}

// The File Explorer window in front, if that is what is in front.
export function frontExplorerWindow(): ExplorerWindow | null {
  const api = loadWin32();
  if (!api) {
    return null;
  }
  try {
    const front = api.foregroundWindow();
    const className = front ? api.className(front.handle) : '';
    if (!front || !EXPLORER_CLASSES.has(className)) {
      console.info(`[zip] In front: ${className || 'nothing'}, not Explorer.`);
      return null;
    }
    return { id: front.id, title: api.title(front.handle) };
  } catch (error) {
    console.warn('Could not read the window in front:', error);
    return null;
  }
}

// Asks Explorer which items are selected in that window. Each tab of a
// Windows 11 Explorer window shares its number, so the tab whose name is the
// window title wins, else the first tab with anything selected. The title
// goes in as base64, so no folder name can change what the script runs.
export function selectionScript({ id, title }: ExplorerWindow): string {
  const encodedTitle = Buffer.from(title, 'utf8').toString('base64');
  return [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    `$title = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedTitle}'))`,
    '$shell = New-Object -ComObject Shell.Application',
    `$tabs = @($shell.Windows() | Where-Object { [int64]$_.HWND -eq ${id.toString()} })`,
    '$tab = $tabs | Where-Object { $_.LocationName -and ($title -eq $_.LocationName -or $title.StartsWith($_.LocationName + " ")) } | Select-Object -First 1',
    'if (-not $tab) { $tab = $tabs | Where-Object { @($_.Document.SelectedItems()).Count -gt 0 } | Select-Object -First 1 }',
    'if ($tab) { $tab.Document.SelectedItems() | ForEach-Object { $_.Path } }',
  ].join('\n');
}

export function parseSelection(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function readExplorerSelection(
  window: ExplorerWindow,
): Promise<string[]> {
  const encoded = Buffer.from(selectionScript(window), 'utf16le').toString(
    'base64',
  );
  return new Promise((resolve) => {
    execFile(
      systemToolPath('powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: READ_TIMEOUT_MS, encoding: 'utf8' },
      (error, stdout) => {
        if (error) {
          console.warn('Could not read the Explorer selection:', error.message);
          resolve([]);
          return;
        }
        const files = parseSelection(stdout);
        console.info(
          `[zip] Explorer "${window.title}": ${files.length} selected.`,
        );
        resolve(files);
      },
    );
  });
}
