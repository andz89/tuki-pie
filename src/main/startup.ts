type StartupDeps = {
  showError: (message: string) => void;
  exit: (code: number) => void;
};

// Runs the app's start in one place, so a failure (a corrupt database, a
// native module built for another Electron) is shown instead of leaving an
// invisible process that holds the single-instance lock.
export class Startup {
  private cleanups: Array<() => void> = [];

  // Registered as each part starts, so a failed start only stops what ran.
  onQuit(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  // Newest first. Each runs once, and one failing does not stop the rest.
  cleanUp(): void {
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        console.warn('Cleanup failed:', error);
      }
    }
  }

  run(start: () => void, { showError, exit }: StartupDeps): void {
    try {
      start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(message);
      // app.exit skips will-quit, so clean up here.
      this.cleanUp();
      exit(1);
    }
  }
}
