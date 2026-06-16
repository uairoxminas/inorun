import { useState, useEffect } from 'react';

const TARGET = new Date('2026-10-11T07:00:00-03:00').getTime();

export interface CountdownValues {
  d: number; h: number; m: number; s: number;
}

export function useCountdown(): CountdownValues {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = Math.max(0, TARGET - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}
