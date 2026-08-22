import { createContext, useContext } from 'react'
import type { Employee } from '@/types/models'
import type { Session } from '@/services/auth'

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type SessionValue = {
  status: SessionStatus
  session: Session | null
  employee: Employee | null
  employeeError: string | null
  isPrivileged: boolean
  mustChangePassword: boolean
  refreshEmployee: () => Promise<Employee | null>
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside AuthProvider')
  return value
}
