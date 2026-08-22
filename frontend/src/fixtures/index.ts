/**
 * Placeholder data, shaped to docs/SCHEMA.md.
 *
 * Lives outside `services/` on purpose: `services/` is Praneet's lane, and
 * pages need something to render before the data layer exists. Every shape here
 * matches a documented column, so wiring the real queries is an import swap
 * rather than a rewrite.
 *
 * Delete this directory once nothing imports it (TASKS 4.x).
 */
import { addDays, isWeekend, today, toISO, workingDaysBetween } from '@/lib/dates'
import { buildLoginId } from '@/types/models'
import type {
  AttendanceRow,
  Company,
  Employee,
  LeaveRequest,
  Presence,
} from '@/types/models'

export const company: Company = {
  id: 'c-odoo-india',
  name: 'Odoo India',
  login_prefix: 'OI',
  logo_url: null,
  created_at: '2019-04-01T00:00:00Z',
}

type Seed = {
  id: string
  first: string
  last: string
  role: Employee['role']
  position: string
  department: string
  location: string
  joined: string
  wage: number
  manager: string | null
  presence: Presence
  about: string
  skills: string[]
}

/**
 * Presence is spread across all three states so the directory's indicator is
 * actually visible in a screenshot — with everyone present it looks like a
 * feature nobody built. docs/SCHEMA.md calls this out in the seed spec.
 */
const seeds: Seed[] = [
  {
    id: 'e-01', first: 'Ananya', last: 'Iyer', role: 'admin',
    position: 'Head of People', department: 'HR', location: 'Bengaluru',
    joined: '2019-06-03', wage: 145000, manager: null, presence: 'present',
    about: 'Built the people function here from four employees to just over a hundred. Spends most of her week on hiring loops and the ones that follow them.',
    skills: ['Hiring', 'Compensation', 'Employment law', 'Onboarding'],
  },
  {
    id: 'e-02', first: 'Rahul', last: 'Menon', role: 'hr',
    position: 'HR Officer', department: 'HR', location: 'Bengaluru',
    joined: '2021-02-15', wage: 78000, manager: 'e-01', presence: 'present',
    about: 'Runs onboarding and the leave calendar. The person who notices a timesheet is wrong before payroll does.',
    skills: ['Onboarding', 'Payroll operations', 'HRIS', 'Employee relations'],
  },
  {
    id: 'e-03', first: 'Priya', last: 'Sharma', role: 'employee',
    position: 'Engineering Manager', department: 'Engineering', location: 'Bengaluru',
    joined: '2020-01-13', wage: 168000, manager: 'e-01', presence: 'leave',
    about: 'Leads the platform team. Was a backend engineer for eight years and still reviews more pull requests than anyone tells her to.',
    skills: ['Distributed systems', 'PostgreSQL', 'Go', 'Team leadership'],
  },
  {
    id: 'e-04', first: 'Vikram', last: 'Desai', role: 'employee',
    position: 'Senior Frontend Engineer', department: 'Engineering', location: 'Pune',
    joined: '2021-08-02', wage: 132000, manager: 'e-03', presence: 'present',
    about: 'Cares about how fast a page feels more than how it scores. Maintains the internal component library.',
    skills: ['React', 'TypeScript', 'Accessibility', 'Performance'],
  },
  {
    id: 'e-05', first: 'Sneha', last: 'Kulkarni', role: 'employee',
    position: 'Backend Engineer', department: 'Engineering', location: 'Pune',
    joined: '2022-03-07', wage: 98000, manager: 'e-03', presence: 'present',
    about: 'Works on the billing service. Has opinions about idempotency keys and they are usually right.',
    skills: ['Python', 'PostgreSQL', 'Kafka', 'API design'],
  },
  {
    id: 'e-06', first: 'Arjun', last: 'Nair', role: 'employee',
    position: 'Backend Engineer', department: 'Engineering', location: 'Kochi',
    joined: '2023-07-17', wage: 74000, manager: 'e-03', presence: 'absent',
    about: 'Joined from a payments startup. Currently rewriting the notification pipeline so it stops sending duplicates.',
    skills: ['Go', 'Redis', 'Observability'],
  },
  {
    id: 'e-07', first: 'Meera', last: 'Krishnan', role: 'employee',
    position: 'Product Designer', department: 'Design', location: 'Bengaluru',
    joined: '2022-09-05', wage: 105000, manager: 'e-01', presence: 'present',
    about: 'Designs the reporting surfaces. Draws more than she prototypes and thinks that is the right order.',
    skills: ['Interaction design', 'Design systems', 'Figma', 'User research'],
  },
  {
    id: 'e-08', first: 'Karthik', last: 'Reddy', role: 'employee',
    position: 'Design Lead', department: 'Design', location: 'Hyderabad',
    joined: '2020-11-23', wage: 138000, manager: 'e-01', presence: 'leave',
    about: 'Owns the visual language across the product. Came from print and it shows in the typography.',
    skills: ['Brand', 'Typography', 'Design systems', 'Illustration'],
  },
  {
    id: 'e-09', first: 'Divya', last: 'Pillai', role: 'employee',
    position: 'Account Executive', department: 'Sales', location: 'Chennai',
    joined: '2023-01-09', wage: 86000, manager: 'e-01', presence: 'present',
    about: 'Handles mid-market accounts in the south. Closed the two largest deals of last quarter.',
    skills: ['Enterprise sales', 'Negotiation', 'CRM'],
  },
  {
    id: 'e-10', first: 'Imran', last: 'Qureshi', role: 'employee',
    position: 'Sales Development Rep', department: 'Sales', location: 'Mumbai',
    joined: '2024-06-10', wage: 52000, manager: 'e-09', presence: 'absent',
    about: 'First sales hire out of the Mumbai office. Books more meetings than the rest of the team combined.',
    skills: ['Prospecting', 'Outbound', 'CRM'],
  },
  {
    id: 'e-11', first: 'Lakshmi', last: 'Venkatesan', role: 'employee',
    position: 'Support Engineer', department: 'Support', location: 'Chennai',
    joined: '2022-11-28', wage: 61000, manager: 'e-02', presence: 'present',
    about: 'Handles the escalations nobody else can reproduce. Writes the runbook afterwards so it never happens twice.',
    skills: ['Troubleshooting', 'SQL', 'Technical writing'],
  },
  {
    id: 'e-12', first: 'Rohan', last: 'Bhatt', role: 'employee',
    position: 'Support Engineer', department: 'Support', location: 'Ahmedabad',
    joined: '2025-02-17', wage: 46000, manager: 'e-02', presence: 'present',
    about: 'Newest on the support rota. Cut first-response time on the weekend queue by half.',
    skills: ['Customer support', 'Zendesk', 'SQL'],
  },
]

