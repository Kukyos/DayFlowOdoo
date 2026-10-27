import { useEffect, useRef } from 'react'

/**
 * App-wide signals between parts of the page that do not share state — the
 * header's Check In control and the pages showing today's attendance.
 */
export const ATTENDANCE_CHANGED = 'dayflow:attendance-changed'

export function emitAppEvent(name: string): void {
  window.dispatchEvent(new Event(name))
}

/** Runs `handler` whenever `name` is emitted, always calling its latest version. */
export function useAppEvent(name: string, handler: () => void): void {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    const listener = () => latest.current()
    window.addEventListener(name, listener)
    return () => window.removeEventListener(name, listener)
  }, [name])
}
