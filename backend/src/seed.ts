/**
 * Dayflow demo data: one company, six people, this month's attendance, and a
 * mix of leave decisions. Dates are relative to today so the demo stays current.
 *
 * Every seeded account uses the password `DayflowDemo7!`. These are throwaway
 * local credentials — never reuse them for a real account.
 */
import { hashPassword } from './auth.ts'
import { newId, run, tx } from './db.ts'
import { addDays, istInstant, todayIST, weekdaysBetween, workingDaysBetween } from './dates.ts'

export const DEMO_PASSWORD = 'DayflowDemo7!'

const COMPANY_ID = '10000000-0000-0000-0000-000000000001'
const id = (n: number) => `20000000-0000-0000-0000-00000000000${n}`

const PRANEET = id(1)
const ARMAAN = id(2)
const POOJA = id(3)
const ATHIRA = id(4)
const DEMO_ADMIN = id(5)
const DEMO_EMPLOYEE = id(6)

type SeedEmployee = {
  id: string
  role: 'admin' | 'hr' | 'employee'
  first_name: string
  last_name: string
  work_email: string
  mobile: string
  job_position: string
  department: string
  location: string
  manager_id: string | null
  date_of_joining: string
  about: string
  skills: string[]
  date_of_birth: string
  address: string
  monthly_wage: number
  paid_leave_balance: number
  sick_leave_balance: number
}

const EMPLOYEES: SeedEmployee[] = [
  {
    id: PRANEET, role: 'admin', first_name: 'Praneet', last_name: 'Tigga',
    work_email: 'praneettigga@gmail.com', mobile: '+91 91908 76543',
    job_position: 'admin', department: 'management', location: 'Coimbatore', manager_id: null,
    date_of_joining: '2024-08-06',
    about: 'Oversees company operations, employee administration, and delivery planning.',
    skills: ['Administration', 'Operations', 'Team Leadership'],
    date_of_birth: '2003-04-18', address: 'Saravanampatti, Coimbatore, Tamil Nadu',
    monthly_wage: 95000, paid_leave_balance: 24, sick_leave_balance: 7,
  },
  {
    id: ARMAAN, role: 'employee', first_name: 'Armaan', last_name: 'Mohamed',
    work_email: 'amohamed@karunya.edu.in', mobile: '+91 94876 23105',
    job_position: 'Integrator', department: 'Engineering', location: 'Coimbatore', manager_id: PRANEET,
    date_of_joining: '2024-11-01',
    about: 'Connects product services and keeps integrations reliable across the platform.',
    skills: ['API Integration', 'SQLite', 'TypeScript'],
    date_of_birth: '2003-09-12', address: 'Kuniyamuthur, Coimbatore, Tamil Nadu',
    monthly_wage: 62000, paid_leave_balance: 22, sick_leave_balance: 7,
  },
  {
    id: POOJA, role: 'employee', first_name: 'Poojashree', last_name: 'Ravichandar',
    work_email: 'poojashree@karunya.edu.in', mobile: '+91 93614 58270',
    job_position: 'Frontend Developer', department: 'Engineering', location: 'Coimbatore', manager_id: PRANEET,
    date_of_joining: '2025-01-06',
    about: 'Builds accessible, responsive interfaces with an eye for clear user journeys.',
    skills: ['React', 'UI Engineering', 'Accessibility'],
    date_of_birth: '2004-02-24', address: 'Peelamedu, Coimbatore, Tamil Nadu',
    monthly_wage: 58000, paid_leave_balance: 24, sick_leave_balance: 6,
  },
  {
    id: ATHIRA, role: 'employee', first_name: 'Athira', last_name: 'Arun',
    work_email: 'athiraarun@karunya.edu.in', mobile: '+91 90872 41635',
    job_position: 'Quality Assurance Engineer', department: 'Engineering', location: 'Coimbatore', manager_id: PRANEET,
    date_of_joining: '2025-02-03',
    about: 'Improves release confidence through thoughtful test coverage and defect analysis.',
    skills: ['Quality Assurance', 'API Testing', 'Playwright'],
    date_of_birth: '2003-11-08', address: 'Vadavalli, Coimbatore, Tamil Nadu',
    monthly_wage: 56000, paid_leave_balance: 23, sick_leave_balance: 7,
  },
  {
    id: DEMO_ADMIN, role: 'admin', first_name: 'Meera', last_name: 'Krishnan',
    work_email: 'odootestadmin@gmail.com', mobile: '+91 98430 11872',
    job_position: 'HR Manager', department: 'Human Resources', location: 'Coimbatore', manager_id: PRANEET,
    date_of_joining: '2024-09-16',
    about: 'Runs hiring, onboarding, and leave policy, and keeps payroll inputs accurate.',
    skills: ['Recruitment', 'Employee Relations', 'Payroll Inputs'],
    date_of_birth: '1996-07-03', address: 'RS Puram, Coimbatore, Tamil Nadu',
    monthly_wage: 82000, paid_leave_balance: 24, sick_leave_balance: 7,
  },
  {
    id: DEMO_EMPLOYEE, role: 'employee', first_name: 'Rahul', last_name: 'Menon',
    work_email: 'odootestemployee@gmail.com', mobile: '+91 97890 45216',
    job_position: 'Backend Developer', department: 'Engineering', location: 'Coimbatore', manager_id: PRANEET,
    date_of_joining: '2025-03-10',
    about: 'Designs data models and APIs, and keeps the attendance and leave services fast.',
    skills: ['Node.js', 'SQL', 'API Design'],
    date_of_birth: '2002-12-19', address: 'Gandhipuram, Coimbatore, Tamil Nadu',
    monthly_wage: 60000, paid_leave_balance: 24, sick_leave_balance: 7,
  },
]

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString()

