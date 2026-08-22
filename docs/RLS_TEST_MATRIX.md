# RLS test matrix

Run this matrix after each backend milestone against both a reset local database
and the linked project before marking that milestone complete. UI visibility is
not evidence of authorization: every denial is checked through a direct SQL or
Data API request using the actor's JWT.

## Actors

| actor | company | state | purpose |
|---|---|---|---|
| unauthenticated | none | signed out | Prove public access is denied except company signup |
| admin A | A | active | Full privileged access inside company A |
| HR A | A | active | Same privileged boundary as Admin for the MVP |
| employee A1 | A | active | Own-row and own-domain operations |
| employee A2 | A | active | Same-company coworker privacy checks |
| employee B1 | B | active | Cross-company isolation checks |
| employee A3 | A | inactive | Deactivated-account checks with an otherwise valid JWT |

Use fixed UUIDs for these actors in local seed data. Keep linked-project
credentials private and record only pass/fail results, never tokens or passwords.

## Required results

| resource or operation | employee A1 | Admin/HR A | employee B1 / inactive / unauthenticated |
|---|---|---|---|
| Read company A | Allow | Allow | Deny |
| Update company A | Deny | Allow safe company fields | Deny |
| Read A1 full employee row, including own wage | Allow | Allow | Deny |
| Read A2 full employee row | Deny; use directory view | Allow | Deny |
| Read company A directory-safe rows | Allow | Allow | Deny |
| Change A1 safe profile/private fields | Allow | Allow | Deny |
| Change role, company, wage, balances, active state, identity, or password flag | Deny | Allow only within company and through the intended operation | Deny |
| Read/write A1 attendance | Allow under current-day rules | Allow for company A | Deny |
| Read/write A2 attendance | Deny | Allow for company A | Deny |
| Read/create/cancel A1 pending leave | Allow | Allow for company A | Deny |
| Review leave or change balances | Deny | Allow once, transactionally | Deny |
| Re-review an approved/rejected request | Deny with no second balance change | Deny with no second balance change | Deny |
| Create employee account | Deny | Allow through server-side function only | Deny |
| Clear `must_change_password` | Only after successful own Auth password update | Not by arbitrary row patch | Deny |
| Read/write Storage object | Own/company path only, per bucket rules | Company path only | Deny |
| Read company analytics/settings | As explicitly documented for that feature | Company A only | Deny |
| Read/mark notification | Own notification only | Own notification only | Deny |

## SQL execution pattern

Run every case inside a transaction and roll it back. For local SQL tests,
impersonate the Data API role and JWT subject instead of connecting as
`postgres` for the assertion itself:

```sql
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<actor-uuid>', 'role', 'authenticated')::text,
  true
);

-- Execute exactly one allow/deny assertion here.

rollback;
```

For an unauthenticated assertion, use `set local role anon` without a user
subject. Test `SELECT`, `INSERT`, `UPDATE`, and `DELETE` separately because a
working read policy does not imply a working write policy. An UPDATE assertion
must confirm both the affected-row count and the stored result; zero updated
rows can be an RLS denial rather than success.

## Milestone evidence

For each implemented resource, record:

- local reset and migration versions;
- allow cases that returned the expected rows;
- deny cases that returned no rows or the expected authorization error;
- before/after values for transactional balance and password-flag tests;
- one real-browser Admin/HR flow and one real-browser employee flow;
- linked-project migration version and the date verified.

Milestone 0 parity was verified on 2026-08-22: repository and linked project both
contain only migration `20260822043456_create_auth_company_foundation.sql`.

Milestone 1 was verified on 2026-08-22: the password-flag migration applied
locally and remotely; the private trigger was not executable by `anon` or
`authenticated`; a disposable local account passed sign-in, own-row RLS read,
Auth password update, flag clearing, and sign-out; cleanup left no temporary
Auth user or company. A signed-out browser request to `/dashboard` redirected to
`/signin` with no console errors. Signed-in browser verification against the
shared project remains pending until a private dev-account credential is used.
Remote security advisors also confirmed that the tracked grant-hardening
migration removed browser execution of `public.rls_auto_enable()`. The only
remaining warning is the Dashboard-level leaked-password-protection setting.

Milestones 2–4 were verified on 2026-08-22: a rollback-only local test created
two disposable companies and authenticated actors, then confirmed the guarded
directory RPC stayed company-scoped, a self profile update succeeded, a self
wage update was rejected, and check-in/check-out changed only the caller's
current-day row and directory presence. The linked project has all four
migrations through `20260822065110_replace_directory_view_with_guarded_rpc.sql`.
The security-definer directory view was replaced with the narrow guarded RPC;
the remote advisor now has only intentional guarded-RPC warnings plus the
Dashboard-level leaked-password-protection setting.

Milestones 5–7 were verified on 2026-08-22 with rollback-only local SQL tests.
They confirmed own attendance reads, the guarded Admin/HR company-day register,
server-derived leave identity and weekday count, own pending cancellation,
cross-company denial, privileged company request reads, exact paid-balance
deduction, reviewer stamping, leave-driven directory/register presence, and
re-review denial without a second deduction. The linked project is at migration
`20260822071136_consolidate_attendance_and_leave_read_policies`; its final
attendance and leave SELECT policies were inspected directly. Signed-in
employee and Admin/HR browser verification still requires private shared-project
credentials. Security-advisor warnings are limited to the intentional guarded
browser RPCs and the Dashboard-level leaked-password-protection setting.

Milestones 8–9 were verified on 2026-08-22 with disposable local Auth users
and real API calls. Ten assertions confirmed one-time temporary-password
return, forced-change flagging, company-scoped employee creation, own avatar and
leave-document uploads, denial of another employee's document path, privileged
signed-document access, denial of employee account creation, denial of
self-deactivation, and application-data denial after deactivation. Cleanup
deleted both Auth users and uploaded objects. The linked project is at migration
`20260822072713_add_storage_buckets_and_policies`; `create-employee` is deployed
with JWT verification and rejects an unauthenticated linked request with 401.
Linked schema lint passed. Advisor warnings remain the intentional guarded RPCs,
including `deactivate_employee()`, plus the Dashboard leaked-password setting.
Signed-in linked browser verification still requires private dev credentials.

Milestones 10–13 were verified on 2026-08-22 against the local seeded Admin and
employee accounts. Ten authenticated assertions confirmed the Admin dashboard
counts 12 active employees, three pending requests, and five checked-in people;
the employee payload omitted company aggregates and pending-company requests;
own balances remained visible; coworker wage reads and own wage writes were
denied; safe own-profile updates and privileged wage reads succeeded. Local
schema lint plus security and performance advisors reported no issues after the
employee-policy consolidation. The linked project is at migration
`20260822080006_consolidate_employee_policies`; linked schema lint and
performance advisors pass. Linked security warnings remain the intentional,
internally guarded browser RPCs (now including `get_dashboard_summary()`) and
the Dashboard leaked-password-protection setting. The deterministic seed is
local-only and was not pushed to the linked database.