// Deterministic serial per joining year, so login IDs look like a real sequence
// rather than every person being 0001.
const serialByYear: Record<number, number> = {}

export const employees: Employee[] = seeds.map((s) => {
  const year = Number(s.joined.slice(0, 4))
  serialByYear[year] = (serialByYear[year] ?? 0) + 1
  const n = Number(s.id.slice(2))
  return {
    id: s.id,
    company_id: company.id,
    login_id: buildLoginId('OI', s.first, s.last, year, serialByYear[year]),
    role: s.role,
    first_name: s.first,
    last_name: s.last,
    work_email: `${s.first.toLowerCase()}.${s.last.toLowerCase()}@odoo.in`,
    mobile: `+91 98${`${40000000 + n * 137911}`.slice(0, 8)}`,
    job_position: s.position,
    department: s.department,
    location: s.location,
    manager_id: s.manager,
    date_of_joining: s.joined,
    avatar_url: null,
    about: s.about,
    skills: s.skills,
    date_of_birth: `19${85 + (n % 12)}-0${(n % 9) + 1}-${`${(n * 3) % 27 + 1}`.padStart(2, '0')}`,
    address: `${n * 7 + 3}, ${s.location} — 5600${`${n}`.padStart(2, '0')}`,
    bank_account_number: `5011${`${n}`.padStart(2, '0')}0047${`${n * 13}`.padStart(4, '0')}`,
    ifsc_code: `HDFC000${`${1000 + n}`}`,
    pan_no: `ABCDE${`${1000 + n * 7}`}F`,
    uan_no: `10${`${123456789 + n * 311}`}`,
    monthly_wage: s.wage,
    paid_leave_balance: 24 - (n % 6),
    sick_leave_balance: 7 - (n % 3),
    is_active: true,
    must_change_password: false,
    created_at: `${s.joined}T04:00:00Z`,
  }
})

