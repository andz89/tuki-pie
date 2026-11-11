// Wraps a save so a second submit (a double click, Enter held down) is
// ignored while the first is still on its way.
export function oneAtATime(run: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => {
    if (running) {
      return running;
    }
    running = run().finally(() => {
      running = null;
    });
    return running;
  };
}
