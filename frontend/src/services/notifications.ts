import type { Notification } from '@/types/models'
import { supabaseClient, unwrap } from './client'

export async function listNotifications(limit = 30): Promise<Notification[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
  const { data, error } = await supabaseClient()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit)
  return unwrap({ data, error }, 'Could not load notifications.')
}

export async function unreadNotificationCount(): Promise<number> {
  const { count, error } = await supabaseClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return unwrap({ data: count ?? 0, error }, 'Could not count unread notifications.')
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data, error } = await supabaseClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  return unwrap({ data, error }, 'Could not mark that notification as read.')
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabaseClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  unwrap({ data: true, error }, 'Could not mark notifications as read.')
}
