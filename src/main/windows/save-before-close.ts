interface ClosableWindow {
  on(
    event: 'close',
    listener: (event: { preventDefault: () => void }) => void,
  ): unknown;
  destroy(): void;
  isDestroyed(): boolean;
}

interface Options {
  timeoutMs: number;
  isQuitting: () => boolean;
  quit: () => void;
}

// Holds a window's close once, so its page can save what was typed since the
// last autosave, then closes it. A page that never answers, or fails, still
// closes after the timeout. Holding a close also stops a quit, so the quit
// carries on afterwards.
export function saveBeforeClose(
  window: ClosableWindow,
  save: () => Promise<void>,
  { timeoutMs, isQuitting, quit }: Options,
): void {
  let isSaving = false;
  window.on('close', (event) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    isSaving = true;
    const wasQuitting = isQuitting();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    void Promise.race([save().catch(() => undefined), timeout]).then(() => {
      clearTimeout(timer);
      if (!window.isDestroyed()) {
        window.destroy();
      }
      if (wasQuitting) {
        quit();
      }
    });
  });
}
