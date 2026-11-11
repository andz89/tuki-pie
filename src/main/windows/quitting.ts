let quitting = false;

// Set on before-quit. Windows that only hide on close let the close through
// once the app is quitting.
export function markQuitting(): void {
  quitting = true;
}

export function isQuitting(): boolean {
  return quitting;
}
