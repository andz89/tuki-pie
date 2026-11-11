export const GROUP_HOVER_MS = 180;

// Waits to see whether the mouse is resting on something or only passing over.
export function createHoverIntent(
  delayMs: number,
  onFire: (id: string) => void,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pausedUntil = 0;

  const leave = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    enter(id: string): void {
      leave();
      if (Date.now() < pausedUntil) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        onFire(id);
      }, delayMs);
    },
    leave,
    pause(ms: number): void {
      leave();
      pausedUntil = Date.now() + ms;
    },
  };
}
