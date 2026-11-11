// A full Windows path, like C:\Folder or \\server\share, rather than a web
// address. A drive letter alone with a colon could be a port, so the slash
// after it is required.
export function isLocalPath(value: string): boolean {
  return /^[a-z]:[\\/]/i.test(value) || /^\\\\[^\\]/.test(value);
}

// Explorer's "Copy as path" wraps the path in double quotes, which Windows
// never allows inside a name, so they are always safe to remove.
export function cleanPastedPath(value: string): string {
  return value
    .trim()
    .replace(/^"+|"+$/g, '')
    .trim();
}
