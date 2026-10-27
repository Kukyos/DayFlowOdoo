import { Hono } from 'hono'
import { HttpError } from './http.ts'
import type { AppEnv } from './http.ts'
import { attendanceRoutes } from './routes/attendance.ts'
import { authRoutes } from './routes/auth.ts'
import { companyRoutes } from './routes/company.ts'
import { dashboardRoutes } from './routes/dashboard.ts'
import { employeeRoutes } from './routes/employees.ts'
import { fileRoutes } from './routes/files.ts'
import { leaveRoutes } from './routes/leave.ts'
import { notificationRoutes } from './routes/notifications.ts'

export const app = new Hono<AppEnv>().basePath('/api')

app.route('/auth', authRoutes)
app.route('/company', companyRoutes)
app.route('/attendance', attendanceRoutes)
app.route('/leave', leaveRoutes)
app.route('/dashboard', dashboardRoutes)
app.route('/notifications', notificationRoutes)
app.route('/', fileRoutes)
app.route('/', employeeRoutes)

app.notFound((c) => c.json({ message: 'Not found.' }, 404))

/** Every failure reaches the browser as `{ message }`, which services show as-is. */
app.onError((error, c) => {
  if (error instanceof HttpError) return c.json({ message: error.message }, error.status)
  if (/constraint failed/i.test(error.message)) {
    return c.json({ message: 'That change conflicts with existing data.' }, 400)
  }
  console.error(error)
  return c.json({ message: 'Something went wrong on the server.' }, 500)
})
