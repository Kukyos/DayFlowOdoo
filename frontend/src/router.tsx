import { createBrowserRouter } from 'react-router-dom'
import { Scaffold } from './pages/Scaffold'

/**
 * Integrator's file (Armaan). Do not edit in a page lane — ask.
 *
 * Every route in docs/AUTH.md section 4 has a slot here, all pointing at
 * Scaffold until a real page lands. Claim your route in docs/TASKS.md, then
 * swap its `element` for your page in the same commit as the page.
 *
 * Guards are deliberately absent: ProtectedRoute and AdminRoute are task 2.16
 * in the backend lane, and wrapping these routes before AuthProvider exists
 * would only produce a guard nobody can test.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Scaffold name="Landing" /> },
  { path: '/signin', element: <Scaffold name="Sign in" /> },
  { path: '/signup', element: <Scaffold name="Sign up" /> },
  { path: '/change-password', element: <Scaffold name="Change password" /> },
  { path: '/dashboard', element: <Scaffold name="Dashboard" /> },
  { path: '/employees', element: <Scaffold name="Employee directory" /> },
  { path: '/employees/new', element: <Scaffold name="Add employee" /> },
  { path: '/employees/:id', element: <Scaffold name="Employee profile" /> },
  { path: '/profile', element: <Scaffold name="My profile" /> },
  { path: '/attendance', element: <Scaffold name="Attendance" /> },
  { path: '/time-off', element: <Scaffold name="Time off" /> },
  { path: '/time-off/approvals', element: <Scaffold name="Leave approvals" /> },
  { path: '/payslips', element: <Scaffold name="Payslips" /> },
  { path: '*', element: <Scaffold name="Not found" /> },
])