/**
 * The *intended* presence for each seed. It drives what attendance and leave
 * get generated below — it is not what the app reads. docs/SCHEMA.md is
 * explicit that presence is derived, so the exported `presenceById` at the
 * bottom of this file is computed from the generated rows instead. Hardcoding
 * both is how the directory ends up claiming someone is in while their
 * attendance says otherwise.
 */
const seededPresence: Record<string, Presence> = Object.fromEntries(
  seeds.map((s) => [s.id, s.presence]),
)

/** Signed in as the admin by default; the shell can switch for demo purposes. */
export const CURRENT_ADMIN_ID = 'e-01'
export const CURRENT_EMPLOYEE_ID = 'e-04'

export const byId = (id: string): Employee | undefined =>
  employees.find((e) => e.id === id)

/* ── Attendance ───────────────────────────────────────────────────────────── */

const at = (day: string, hhmm: string) => `${day}T${hhmm}:00+05:30`

/**
 * Weekdays of the last 60 days. Deterministic per employee so the table looks
 * the same on every reload — a directory that reshuffles between screenshots
 * is not a demo, it is a distraction.
 */
function attendanceFor(employeeId: string, index: number): AttendanceRow[] {
  const rows: AttendanceRow[] = []
  const now = today()

  for (let back = 59; back >= 0; back -= 1) {
    const day = addDays(now, -back)
    const isToday = day === now

    // Today is handled before the weekend skip on purpose. If the demo happens
    // to run on a Saturday, skipping it would leave every card yellow and the
    // directory's best feature invisible.
    if (!isToday && isWeekend(day)) continue

    const spin = (index * 31 + back * 17) % 20

    if (isToday) {
      const p = seededPresence[employeeId]
      if (p === 'present') {
        rows.push(row(employeeId, day, at(day, '09:32'), null, 'present'))
      }
      // 'leave' gets no attendance row either: it is the approved request
      // covering today that makes the indicator a plane. 'absent' means no row
      // and no leave. Both follow the presence rules in docs/SCHEMA.md.
      continue
    }

    if (spin === 3) continue // no row: unexplained absence
    if (spin === 7) {
      rows.push(row(employeeId, day, at(day, '09:45'), at(day, '13:30'), 'half_day'))
      continue
    }
    if (spin === 11) {
      rows.push(row(employeeId, day, null, null, 'leave'))
      continue
    }

    const inHour = 9 + (spin % 2)
    const inMin = (spin * 7) % 60
    const outHour = 18 + ((spin + 1) % 3)
    const outMin = (spin * 11) % 60
    rows.push(
      row(
        employeeId,
        day,
        at(day, `${pad(inHour)}:${pad(inMin)}`),
        at(day, `${pad(outHour)}:${pad(outMin)}`),
        'present',
      ),
    )
  }
  return rows
}

const pad = (n: number) => `${n}`.padStart(2, '0')

function row(
  employee_id: string,
  work_date: string,
  check_in: string | null,
  check_out: string | null,
  status: AttendanceRow['status'],
): AttendanceRow {
  return {
    id: `a-${employee_id}-${work_date}`,
    employee_id,
    work_date,
    check_in,
    check_out,
    status,
    created_at: `${work_date}T04:00:00Z`,
  }
}

export const attendance: AttendanceRow[] = employees.flatMap((e, i) =>
  attendanceFor(e.id, i),
)

/* ── Leave ────────────────────────────────────────────────────────────────── */

