import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Avatar, Button, cx } from '@/components/ui'
import { useSession } from '@/context/session'
import { ATTENDANCE_CHANGED, emitAppEvent } from '@/hooks/useAppEvent'
import { formatTime, timeAgo } from '@/lib/dates'
import { currentTheme, toggleTheme, type Theme } from '@/lib/theme'
import { checkIn, checkOut, todayStatus } from '@/services/attendance'
import { signOut } from '@/services/auth'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from '@/services/notifications'
import {
  deleteCompanyLogo,
  getCompany,
  updateCompany,
  uploadCompanyLogo,
} from '@/services/company'
import type { Company, Notification } from '@/types/models'
import { fullName } from '@/types/models'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/employees', label: 'Employees' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/time-off', label: 'Time Off' },
]

export function AppShell() {
  const { employee, isPrivileged, refreshEmployee } = useSession()
  const [company, setCompany] = useState<Company | null>(null)

  useEffect(() => {
    let active = true
    void getCompany().then((next) => {
      if (active) setCompany(next)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  if (!employee) return null

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 lg:px-8">
          <Link to="/dashboard" className="flex items-center gap-2 t-h3 font-display tracking-normal">
            {company?.logo_url && (
              <img src={company.logo_url} alt="" className="h-8 w-8 rounded-control object-contain" />
            )}
            {company?.name ?? 'Dayflow'}
          </Link>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto lg:order-none lg:w-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx(
                    'shrink-0 border-b-2 px-3 py-2 t-caption font-medium transition-colors',
                    isActive
                      ? 'border-text text-text'
                      : 'border-transparent text-text-muted hover:text-text',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <CheckInControl onChange={() => { void refreshEmployee() }} />
            <NotificationBell />
            <AvatarMenu
              name={fullName(employee)}
              role={isPrivileged ? 'Admin / HR' : 'Employee'}
              avatarUrl={employee.avatar_url}
              isPrivileged={isPrivileged}
              onCompanyLogo={async (file) => {
                let logoUrl: string | null = null
                try {
                  logoUrl = await uploadCompanyLogo(file)
                  const updated = await updateCompany({ logo_url: logoUrl })
                  if (company?.logo_url) {
                    void deleteCompanyLogo(company.logo_url).catch(() => undefined)
                  }
                  setCompany(updated)
                } catch (cause) {
                  if (logoUrl) void deleteCompanyLogo(logoUrl).catch(() => undefined)
                  throw cause
                }
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pt-3 pb-10 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * The systray check in / check out. One row per employee per day, so checking
 * in twice is an error rather than a second row — the service enforces it and
 * this control reflects the three states: not in yet, in, done for the day.
 */
function CheckInControl({ onChange }: { onChange: () => void }) {
  const [state, setState] = useState<{
    checkedIn: boolean
    checkIn: string | null
    checkOut: string | null
  }>({ checkedIn: false, checkIn: null, checkOut: null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const s = await todayStatus()
    setState({
      checkedIn: s.checkedIn,
      checkIn: s.row?.check_in ?? null,
      checkOut: s.row?.check_out ?? null,
    })
  }, [])

  useEffect(() => {
    void load().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Could not load today\'s attendance.')
    })
  }, [load])

  async function act() {
    setBusy(true)
    setError(null)
    try {
      if (state?.checkedIn) await checkOut()
      else await checkIn()
      await load()
      onChange()
      emitAppEvent(ATTENDANCE_CHANGED)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record that.')
    } finally {
      setBusy(false)
    }
  }

  const done = Boolean(state.checkOut)

  return (
    <div className="relative flex items-center gap-2">
      {state.checkIn && (
        <span className="t-data hidden text-text-muted md:inline">
          {formatTime(state.checkIn)}
          {state.checkOut ? ` – ${formatTime(state.checkOut)}` : ''}
        </span>
      )}
      <Button size="sm" onClick={act} disabled={busy || done}>
        {done ? 'Done for today' : state.checkedIn ? 'Check out' : 'Check in'}
      </Button>
      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-control border border-danger-ink bg-surface-raised px-3 py-2 t-label font-normal normal-case text-danger-ink"
        >
          {error}
        </p>
      )}
    </div>
  )
}

/** Closes a dropdown on an outside click or Escape. Returns the ref for its wrapper. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 20.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Leave decisions, written by the server when Admin/HR approve or reject. The
 * unread count refreshes every minute and whenever the window regains focus.
 */
function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshCount = useCallback(() => {
    void unreadNotificationCount().then(setUnread).catch(() => undefined)
  }, [])

  useEffect(() => {
    refreshCount()
    const timer = window.setInterval(refreshCount, 60_000)
    window.addEventListener('focus', refreshCount)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshCount)
    }
  }, [refreshCount])

  function toggle() {
    const next = !open
    setOpen(next)
    if (!next) return
    setError(null)
    void listNotifications(10)
      .then(setItems)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load notifications.')
      })
  }

  async function openItem(item: Notification) {
    setOpen(false)
    if (!item.read_at) {
      await markNotificationRead(item.id).catch(() => undefined)
      refreshCount()
    }
    navigate('/time-off')
  }

  async function markAll() {
    try {
      await markAllNotificationsRead()
      const now = new Date().toISOString()
      setItems((current) => current?.map((item) => ({ ...item, read_at: item.read_at ?? now })) ?? null)
      setUnread(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications as read.')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-neutral-fill hover:text-text"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-text px-1 t-label text-[10px] leading-none text-bg">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2.5rem)] rounded-card border border-border bg-surface-raised p-1"
        >
          <div className="flex items-center justify-between border-b border-border-soft px-3 py-2">
            <p className="t-caption font-bold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => { void markAll() }} className="t-label text-text-muted hover:text-text">
                Mark all read
              </button>
            )}
          </div>
          {error && <p role="alert" className="px-3 py-3 t-label text-danger-ink">{error}</p>}
          {!error && items === null && <p className="px-3 py-3 t-caption text-text-muted">Loading…</p>}
          {!error && items?.length === 0 && (
            <p className="px-3 py-6 t-caption text-text-muted">
              Nothing yet. Decisions on your time-off requests appear here.
            </p>
          )}
          {items && items.length > 0 && (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { void openItem(item) }}
                    className="flex w-full gap-3 rounded-control px-3 py-2.5 text-left hover:bg-neutral-fill"
                  >
                    <span
                      aria-hidden="true"
                      className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.read_at ? 'bg-transparent' : 'bg-text')}
                    />
                    <span className="min-w-0">
                      <span className={cx('block t-caption', !item.read_at && 'font-bold')}>
                        {item.title}
                        {!item.read_at && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="mt-0.5 block t-label font-normal normal-case text-text-muted">
                        {item.message}
                      </span>
                      <span className="mt-1 block t-label font-normal normal-case text-text-muted">
                        {timeAgo(item.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function AvatarMenu({
  name,
  role,
  avatarUrl,
  isPrivileged,
  onCompanyLogo,
}: {
  name: string
  role: string
  avatarUrl: string | null
  isPrivileged: boolean
  onCompanyLogo: (file: File) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const [theme, setThemeState] = useState<Theme>(currentTheme)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="rounded-full"
      >
        <Avatar name={name} src={avatarUrl} size={36} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 rounded-card border border-border bg-surface-raised p-1"
        >
          <div className="border-b border-border-soft px-3 py-3">
            <p className="t-caption font-bold">{name}</p>
            <p className="t-label mt-1 text-text-muted">{role}</p>
          </div>
          <MenuItem onClick={() => { setOpen(false); navigate('/profile') }}>
            My Profile
          </MenuItem>
          <MenuItem onClick={() => { setOpen(false); navigate('/change-password') }}>
            Change password
          </MenuItem>
          {isPrivileged && (
            <label className="block w-full cursor-pointer rounded-control px-3 py-2 t-caption hover:bg-neutral-fill">
              {uploadingLogo ? 'Uploading logo…' : 'Change company logo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="sr-only"
                disabled={uploadingLogo}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setUploadingLogo(true)
                  setAccountError(null)
                  void onCompanyLogo(file)
                    .catch((cause: unknown) => {
                      setAccountError(cause instanceof Error ? cause.message : 'Could not update the company logo.')
                    })
                    .finally(() => setUploadingLogo(false))
                }}
              />
            </label>
          )}
          <MenuItem
            onClick={() => {
              setThemeState(toggleTheme())
            }}
          >
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAccountError(null)
              void signOut()
                .then(() => {
                  setOpen(false)
                  navigate('/signin', { replace: true })
                })
                .catch((error: unknown) => {
                  setAccountError(
                    error instanceof Error ? error.message : 'Could not log out.',
                  )
                })
            }}
          >
            Log Out
          </MenuItem>
          {accountError && (
            <p role="alert" className="px-3 py-2 t-label text-danger-ink">
              {accountError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full rounded-control px-3 py-2 text-left t-caption hover:bg-neutral-fill"
    >
      {children}
    </button>
  )
}
