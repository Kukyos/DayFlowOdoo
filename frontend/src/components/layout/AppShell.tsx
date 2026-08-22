import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Avatar, Button, cx } from '@/components/ui'
import { useSession } from '@/context/session'
import { formatTime } from '@/lib/dates'
import { currentTheme, toggleTheme, type Theme } from '@/lib/theme'
import { checkIn, checkOut, todayStatus } from '@/services/attendance'
import { signOut } from '@/services/auth'
import { getCompany, updateCompany, uploadCompanyLogo } from '@/services/company'
import type { Company } from '@/types/models'
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
            <AvatarMenu
              name={fullName(employee)}
              role={isPrivileged ? 'Admin / HR' : 'Employee'}
              avatarUrl={employee.avatar_url}
              isPrivileged={isPrivileged}
              onCompanyLogo={async (file) => {
                const logoUrl = await uploadCompanyLogo(file)
                const updated = await updateCompany({ logo_url: logoUrl })
                setCompany(updated)
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
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
  } | null>(null)
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
    void load()
  }, [load])

  async function act() {
    setBusy(true)
    setError(null)
    try {
      if (state?.checkedIn) await checkOut()
      else await checkIn()
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
  const ref = useRef<HTMLDivElement>(null)
  const [theme, setThemeState] = useState<Theme>(currentTheme)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

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