const leaveSeed: Array<{
  employee: string
  type: LeaveRequest['leave_type']
  from: number
  to: number
  status: LeaveRequest['status']
  remarks: string
  comment?: string
}> = [
  { employee: 'e-03', type: 'paid', from: -2, to: 3, status: 'approved', remarks: 'Family wedding in Coimbatore.', comment: 'Approved — handover noted.' },
  { employee: 'e-08', type: 'paid', from: -1, to: 1, status: 'approved', remarks: 'Short break, back Thursday.', comment: 'Approved.' },
  { employee: 'e-05', type: 'sick', from: 2, to: 4, status: 'pending', remarks: 'Minor surgery, certificate attached.' },
  { employee: 'e-06', type: 'paid', from: 9, to: 16, status: 'pending', remarks: 'Annual leave — travelling to Leh.' },
  { employee: 'e-10', type: 'unpaid', from: 5, to: 6, status: 'pending', remarks: 'Personal matter, no balance left this cycle.' },
  { employee: 'e-11', type: 'sick', from: 19, to: 20, status: 'pending', remarks: 'Down with a fever, will send the certificate.' },
  { employee: 'e-04', type: 'paid', from: -28, to: -25, status: 'approved', remarks: 'Diwali with family.', comment: 'Approved. Enjoy.' },
  { employee: 'e-04', type: 'sick', from: -12, to: -12, status: 'rejected', remarks: 'Migraine.', comment: 'No certificate attached — please resubmit with one.' },
  { employee: 'e-09', type: 'paid', from: -40, to: -37, status: 'approved', remarks: 'Trip booked before joining.', comment: 'Approved.' },
  { employee: 'e-12', type: 'paid', from: -9, to: -8, status: 'approved', remarks: 'Moving flats.', comment: 'Approved.' },
]

export const leaveRequests: LeaveRequest[] = leaveSeed.map((l, i) => {
  const e = byId(l.employee)!
  const start = addDays(today(), l.from)
  const end = addDays(today(), l.to)
  return {
    id: `l-${`${i + 1}`.padStart(3, '0')}`,
    employee_id: e.id,
    employee_name: `${e.first_name} ${e.last_name}`,
    avatar_url: e.avatar_url,
    leave_type: l.type,
    start_date: start,
    end_date: end,
    days: workingDaysBetween(start, end),
    remarks: l.remarks,
    attachment_url: l.type === 'sick' ? 'certificate.pdf' : null,
    status: l.status,
    reviewed_by: l.status === 'pending' ? null : 'e-01',
    review_comment: l.comment ?? null,
    created_at: `${addDays(start, -6)}T06:30:00Z`,
  }
})

/**
 * Presence, derived — exactly the rule the `employee_directory` view will use:
 *
 *   1. checked in today            → present
 *   2. approved leave covering today → leave
 *   3. otherwise                    → absent
 *
 * Mutable because check-in updates it live; the real view recomputes per query.
 */
export const presenceById: Record<string, Presence> = Object.fromEntries(
  employees.map((e) => {
    const now = today()
    const checkedIn = attendance.some(
      (a) => a.employee_id === e.id && a.work_date === now && a.check_in,
    )
    if (checkedIn) return [e.id, 'present' as Presence]
    const onLeave = leaveRequests.some(
      (r) =>
        r.employee_id === e.id &&
        r.status === 'approved' &&
        r.start_date <= now &&
        r.end_date >= now,
    )
    return [e.id, (onLeave ? 'leave' : 'absent') as Presence]
  }),
)

// A request with no working days could never have been submitted — the service
// rejects it. If a seeded range drifts onto a weekend, this says so loudly
// rather than rendering "0.00d" in the approval queue.
if (import.meta.env.DEV) {
  const empty = leaveRequests.filter((r) => r.days === 0)
  if (empty.length > 0) {
    console.error(
      '[fixtures] leave requests with zero working days:',
      empty.map((r) => `${r.employee_name} ${r.start_date}..${r.end_date}`),
    )
  }
}

/**
 * Is this employee on approved leave on this date?
 *
 * Attendance has no row for a day someone is off, so without this a person on
 * approved leave shows as "absent" in the register while the directory shows
 * them as on leave — the same fact, two answers. The register asks this
 * question for every gap.
 */
export const onApprovedLeave = (employeeId: string, date: string): boolean =>
  leaveRequests.some(
    (r) =>
      r.employee_id === employeeId &&
      r.status === 'approved' &&
      r.start_date <= date &&
      r.end_date >= date,
  )

export const todayISO = toISO(new Date())
