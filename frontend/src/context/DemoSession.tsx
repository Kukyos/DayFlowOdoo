import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as fx from '@/fixtures'
import { isPrivileged } from '@/types/models'
import type { Employee } from '@/types/models'

/**
 * LOCAL ONLY — a stand-in for `AuthProvider`, which is Praneet's (TASKS 2.16).
 *
 * It exposes the same shape docs/AUTH.md specifies, so pages consume the real
 * thing unchanged once it lands: `status`, `employee`, `isPrivileged`. What it
 * does *not* do is authenticate — it reads a fixture employee.
 *
 * It also carries a role switcher, which the real provider will not have. Being
 * able to flip between the admin and the employee view in one click is how the
 * two halves of this app get demonstrated at all — every screen behind the
 * privileged check is otherwise invisible from an employee account.
 */

type SessionValue = {
  status: 'loading' | 'authenticated' | 'unauthenticated'
  employee: Employee | null
  isPrivileged: boolean
  viewAs: 'admin' | 'employee'
  setViewAs: (v: 'admin' | 'employee') => void
  refresh: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

const VIEW_KEY = 'dayflow-demo-view'

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionValue['status']>('loading')
  const [viewAs, setViewAsState] = useState<'admin' | 'employee'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'employee' ? 'employee' : 'admin'
    } catch {
      return 'admin'
    }
  })
  const [tick, setTick] = useState(0)

  // Resolves asynchronously on purpose. The real provider reads the persisted
  // Supabase session, so `loading` is a state every consumer must handle —
  // pinning it to authenticated from first render would make the transition
  // structurally invisible and hide a whole class of bug.
  useEffect(() => {
    const t = setTimeout(() => setStatus('authenticated'), 180)
    return () => clearTimeout(t)
  }, [])

  const setViewAs = useCallback((v: 'admin' | 'employee') => {
    setViewAsState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* blocked storage — the choice just will not persist */
    }
  }, [])

  const employee = useMemo(() => {
    void tick
    const id = viewAs === 'admin' ? fx.CURRENT_ADMIN_ID : fx.CURRENT_EMPLOYEE_ID
    return fx.byId(id) ?? null
  }, [viewAs, tick])

  const value = useMemo<SessionValue>(
    () => ({
      status,
      employee: status === 'authenticated' ? employee : null,
      isPrivileged: status === 'authenticated' && isPrivileged(employee?.role),
      viewAs,
      setViewAs,
      refresh: () => setTick((n) => n + 1),
    }),
    [status, employee, viewAs, setViewAs],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside DemoSessionProvider')
  return ctx
}
