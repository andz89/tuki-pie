import { describe, expect, it } from 'vitest';
import { systemToolPath } from './system-tools';

describe('systemToolPath', () => {
  it('finds reg.exe in System32 of the Windows folder', () => {
    expect(systemToolPath('reg.exe', { SystemRoot: 'D:\\Win' })).toBe(
      'D:\\Win\\System32\\reg.exe',
    );
  });

  it('finds Windows PowerShell in its own folder', () => {
    expect(
      systemToolPath('powershell.exe', { SystemRoot: 'C:\\Windows' }),
    ).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  });

  it('falls back to windir, then to C:\\Windows', () => {
    expect(systemToolPath('reg.exe', { windir: 'E:\\W' })).toBe(
      'E:\\W\\System32\\reg.exe',
    );
    expect(systemToolPath('reg.exe', {})).toBe(
      'C:\\Windows\\System32\\reg.exe',
    );
  });

  it('never uses a Windows folder that is not a full path', () => {
    expect(systemToolPath('reg.exe', { SystemRoot: 'Windows' })).toBe(
      'C:\\Windows\\System32\\reg.exe',
    );
  });
});
