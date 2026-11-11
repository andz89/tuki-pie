import path from 'node:path';

const DEFAULT_ROOT = 'C:\\Windows';

// Where each Windows tool the app starts lives, under the Windows folder.
const TOOLS = {
  'reg.exe': ['System32', 'reg.exe'],
  'powershell.exe': ['System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'],
} as const;

export type SystemTool = keyof typeof TOOLS;

// The tool's full path. Started by bare name, Windows looks in the current
// folder first, so a file planted there under that name could run instead.
export function systemToolPath(
  tool: SystemTool,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const root = env.SystemRoot ?? env.windir ?? '';
  const windows = path.win32.isAbsolute(root) ? root : DEFAULT_ROOT;
  return path.win32.join(windows, ...TOOLS[tool]);
}
