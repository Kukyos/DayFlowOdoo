import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Avatar, Button, cx } from '@/components/ui'
import { useSession } from '@/context/DemoSession'
import { formatTime } from '@/lib/dates'
import { currentTheme, toggleTheme, type Theme } from '@/lib/theme'
import { checkIn, checkOut, todayStatus } from '@/services/attendance'
import { signOut } from '@/services/auth'
import { fullName } from '@/types/models'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/employees', label: 'Employees' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/time-off', label: 'Time Off' },
]

export function AppShell() {
  const { employee, status, isPrivileged, viewAs, setViewAs, refresh } = useSession()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted">
        <span className="t-caption">Loading…</span>
      </div>
    )
  }
  if (!employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Link to="/signin" className="t-caption underline">
          Sign in to continue
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 lg:px-8">
          <Link to="/dashboard" className="t-h3 font-display tracking-normal">
            Dayflow
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
            <RoleSwitch viewAs={viewAs} setViewAs={setViewAs} />
            <CheckInControl employeeId={employee.id} onChange={refresh} />
            <AvatarMenu
              name={fullName(employee)}
              role={isPrivileged ? 'Admin / HR' : 'Employee'}
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
 * Demo-only. The real app derives the role from the signed-in employee row;
 * this exists so both halves of the product can be shown without two accounts.
 */
function RoleSwitch({
  viewAs,
  setViewAs,
}: {
  viewAs: 'admin' | 'employee'
  setViewAs: (v: 'admin' | 'employee') => void
}) {
  return (
    <div
      className="hidden items-center rounded-control border border-border-soft p-0.5 sm:flex"
      title="Demo only — switches which seeded account you are viewing as"
    >
      {(['admin', 'employee'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setViewAs(v)}
          aria-pressed={viewAs === v}
          className={cx(
            'rounded-[4px] px-2.5 py-1 t-label transition-colors',
            viewAs === v ? 'bg-text text-bg' : 'text-text-muted hover:text-text',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

/**
 * The systray check in / check out. One row per employee per day, so checking
 * in twice is an error rather than a second row — the service enforces it and
 * this control reflects the three states: not in yet, in, done for the day.
 */
function CheckInControl({
  employeeId,
  onChange,
}: {
  employeeId: string
  onChange: () => void
}) {
  const [state, setState] = useState<{
    checkedIn: boolean
    checkIn: string | null
    checkOut: string | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const s = await todayStatus(employeeId)
    setState({
      checkedIn: s.checkedIn,
      checkIn: s.row?.check_in ?? null,
      checkOut: s.row?.check_out ?? null,
    })
  }, [employeeId])

  useEffect(() => {
    void load()
  }, [load])

  async function act() {
    setBusy(true)
    setError(null)
    try {
      if (state?.checkedIn) await checkOut(employeeId)
      else await checkIn(employeeId)
      await load()
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record that.')
    } finally {
      setBusy(false)
    }
  }

  if (!state) return null

  const done = Boolean(state.checkOut)

  return (
    <div className="flex items-center gap-2">
      {state.checkIn && (
        <span className="t-data hidden text-text-muted md:inline">
          {formatTime(state.checkIn)}
          {state.checkOut ? ` – ${formatTime(state.checkOut)}` : ''}
        </span>
      )}
      <Button size="sm" onClick={act} disabled={busy || done} title={error ?? undefined}>
        {done ? 'Done for today' : state.checkedIn ? 'Check out' : 'Check in'}
      </Button>
    </div>
  )
}

function AvatarMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [theme, setThemeState] = useState<Theme>(currentTheme)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

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
        <Avatar name={name} size={36} />
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
          <MenuItem
            onClick={() => {
              setThemeState(toggleTheme())
            }}
          >
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </MenuItem>
          <MenuItem
            onClick={async () => {
              setOpen(false)
              await signOut()
              navigate('/signin', { replace: true })
            }}
          >
            Log Out
          </MenuItem>
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
