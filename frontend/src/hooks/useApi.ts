import { useCallback, useEffect, useState, type DependencyList } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
}

/**
 * Loads data when the component mounts and whenever `deps` change.
 * Keeps the previous data while reloading, so tables don't flash empty.
 */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: true, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    load()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error: unknown) => active && setState((previous) => ({ ...previous, loading: false, error })));
    return () => {
      active = false;
    };
    // `load` is a new function every render, so the caller lists the real dependencies in `deps`.
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