export function seed(): void {
  const today = todayIST()
  const passwordHash = hashPassword(DEMO_PASSWORD)

  const leave = [
    {
      id: '30000000-0000-0000-0000-000000000001', employee: ARMAAN, type: 'paid',
      start: addDays(today, 2), end: addDays(today, 3), status: 'pending',
      remarks: 'Travelling for a family function.', comment: null, created: hoursAgo(5),
    },
    {
      id: '30000000-0000-0000-0000-000000000002', employee: POOJA, type: 'paid',
      start: addDays(today, -10), end: addDays(today, -8), status: 'approved',
      remarks: 'Short break after completing the frontend milestone.',
      comment: 'Approved. Enjoy the break.', created: hoursAgo(14 * 24),
    },
    {
      id: '30000000-0000-0000-0000-000000000003', employee: ATHIRA, type: 'sick',
      start: addDays(today, -5), end: addDays(today, -5), status: 'rejected',
      remarks: 'Resting after a fever.',
      comment: 'Please attach a medical certificate and resubmit.', created: hoursAgo(7 * 24),
    },
    {
      id: '30000000-0000-0000-0000-000000000004', employee: DEMO_EMPLOYEE, type: 'paid',
      start: addDays(today, 7), end: addDays(today, 8), status: 'pending',
      remarks: 'Attending my cousin\'s wedding in Kochi.', comment: null, created: hoursAgo(2),
    },
  ].map((request) => ({ ...request, days: Math.max(workingDaysBetween(request.start, request.end), 1) }))

  tx(() => {
    run('insert into companies (id, name) values (?, ?)', COMPANY_ID, 'Neam Tull')

    for (const person of EMPLOYEES) {
      run('insert into users (id, email, password_hash) values (?, ?, ?)', person.id, person.work_email, passwordHash)
    }
    // Managers first, so every manager_id already exists when it is referenced.
    for (const person of EMPLOYEES) {
      run(
        `insert into employees (
           id, company_id, role, first_name, last_name, work_email, mobile, job_position,
           department, location, manager_id, date_of_joining, about, skills, date_of_birth,
           address, monthly_wage, paid_leave_balance, sick_leave_balance
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        person.id, COMPANY_ID, person.role, person.first_name, person.last_name, person.work_email,
        person.mobile, person.job_position, person.department, person.location, person.manager_id,
        person.date_of_joining, person.about, JSON.stringify(person.skills), person.date_of_birth,
        person.address, person.monthly_wage, person.paid_leave_balance, person.sick_leave_balance,
      )
    }

    // Weekday history from the 1st to yesterday; every seventh day is a half day.
    // Days covered by approved leave are left empty so they read as leave.
    const approved = leave.filter((request) => request.status === 'approved')
    for (const person of EMPLOYEES) {
      for (const day of weekdaysBetween(`${today.slice(0, 8)}01`, addDays(today, -1))) {
        const onLeave = approved.some(
          (request) => request.employee === person.id && request.start <= day && request.end >= day,
        )
        if (onLeave) continue
        const halfDay = Number(day.slice(8)) % 7 === 0
        run(
          `insert into attendance (id, employee_id, work_date, check_in, check_out, status)
           values (?, ?, ?, ?, ?, ?)`,
          newId(), person.id, day, istInstant(day, '09:30'),
          istInstant(day, halfDay ? '13:30' : '18:00'), halfDay ? 'half_day' : 'present',
        )
      }
    }

    // Four people are in today; Athira and Rahul are not, so both other presence
    // states show up and the demo employee can try checking in.
    for (const [employeeId, time] of [
      [PRANEET, '09:05'], [ARMAAN, '09:18'], [POOJA, '09:42'], [DEMO_ADMIN, '09:10'],
    ] as const) {
      run(
        `insert into attendance (id, employee_id, work_date, check_in, status)
         values (?, ?, ?, ?, 'present')`,
        newId(), employeeId, today, istInstant(today, time),
      )
    }

    for (const request of leave) {
      const reviewed = request.status !== 'pending'
      run(
        `insert into leave_requests (
           id, employee_id, leave_type, start_date, end_date, days, remarks, status,
           reviewed_by, review_comment, created_at
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        request.id, request.employee, request.type, request.start, request.end, request.days,
        request.remarks, request.status, reviewed ? PRANEET : null, request.comment, request.created,
      )
      if (request.status === 'approved') {
        run(
          `update employees set ${request.type}_leave_balance = ${request.type}_leave_balance - ? where id = ?`,
          request.days, request.employee,
        )
      }
      if (reviewed) {
        run(
          `insert into notifications (id, employee_id, type, title, message, leave_request_id, created_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
          newId(), request.employee, `leave_${request.status}`,
          request.status === 'approved' ? 'Time off approved' : 'Time off declined',
          `Your ${request.type} leave request from ${request.start} to ${request.end} was ${request.status}.`,
          request.id, request.created,
        )
      }
    }
  })
}
