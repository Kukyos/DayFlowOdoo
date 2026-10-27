/**
 * The access rules, exercised through the real HTTP routes against a throwaway
 * database. Each actor carries its own session cookie.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'

const scratch = mkdtempSync(path.join(tmpdir(), 'dayflow-test-'))
process.env.DAYFLOW_DB = path.join(scratch, 'test.db')
process.env.DAYFLOW_UPLOADS = path.join(scratch, 'uploads')

const { app } = await import('../src/app.ts')
const { DEMO_PASSWORD, seed } = await import('../src/seed.ts')
const { closeDb } = await import('../src/db.ts')

type Json = Record<string, any>

class Actor {
  cookie = ''

  async call(method: string, url: string, body?: unknown): Promise<{ status: number; json: Json }> {
    const headers: Record<string, string> = {}
    if (this.cookie) headers.cookie = this.cookie
    let payload: FormData | string | undefined
    if (body instanceof FormData) payload = body
    else if (body !== undefined) {
      headers['content-type'] = 'application/json'
      payload = JSON.stringify(body)
    }
    const response = await app.request(`/api${url}`, { method, headers, body: payload })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) this.cookie = setCookie.split(';')[0]
    const type = response.headers.get('content-type') ?? ''
    return { status: response.status, json: type.includes('json') ? ((await response.json()) as Json) : {} }
  }

  async signIn(email: string, password = DEMO_PASSWORD) {
    const result = await this.call('POST', '/auth/signin', { email, password })
    assert.equal(result.status, 200, `sign-in failed for ${email}: ${result.json.message}`)
    return this
  }
}

const admin = new Actor()
const employee = new Actor()
const coworker = new Actor()
let employeeId = ''
let coworkerId = ''

before(async () => {
  seed()
  await admin.signIn('odootestadmin@gmail.com')
  employeeId = (await (await employee.signIn('odootestemployee@gmail.com')).call('GET', '/auth/me')).json.id
  coworkerId = (await (await coworker.signIn('athiraarun@karunya.edu.in')).call('GET', '/auth/me')).json.id
})

after(() => {
  closeDb()
  rmSync(scratch, { recursive: true, force: true })
})

describe('auth', () => {
  test('wrong password and unknown accounts get the same answer', async () => {
    const wrong = await new Actor().call('POST', '/auth/signin', { email: 'odootestadmin@gmail.com', password: 'nope12345' })
    const unknown = await new Actor().call('POST', '/auth/signin', { email: 'nobody@example.com', password: 'nope12345' })
    assert.equal(wrong.status, 401)
    assert.deepEqual(wrong.json, unknown.json)
  })

  test('signed-out requests are refused', async () => {
    assert.equal((await new Actor().call('GET', '/directory')).status, 401)
    assert.deepEqual((await new Actor().call('GET', '/auth/session')).json, { user: null })
  })

  test('company signup signs straight in as admin of a new company', async () => {
    const founder = new Actor()
    const signup = await founder.call('POST', '/auth/signup', {
      companyName: 'Kaveri Textiles', firstName: 'Lakshmi', lastName: 'Iyer',
      email: 'lakshmi@kaveri.example', password: 'Weaving2026',
    })
    assert.equal(signup.status, 201)
    const me = (await founder.call('GET', '/auth/me')).json
    assert.equal(me.role, 'admin')
    assert.equal((await founder.call('GET', '/company')).json.name, 'Kaveri Textiles')

    // Cross-company isolation, both directions.
    assert.equal((await founder.call('GET', `/employees/${employeeId}`)).status, 404)
    assert.equal((await admin.call('GET', `/employees/${me.id}`)).status, 404)
    assert.equal((await founder.call('GET', '/directory')).json.length, 1)
  })

  test('signing out ends the session', async () => {
    const temp = await new Actor().signIn('poojashree@karunya.edu.in')
    await temp.call('POST', '/auth/signout')
    assert.equal((await temp.call('GET', '/auth/me')).status, 401)
  })
})

describe('employees', () => {
  test('a coworker profile carries no wage or private data', async () => {
    const { json } = await employee.call('GET', `/employees/${coworkerId}`)
    assert.equal(json.employee.first_name, 'Athira')
    assert.equal('monthly_wage' in json.employee, false)
    assert.equal('bank_account_number' in json.employee, false)
    assert.ok(['present', 'leave', 'absent'].includes(json.presence))
  })

  test('own and privileged reads include the wage', async () => {
    assert.equal((await employee.call('GET', `/employees/${employeeId}`)).json.employee.monthly_wage, 60000)
    assert.equal((await admin.call('GET', `/employees/${coworkerId}`)).json.employee.monthly_wage, 56000)
  })

  test('employees edit safe fields only', async () => {
    const ok = await employee.call('PATCH', `/employees/${employeeId}`, { about: 'Updated bio', skills: ['SQL'] })
    assert.equal(ok.status, 200)
    assert.deepEqual(ok.json.skills, ['SQL'])
    assert.equal((await employee.call('PATCH', `/employees/${employeeId}`, { monthly_wage: 99000 })).status, 403)
    assert.equal((await employee.call('PATCH', `/employees/${employeeId}`, { role: 'admin' })).status, 403)
    assert.equal((await employee.call('PATCH', `/employees/${coworkerId}`, { about: 'x' })).status, 404)
  })

  test('admin edits wages, with the minimum enforced', async () => {
    assert.equal((await admin.call('PATCH', `/employees/${coworkerId}`, { monthly_wage: 57000 })).json.monthly_wage, 57000)
    assert.equal((await admin.call('PATCH', `/employees/${coworkerId}`, { monthly_wage: 1000 })).status, 400)
  })

  test('created employees must replace their temporary password', async () => {
    assert.equal((await employee.call('POST', '/employees', {})).status, 403)
    const created = await admin.call('POST', '/employees', {
      first_name: 'Divya', last_name: 'Nair', work_email: 'divya.nair@neamtull.example',
      job_position: 'Designer', department: 'Design', location: 'Kochi',
      date_of_joining: '2026-10-01', monthly_wage: 45000, manager_id: null, role: 'employee',
    })
    assert.equal(created.status, 201)
    assert.equal(created.json.employee.must_change_password, true)

    const divya = await new Actor().signIn('divya.nair@neamtull.example', created.json.temporaryPassword)
    assert.equal((await divya.call('POST', '/auth/password', { password: 'Fresh2026x' })).status, 200)
    assert.equal((await divya.call('GET', '/auth/me')).json.must_change_password, false)
    await new Actor().signIn('divya.nair@neamtull.example', 'Fresh2026x')

    const again = await admin.call('POST', '/employees', { ...created.json.employee, monthly_wage: 45000, role: 'employee' })
    assert.equal(again.status, 400)
  })

  test('deactivation is admin-only, never self, and locks the account out', async () => {
    assert.equal((await admin.call('POST', `/employees/${(await admin.call('GET', '/auth/me')).json.id}/deactivate`)).status, 400)
    const created = await admin.call('POST', '/employees', {
      first_name: 'Karthik', last_name: 'Rao', work_email: 'karthik.rao@neamtull.example',
      date_of_joining: '2026-10-01', monthly_wage: 40000, role: 'employee',
    })
    const karthik = await new Actor().signIn('karthik.rao@neamtull.example', created.json.temporaryPassword)
    assert.equal((await employee.call('POST', `/employees/${created.json.employee.id}/deactivate`)).status, 403)
    assert.equal((await admin.call('POST', `/employees/${created.json.employee.id}/deactivate`)).status, 200)
    assert.notEqual((await karthik.call('GET', '/auth/me')).status, 200)
    const retry = await new Actor().call('POST', '/auth/signin', {
      email: 'karthik.rao@neamtull.example', password: created.json.temporaryPassword,
    })
    assert.equal(retry.status, 401)
  })
})

describe('attendance', () => {
  test('one check-in and one check-out per day', async () => {
    assert.equal((await employee.call('POST', '/attendance/check-out')).status, 400)
    const checkIn = await employee.call('POST', '/attendance/check-in')
    assert.equal(checkIn.status, 200)
    assert.equal(checkIn.json.employee_id, employeeId)
    assert.equal((await employee.call('POST', '/attendance/check-in')).status, 400)
    assert.ok((await employee.call('POST', '/attendance/check-out')).json.check_out)
    assert.equal((await employee.call('POST', '/attendance/check-out')).status, 400)
  })

  test('the company register is Admin/HR only', async () => {
    assert.equal((await employee.call('GET', '/attendance/company')).status, 403)
    const register = (await admin.call('GET', '/attendance/company')).json as Json[]
    assert.ok(register.some((row) => row.employee_id === employeeId && row.status === 'present'))
  })

  test('employees cannot read a coworker\'s attendance', async () => {
    const range = '?from=2026-01-01&to=2026-12-31'
    assert.equal((await employee.call('GET', `/attendance${range}&employeeId=${coworkerId}`)).status, 403)
    assert.equal((await admin.call('GET', `/attendance${range}&employeeId=${coworkerId}`)).status, 200)
  })
})

describe('leave', () => {
  test('approval moves the balance exactly once and notifies', async () => {
    const before = (await employee.call('GET', '/auth/me')).json.sick_leave_balance
    const created = await employee.call('POST', '/leave', {
      leave_type: 'sick', start_date: '2027-03-01', end_date: '2027-03-02', remarks: 'Dental surgery',
    })
    assert.equal(created.status, 201)
    assert.equal(created.json.days, 2)
    assert.equal(created.json.employee_name, 'Rahul Menon')

    assert.equal((await employee.call('POST', `/leave/${created.json.id}/review`, { status: 'approved' })).status, 403)
    const reviewed = await admin.call('POST', `/leave/${created.json.id}/review`, { status: 'approved' })
    assert.equal(reviewed.json.status, 'approved')
    assert.equal((await admin.call('POST', `/leave/${created.json.id}/review`, { status: 'approved' })).status, 400)
    assert.equal((await employee.call('GET', '/auth/me')).json.sick_leave_balance, before - 2)

    const notifications = (await employee.call('GET', '/notifications')).json as Json[]
    assert.ok(notifications.some((note) => note.leave_request_id === created.json.id))
  })

  test('balances, weekends and ownership are checked', async () => {
    const weekend = await employee.call('POST', '/leave', { leave_type: 'paid', start_date: '2027-03-06', end_date: '2027-03-07' })
    assert.equal(weekend.status, 400)
    const tooLong = await employee.call('POST', '/leave', { leave_type: 'sick', start_date: '2027-04-01', end_date: '2027-05-30' })
    assert.equal(tooLong.status, 400)

    const pending = await employee.call('POST', '/leave', { leave_type: 'unpaid', start_date: '2027-06-01', end_date: '2027-06-01' })
    assert.equal((await coworker.call('DELETE', `/leave/${pending.json.id}`)).status, 404)
    assert.equal((await coworker.call('GET', `/leave/${pending.json.id}`)).status, 404)
    assert.equal((await employee.call('DELETE', `/leave/${pending.json.id}`)).status, 200)
  })

  test('employees list only their own requests; admins see the company', async () => {
    const own = (await employee.call('GET', '/leave')).json as Json[]
    assert.ok(own.every((request) => request.employee_id === employeeId))
    const company = (await admin.call('GET', '/leave?status=pending')).json as Json[]
    assert.ok(company.some((request) => request.employee_id !== employeeId))
  })
})

describe('dashboard and files', () => {
  test('company aggregates are for Admin/HR only', async () => {
    assert.equal((await employee.call('GET', '/dashboard')).json.company, null)
    const summary = (await admin.call('GET', '/dashboard')).json
    assert.ok(summary.company.headcount >= 6)
    assert.ok(Array.isArray(summary.pending_requests))
  })

  test('leave documents are private to the owner and Admin/HR', async () => {
    const form = new FormData()
    form.append('file', new File([new Uint8Array([37, 80, 68, 70])], 'note.pdf', { type: 'application/pdf' }))
    const upload = await employee.call('POST', '/uploads/leave-documents', form)
    assert.equal(upload.status, 201)

    assert.equal((await employee.call('GET', `/files/leave-documents/${upload.json.path}`)).status, 200)
    assert.equal((await admin.call('GET', `/files/leave-documents/${upload.json.path}`)).status, 200)
    assert.equal((await coworker.call('GET', `/files/leave-documents/${upload.json.path}`)).status, 403)
    assert.equal((await new Actor().call('GET', `/files/leave-documents/${upload.json.path}`)).status, 401)
    assert.equal((await employee.call('GET', '/files/leave-documents/..%2F..%2Fetc/passwd')).status, 400)
  })

  test('company logos are Admin/HR only and file types are checked', async () => {
    const image = () => {
      const form = new FormData()
      form.append('file', new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' }))
      return form
    }
    assert.equal((await employee.call('POST', '/uploads/company-logos', image())).status, 403)
    const upload = await admin.call('POST', '/uploads/company-logos', image())
    assert.equal(upload.status, 201)
    assert.equal((await new Actor().call('GET', upload.json.url.replace('/api', ''))).status, 200)

    const text = new FormData()
    text.append('file', new File(['hello'], 'a.txt', { type: 'text/plain' }))
    assert.equal((await employee.call('POST', '/uploads/avatars', text)).status, 400)
  })
})

const pdf = (name = 'file.pdf', type = 'application/pdf') => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([37, 80, 68, 70])], name, { type }))
  return form
}
const uploaded = (bucket: string, objectPath: string) =>
  existsSync(path.join(scratch, 'uploads', bucket, ...objectPath.split('/')))

async function newEmployee(first: string, last: string, extra: Json = {}) {
  const email = `${first}.${last}@neamtull.example`.toLowerCase()
  const created = await admin.call('POST', '/employees', {
    first_name: first, last_name: last, work_email: email,
    date_of_joining: '2026-10-01', monthly_wage: 40000, role: 'employee', ...extra,
  })
  assert.equal(created.status, 201, created.json.message)
  return { id: created.json.employee.id as string, email, password: created.json.temporaryPassword as string }
}

describe('leave integrity', () => {
  test('overlapping requests are refused', async () => {
    const first = await employee.call('POST', '/leave', { leave_type: 'unpaid', start_date: '2027-07-05', end_date: '2027-07-06' })
    assert.equal(first.status, 201)
    const overlap = await employee.call('POST', '/leave', { leave_type: 'unpaid', start_date: '2027-07-06', end_date: '2027-07-07' })
    assert.equal(overlap.status, 400)
    assert.match(overlap.json.message, /already have a request/)
    await employee.call('DELETE', `/leave/${first.json.id}`)
    assert.equal((await employee.call('POST', '/leave', { leave_type: 'unpaid', start_date: '2027-07-06', end_date: '2027-07-07' })).status, 201)
  })

  test('cancelling a request deletes its certificate', async () => {
    const upload = await employee.call('POST', '/uploads/leave-documents', pdf())
    const request = await employee.call('POST', '/leave', {
      leave_type: 'sick', start_date: '2027-08-02', end_date: '2027-08-02', attachment_url: upload.json.path,
    })
    assert.equal(request.status, 201)
    assert.ok(uploaded('leave-documents', upload.json.path))
    assert.equal((await employee.call('DELETE', `/leave/${request.json.id}`)).status, 200)
    assert.equal(uploaded('leave-documents', upload.json.path), false)
  })

  test('a request cannot point at someone else\'s upload', async () => {
    const theirs = await coworker.call('POST', '/uploads/leave-documents', pdf())
    const request = await employee.call('POST', '/leave', {
      leave_type: 'sick', start_date: '2027-08-09', end_date: '2027-08-09', attachment_url: theirs.json.path,
    })
    assert.equal(request.status, 400)
    assert.ok(uploaded('leave-documents', theirs.json.path))
  })
})

describe('employee administration', () => {
  test('nobody changes their own access level', async () => {
    const adminId = (await admin.call('GET', '/auth/me')).json.id
    assert.equal((await admin.call('PATCH', `/employees/${adminId}`, { role: 'employee' })).status, 403)
    assert.equal((await admin.call('PATCH', `/employees/${adminId}`, { role: 'admin', location: 'Coimbatore' })).status, 200)
  })

  test('reporting lines cannot loop, and profiles show manager and reports', async () => {
    const adminId = (await admin.call('GET', '/auth/me')).json.id
    assert.equal((await admin.call('PATCH', `/employees/${employeeId}`, { manager_id: adminId })).status, 200)
    const loop = await admin.call('PATCH', `/employees/${adminId}`, { manager_id: employeeId })
    assert.equal(loop.status, 400)
    assert.match(loop.json.message, /loop/)

    const rahul = (await coworker.call('GET', `/employees/${employeeId}`)).json
    assert.equal(rahul.manager.first_name, 'Meera')
    const meera = (await coworker.call('GET', `/employees/${adminId}`)).json
    assert.ok((meera.reports as Json[]).some((report) => report.id === employeeId))
    assert.ok((meera.reports as Json[]).every((report) => !('monthly_wage' in report)))
  })

  test('admin password reset issues a new one-time password and ends sessions', async () => {
    const nisha = await newEmployee('Nisha', 'Pillai')
    const session = await new Actor().signIn(nisha.email, nisha.password)
    await session.call('POST', '/auth/password', { password: 'Chosen2026x' })

    assert.equal((await employee.call('POST', `/employees/${nisha.id}/reset-password`)).status, 403)
    const adminId = (await admin.call('GET', '/auth/me')).json.id
    assert.equal((await admin.call('POST', `/employees/${adminId}/reset-password`)).status, 400)

    const reset = await admin.call('POST', `/employees/${nisha.id}/reset-password`)
    assert.equal(reset.status, 200)
    assert.equal((await session.call('GET', '/auth/me')).status, 401)
    const old = await new Actor().call('POST', '/auth/signin', { email: nisha.email, password: 'Chosen2026x' })
    assert.equal(old.status, 401)
    const fresh = await new Actor().signIn(nisha.email, reset.json.temporaryPassword)
    assert.equal((await fresh.call('GET', '/auth/me')).json.must_change_password, true)
  })

  test('deactivated employees can be listed and reactivated', async () => {
    const vivek = await newEmployee('Vivek', 'Sharma')
    await admin.call('POST', `/employees/${vivek.id}/deactivate`)
    assert.equal((await employee.call('GET', '/employees/inactive')).status, 403)
    const inactive = (await admin.call('GET', '/employees/inactive')).json as Json[]
    assert.ok(inactive.some((person) => person.id === vivek.id))
    assert.ok(inactive.every((person) => !('monthly_wage' in person)))

    assert.equal((await admin.call('POST', `/employees/${vivek.id}/reactivate`)).status, 200)
    assert.equal((await admin.call('POST', `/employees/${vivek.id}/reactivate`)).status, 404)
    await new Actor().signIn(vivek.email, vivek.password)
  })

  test('a new joiner\'s dashboard does not count days before they started', async () => {
    const joiner = await newEmployee('Farah', 'Khan', { date_of_joining: new Date().toISOString().slice(0, 10) })
    const session = await new Actor().signIn(joiner.email, joiner.password)
    const { attendance } = (await session.call('GET', '/dashboard')).json
    assert.equal(attendance.absent, 0)
  })
})

describe('résumés', () => {
  test('stored privately, attached to your own record, replaced cleanly', async () => {
    const first = await employee.call('POST', '/uploads/resumes', pdf('rahul-cv.pdf'))
    assert.equal(first.status, 201)
    const saved = await employee.call('PATCH', `/employees/${employeeId}`, { resume_path: first.json.path, resume_name: 'rahul-cv.pdf' })
    assert.equal(saved.status, 200)
    assert.equal(saved.json.resume_name, 'rahul-cv.pdf')
    assert.ok(saved.json.resume_uploaded_at)

    assert.equal((await admin.call('GET', `/files/resumes/${first.json.path}`)).status, 200)
    assert.equal((await coworker.call('GET', `/files/resumes/${first.json.path}`)).status, 403)
    const directory = (await coworker.call('GET', '/directory')).json as Json[]
    assert.ok(directory.every((person) => !('resume_path' in person)))

    const theirs = await coworker.call('POST', '/uploads/resumes', pdf())
    assert.equal((await employee.call('PATCH', `/employees/${employeeId}`, { resume_path: theirs.json.path })).status, 400)

    // Word files often arrive with no MIME type; the extension is enough.
    const word = await employee.call('POST', '/uploads/resumes', pdf('rahul-cv.docx', ''))
    assert.equal(word.status, 201)
    await employee.call('PATCH', `/employees/${employeeId}`, { resume_path: word.json.path, resume_name: 'rahul-cv.docx' })
    assert.equal(uploaded('resumes', first.json.path), false)

    const cleared = await employee.call('PATCH', `/employees/${employeeId}`, { resume_path: null })
    assert.equal(cleared.json.resume_name, null)
    assert.equal(uploaded('resumes', word.json.path), false)
  })
})
