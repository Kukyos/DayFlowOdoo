import { Hono } from 'hono'
import { requireEmployee } from '../auth.ts'
import { all, one, run } from '../db.ts'
import { nowISO } from '../dates.ts'
import { notFound } from '../http.ts'
import type { AppEnv } from '../http.ts'

/**
 * Notifications are written by the server when a leave request is decided.
 * Employees can only read their own and mark them read.
 */
export const notificationRoutes = new Hono<AppEnv>()

notificationRoutes.use('*', requireEmployee)

notificationRoutes.get('/', (c) => {
  const limit = Math.min(Math.max(Math.trunc(Number(c.req.query('limit')) || 30), 1), 100)
  return c.json(all(
    'select * from notifications where employee_id = ? order by created_at desc limit ?',
    c.var.me.id, limit,
  ))
})

notificationRoutes.get('/unread-count', (c) => {
  const row = one<{ count: number }>(
    'select count(*) as count from notifications where employee_id = ? and read_at is null',
    c.var.me.id,
  )!
  return c.json({ count: row.count })
})

notificationRoutes.post('/read-all', (c) => {
  run(
    'update notifications set read_at = ? where employee_id = ? and read_at is null',
    nowISO(), c.var.me.id,
  )
  return c.json({ ok: true })
})

notificationRoutes.post('/:id/read', (c) => {
  const id = c.req.param('id')
  const result = run(
    'update notifications set read_at = coalesce(read_at, ?) where id = ? and employee_id = ?',
    nowISO(), id, c.var.me.id,
  )
  if (result.changes === 0) throw notFound('That notification does not exist.')
  return c.json(one('select * from notifications where id = ?', id))
})
