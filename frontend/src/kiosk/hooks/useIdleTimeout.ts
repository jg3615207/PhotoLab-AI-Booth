import { useEffect, useRef } from 'react';

export function useIdleTimeout(onIdle: () => void, timeoutMs: number = 60000, enabled: boolean = true) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (enabled) {
      timeoutRef.current = setTimeout(() => {
        onIdle();
      }, timeoutMs);
    }
  };

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer();

    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [enabled, timeoutMs, onIdle]);
}
