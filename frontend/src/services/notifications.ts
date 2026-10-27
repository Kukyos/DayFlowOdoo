import type { Notification } from '@/types/models'
import { api } from './client'

export async function listNotifications(limit = 30): Promise<Notification[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
  return api<Notification[]>('GET', `/notifications?limit=${safeLimit}`, undefined, 'Could not load notifications.')
}

export async function unreadNotificationCount(): Promise<number> {
  const { count } = await api<{ count: number }>(
    'GET',
    '/notifications/unread-count',
    undefined,
    'Could not count unread notifications.',
  )
  return count
}

export async function markNotificationRead(id: string): Promise<Notification> {
  return api<Notification>(
    'POST',
    `/notifications/${encodeURIComponent(id)}/read`,
    undefined,
    'Could not mark that notification as read.',
  )
}

export async function markAllNotificationsRead(): Promise<void> {
  await api('POST', '/notifications/read-all', undefined, 'Could not mark notifications as read.')
}
