import { useEffect, useState } from 'react';

const DURATION_MS = 700;

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Counts up from 0 to the number, easing out. Shows it at once when the
// system asks for less motion.
export function useCountUp(target: number): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));

  useEffect(() => {
    if (reducedMotion() || target === 0) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const done = Math.min(1, (now - start) / DURATION_MS);
      setValue(Math.round(target * (1 - (1 - done) ** 3)));
      if (done < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}
