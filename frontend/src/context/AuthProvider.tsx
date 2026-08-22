import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { currentEmployee, onAuthChange } from '@/services/auth'
import type { Session } from '@/services/auth'
import { isPrivileged as employeeIsPrivileged } from '@/types/models'
import type { Employee } from '@/types/models'
import { SessionContext } from './session'
import type { SessionStatus } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [employee, setEmployeeState] = useState<Employee | null>(null)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const employeeRef = useRef<Employee | null>(null)
  const requestId = useRef(0)

  const setEmployee = useCallback((next: Employee | null) => {
    employeeRef.current = next
    setEmployeeState(next)
  }, [])

  const loadEmployee = useCallback(async (expectedUserId: string): Promise<Employee | null> => {
    const id = ++requestId.current
    setEmployeeError(null)

    try {
      const next = await currentEmployee()
      if (id !== requestId.current || sessionRef.current?.user.id !== expectedUserId) {
        return null
      }
      setEmployee(next)
      return next
    } catch (error) {
      if (id === requestId.current && sessionRef.current?.user.id === expectedUserId) {
        setEmployee(null)
        setEmployeeError(
          error instanceof Error ? error.message : 'Could not load your employee profile.',
        )
      }
      return null
    }
  }, [setEmployee])

  const refreshEmployee = useCallback(async (): Promise<Employee | null> => {
    const userId = sessionRef.current?.user.id
    if (!userId) {
      setEmployee(null)
      return null
    }
    return loadEmployee(userId)
  }, [loadEmployee, setEmployee])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    try {
      unsubscribe = onAuthChange((event, nextSession) => {
        const previousUserId = sessionRef.current?.user.id
        sessionRef.current = nextSession
        setSession(nextSession)

        if (!nextSession) {
          requestId.current += 1
          setEmployee(null)
          setEmployeeError(null)
          setStatus('unauthenticated')
          return
        }

        setStatus('authenticated')
        const nextUserId = nextSession.user.id
        const userChanged = previousUserId !== nextUserId
        const shouldReload =
          userChanged ||
          !employeeRef.current ||
          event === 'INITIAL_SESSION' ||
          event === 'USER_UPDATED'

        if (userChanged) setEmployee(null)
        if (shouldReload) {
          queueMicrotask(() => {
            void loadEmployee(nextUserId)
          })
        }
      })
    } catch (error) {
      queueMicrotask(() => {
        setEmployeeError(
          error instanceof Error ? error.message : 'Could not initialize authentication.',
        )
        setStatus('unauthenticated')
      })
    }

    return () => unsubscribe?.()
  }, [loadEmployee, setEmployee])

  const value = useMemo(
    () => ({
      status,
      session,
      employee,
      employeeError,
      isPrivileged: employeeIsPrivileged(employee?.role),
      mustChangePassword: employee?.must_change_password ?? false,
      refreshEmployee,
    }),
    [status, session, employee, employeeError, refreshEmployee],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
