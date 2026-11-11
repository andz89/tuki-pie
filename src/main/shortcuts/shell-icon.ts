import { execFile } from 'node:child_process';
import { systemToolPath } from '../system-tools';

// --- The picture Explorer shows for a file -------------------------------------
// Store apps (ChatGPT, Snipping Tool) are shortcuts with no file behind them,
// so neither Electron nor the shortcut can say what their icon is. Windows'
// own image service can. It takes PowerShell a few seconds, so this is the
// last thing tried, and the donut keeps what it gets.

const TIMEOUT_MS = 15_000;
const SIZE = 64;

// The path arrives in an environment variable, never inside the script, so
// nothing in it can run as code.
const SCRIPT = `
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
public static class PieShellIcon {
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx; public int cy; public SIZE(int x, int y) { cx = x; cy = y; } }
  [StructLayout(LayoutKind.Sequential)] struct BITMAP { public int bmType, bmWidth, bmHeight, bmWidthBytes; public ushort bmPlanes, bmBitsPixel; public IntPtr bmBits; }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IShellItemImageFactory item);
  [DllImport("gdi32.dll")] static extern int GetObject(IntPtr h, int size, out BITMAP bmp);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
  public static string Png(string path, int size) {
    IShellItemImageFactory factory;
    SHCreateItemFromParsingName(path, IntPtr.Zero, new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), out factory);
    IntPtr hbm;
    int hr = factory.GetImage(new SIZE(size, size), 4, out hbm);
    if (hr != 0) throw new Exception("GetImage " + hr);
    try {
      BITMAP info;
      GetObject(hbm, Marshal.SizeOf(typeof(BITMAP)), out info);
      int w = info.bmWidth, h = info.bmHeight, stride = info.bmWidthBytes;
      byte[] bits = new byte[stride * h];
      Marshal.Copy(info.bmBits, bits, 0, bits.Length);
      using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        for (int y = 0; y < h; y++) Marshal.Copy(bits, (h - 1 - y) * stride, data.Scan0 + y * data.Stride, w * 4);
        bmp.UnlockBits(data);
        using (var ms = new MemoryStream()) { bmp.Save(ms, ImageFormat.Png); return Convert.ToBase64String(ms.ToArray()); }
      }
    } finally { DeleteObject(hbm); }
  }
}
'@
[Console]::Out.Write([PieShellIcon]::Png($env:PIE_ICON_PATH, ${SIZE}))
`;

const ENCODED = Buffer.from(SCRIPT, 'utf16le').toString('base64');

// A PNG image address, or null when Windows has no picture for it.
export function shellIconOf(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      systemToolPath('powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        ENCODED,
      ],
      {
        // Windows reads this path only with backslashes.
        env: { ...process.env, PIE_ICON_PATH: path.replaceAll('/', '\\') },
        timeout: TIMEOUT_MS,
        windowsHide: true,
      },
      (error, stdout) => {
        const base64 = String(stdout).trim();
        resolve(
          error || !/^[A-Za-z0-9+/=]+$/.test(base64)
            ? null
            : `data:image/png;base64,${base64}`,
        );
      },
    );
  });
}
