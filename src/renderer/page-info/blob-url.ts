// A blob address for a data address. A big data address held in React state
// and repeated in each <img> costs memory several times over; a blob address
// is one copy, released with URL.revokeObjectURL when no longer shown.
export function blobUrlFromDataUrl(dataUrl: string): string {
  const [head, base64 = ''] = dataUrl.split(',', 2);
  const type = /^data:([^;,]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type }));
}
