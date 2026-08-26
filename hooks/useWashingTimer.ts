import { useEffect, useState } from 'react';

export type WashingTargetEndTime = string | number | null | undefined;

export function getRemainingWashingSeconds(targetEndTime: WashingTargetEndTime, now = Date.now()): number {
  const target = typeof targetEndTime === 'string' ? Date.parse(targetEndTime) : targetEndTime;

  if (typeof target !== 'number' || !Number.isFinite(target)) {
    return 0;
  }

  return Math.max(0, Math.floor((target - now) / 1000));
}

export function useWashingTimer(targetEndTimes: Record<string, WashingTargetEndTime>) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 250);

    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return Object.fromEntries(
    Object.entries(targetEndTimes).map(([key, targetEndTime]) => [
      key,
      getRemainingWashingSeconds(targetEndTime, now),
    ])
  );
}
