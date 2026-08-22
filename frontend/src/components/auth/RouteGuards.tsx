import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button, ErrorState, Spinner } from '@/components/ui'
import { useSession } from '@/context/session'
import { signOut } from '@/services/auth'

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-5 text-text">
      <div className="w-full max-w-xl">{children}</div>
    </main>
  )
}

function EmployeeLoadFailure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <FullPage>
      <ErrorState message={message} onRetry={retry} />
      <div className="mt-4 text-center">
        <Button
          size="sm"
          onClick={() => {
            void signOut()
          }}
        >
          Log out
        </Button>
      </div>
    </FullPage>
  )
}

function AuthenticatedState({ allowPasswordChange = false }: { allowPasswordChange?: boolean }) {
  const location = useLocation()
  const {
    status,
    employee,
    employeeError,
    mustChangePassword,
    refreshEmployee,
  } = useSession()

  if (status === 'loading') {
    return <FullPage><Spinner label="Restoring your session" /></FullPage>
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  if (employeeError) {
    return (
      <EmployeeLoadFailure
        message={employeeError}
        retry={() => { void refreshEmployee() }}
      />
    )
  }
  if (!employee) {
    return <FullPage><Spinner label="Loading your employee profile" /></FullPage>
  }
  if (mustChangePassword && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />
  }

  return <Outlet />
}

export function ProtectedRoute() {
  return <AuthenticatedState />
}

export function PasswordChangeRoute() {
  return <AuthenticatedState allowPasswordChange />
}

export function AdminRoute() {
  const { isPrivileged } = useSession()
  return isPrivileged ? <Outlet /> : <Navigate to="/dashboard" replace />
}

export function PublicOnlyRoute() {
  const { status, employee, employeeError, mustChangePassword, refreshEmployee } = useSession()

  if (status === 'loading') {
    return <FullPage><Spinner label="Restoring your session" /></FullPage>
  }
  if (status === 'unauthenticated') return <Outlet />
  if (employeeError) {
    return (
      <EmployeeLoadFailure
        message={employeeError}
        retry={() => { void refreshEmployee() }}
      />
    )
  }
  if (!employee) {
    return <FullPage><Spinner label="Loading your employee profile" /></FullPage>
  }

  return <Navigate to={mustChangePassword ? '/change-password' : '/dashboard'} replace />
}

export function RootRedirect() {
  const { status } = useSession()
  if (status === 'loading') {
    return <FullPage><Spinner label="Restoring your session" /></FullPage>
  }
  return <Navigate to={status === 'authenticated' ? '/dashboard' : '/signin'} replace />
}
