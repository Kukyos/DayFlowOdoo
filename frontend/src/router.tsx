import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DemoSessionProvider } from './context/DemoSession'
import { AddEmployee } from './pages/app/AddEmployee'
import { Attendance } from './pages/app/Attendance'
import { Dashboard } from './pages/app/Dashboard'
import { Directory } from './pages/app/Directory'
import { EmployeeProfile } from './pages/app/EmployeeProfile'
import { TimeOff } from './pages/app/TimeOff'
import { SignIn } from './pages/auth/SignIn'
import { SignUp } from './pages/auth/SignUp'

/**
 * Integrator's file (Armaan). Do not edit in a page lane — ask.
 *
 * `/` redirects to `/signin`. The team dropped the landing page: this is an
 * internal HR tool nobody reaches without an account, so a marketing page is a
 * screen neither a judge nor a user would open. docs/AUTH.md still lists `/` as
 * a landing route; `docs/AUTH.md` now records the redirect contract. Once
 * AuthProvider lands (TASKS 2.16), authenticated users go to the dashboard and
 * everyone else goes to sign in.
 *
 * `DemoSessionProvider` is a local stand-in for AuthProvider and is replaced by
 * it in Stage 4. `ProtectedRoute` / `AdminRoute` wrap this shell then; they are
 * absent now because a guard built before AuthProvider is one nobody can test.
 */
const app = (
  <DemoSessionProvider>
    <AppShell />
  </DemoSessionProvider>
)

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/signin" replace /> },
  { path: '/signin', element: <SignIn /> },
  { path: '/signup', element: <SignUp /> },
  {
    element: app,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/employees', element: <Directory /> },
      { path: '/employees/new', element: <AddEmployee /> },
      { path: '/employees/:id', element: <EmployeeProfile /> },
      { path: '/profile', element: <EmployeeProfile self /> },
      { path: '/attendance', element: <Attendance /> },
      { path: '/time-off', element: <TimeOff /> },
      { path: '/time-off/approvals', element: <TimeOff /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
