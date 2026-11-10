import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads something async; `refresh` reloads. Ignores results that arrive after unmount or a newer call. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const load = useCallback(() => {
    const mine = ++seq.current;
    setLoading(true);
    fnRef.current().then(
      (v) => { if (mine === seq.current) { setData(v); setError(null); setLoading(false); } },
      (e) => { if (mine === seq.current) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); } },
    );
  }, []);
  const invalidate = useCallback(() => { seq.current++; }, []);
  useEffect(() => {
    // Deferred a tick so the effect itself never sets state synchronously.
    const t = setTimeout(load, 0);
    return () => { clearTimeout(t); invalidate(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, loading, refresh: load };
}
