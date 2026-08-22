import { useCallback, useEffect, useState } from 'react'

type State<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: string }

/**
 * Loading / ready / error for one service call.
 *
 * Exists so every page gets all three states by construction. The definition of
 * done requires loading, empty and error on every page, and the reliable way to
 * get that is to make the happy path the one that takes extra work to write.
 *
 * `deps` behaves like a `useEffect` dependency list.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({
    status: 'loading',
    data: null,
    error: null,
  })
  const [nonce, setNonce] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)

  useEffect(() => {
    let alive = true
    setState({ status: 'loading', data: null, error: null })
    run()
      .then((data) => {
        // Guard against a slow response from a previous filter landing after a
        // newer one and overwriting it.
        if (alive) setState({ status: 'ready', data, error: null })
      })
      .catch((e: unknown) => {
        if (alive) {
          setState({
            status: 'error',
            data: null,
            error: e instanceof Error ? e.message : 'Something went wrong.',
          })
        }
      })
    return () => {
      alive = false
    }
  }, [run, nonce])

  return { ...state, reload: () => setNonce((n) => n + 1) }
}

/** Debounced value, for search inputs that hit a service on every keystroke. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
