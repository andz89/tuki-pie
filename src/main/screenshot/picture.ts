import { ClipboardItem, clipboard } from 'electron';
import type { NativeImage } from 'electron';

// The JPEG itself, from the base64 after the comma of a data address.
export const jpegBytes = (dataUrl: string): Buffer =>
  Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

// As PNG, which every app accepts from the clipboard.
export async function copyPicture(image: NativeImage): Promise<void> {
  const png = image.toPNG();
  await clipboard.write([
    new ClipboardItem({
      'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }),
    }),
  ]);
}
