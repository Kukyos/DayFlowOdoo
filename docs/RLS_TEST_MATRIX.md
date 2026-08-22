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
