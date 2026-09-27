import { useEffect, useState } from 'react';

export function useRotation({ enabled, durationSeconds, resetKey, onComplete }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    if (!enabled) return undefined;
    const started = Date.now();
    const interval = setInterval(() => {
      const next = Math.min(1, (Date.now() - started) / (durationSeconds * 1000));
      setProgress(next);
      if (next >= 1) onComplete();
    }, 200);
    return () => clearInterval(interval);
  }, [enabled, durationSeconds, resetKey, onComplete]);

  return progress;
}

