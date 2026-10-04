import { useEffect, useRef, useState } from 'react';
import { t } from '../data/translations.js';
import { fetchPortraitCount } from '../services/supabase.js';

// Counter starts at COUNTER_BASE and keeps growing on its own (roughly one new
// portrait every COUNTER_SECONDS_PER_PORTRAIT (default 3) seconds since COUNTER_START), so
// every visitor sees a similar, always-increasing number. Real portraits saved
// in the database are added on top. Override any of these in .env.
const BASE = Number(import.meta.env.VITE_COUNTER_BASE) || 100000;
const START = Date.parse(import.meta.env.VITE_COUNTER_START || '2026-09-28T00:00:00+05:30');
const SECONDS_PER = Number(import.meta.env.VITE_COUNTER_SECONDS_PER_PORTRAIT) || 3;

const rand = (min, max) => min + Math.random() * (max - min);

function timeBasedCount() {
  const elapsed = Math.max(0, (Date.now() - START) / 1000);
  return BASE + Math.floor(elapsed / SECONDS_PER);
}

export default function LiveCounter({ lang }) {
  const [real, setReal] = useState(0);
  const realRef = useRef(0);
  const [value, setValue] = useState(() => timeBasedCount());
  const [pulse, setPulse] = useState(false);

  // Real portraits from the database (refreshed every 60s).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const n = await fetchPortraitCount();
      if (!alive) return;
      realRef.current = n;
      setReal(n);
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // The number is always computed from the clock (+ real portraits), so it only
  // ever goes UP, also across page refreshes and for every visitor. We just
  // re-check it every 2-5 seconds, which makes it move in small jumps
  // (100000 -> 100001 -> 100003 ...).
  useEffect(() => {
    let timer;
    const tick = () => {
      setValue((prev) => {
        const next = timeBasedCount() + realRef.current;
        if (next > prev) {
          setPulse(true);
          setTimeout(() => setPulse(false), 450);
          return next;
        }
        return prev;
      });
      timer = setTimeout(tick, rand(2000, 5000));
    };
    timer = setTimeout(tick, rand(1500, 3500));
    return () => clearTimeout(timer);
  }, []);

  const shown = Math.max(value, timeBasedCount() + real);

  return (
    <div className="live-counter" role="status" aria-live="off">
      <span className="live-dot" aria-hidden="true" />
      <span className={`live-number ${pulse ? 'is-pulse' : ''}`}>
        {shown.toLocaleString('en-IN')}
      </span>
      <span className="live-label">{t(lang, 'liveCount')}</span>
    </div>
  );
}
