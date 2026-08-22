# Dayflow

**Every workday, perfectly aligned.**

A human resource management system that keeps the four facts a company actually
runs on in one place, and makes them agree with each other: who works here, who
showed up today, who is on leave, and what each person is owed at the end of the
month.

> **Setup reference for now — this becomes the showcase README in Stage 5.**
> Live link, hero screenshot, feature highlights, architecture note and the team
> table go at the top once there is a finished app to photograph.

---

## What it does

- **Employee directory** — a card grid with live presence: 🟢 in the office,
  ✈️ on leave, 🟡 absent. Derived from attendance and approved leave, never a
  stale status column.
- **Profiles** — Resume, Private Info, Salary Info and Settings tabs, with the
  salary tab visible to admins and HR only.
- **Attendance** — check in and check out from the header; day-wise records with
  work hours and extra hours; admins see the whole company for any given day.
- **Time off** — allocations and balances, requests with attachments for sick
  leave, and an approval queue for HR.
- **Salary structure** — one wage figure in, six components out, recomputed live.
  Basic, HRA, standard allowance, performance bonus, LTA, and a fixed allowance
  that absorbs the remainder so the components always total the wage exactly.
- **Payslips** — attendance and approved leave decide the payable days; the
  salary structure decides the money.

Employees are created by HR, not by self-registration. The system issues a login
ID in the form `OIJODO20220001` — company prefix, initials, joining year, and a
serial for that year — along with a first password the employee must change.

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · React Router v7 · Supabase · Vercel

No Next.js, no Express. Supabase is the backend and `frontend/src/services/` is
the contract in front of it.

## Architecture

```
frontend/src/
  components/ui/      shared primitives
  components/layout/  app shell, header, nav
  pages/              one folder per screen
  services/           the only place Supabase is imported
  lib/salary.ts       the salary engine — a pure function, no I/O
  lib/theme.ts        light/dark, persisted
  router.tsx          integrator's file — every route has a slot
  context/            AuthProvider
  types/database.ts   generated from the schema, never hand-edited
backend/supabase/
  migrations/
  seed.sql
docs/
```

**Pages never import Supabase.** They call services; services call Supabase.
Security lives in row-level policies, not in route guards — a guard hides a
screen, it does not stop a request.

The salary engine is a pure function over `(wage, components, taxes)`. The admin
salary tab calls it on every keystroke, so the table recomputes with no
round-trip; payroll calls the same function when generating a payslip. One
implementation, two callers, no drift.

## Team

| | |
|---|---|
| **Armaan** | Integrator — `main`, design system, UI primitives, router, shell, deploy |
| **Praneet** | Backend — schema, RLS, seed data, services, generated types |
| **Pooja** | Pages |
| **Athira** | Pages |

<details>
<summary><strong>Setup</strong></summary>

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in the Supabase keys
npm run dev
```

**Environment**

| var | what |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key. The anon key only — the service role key never reaches the browser |

Everyone runs against the **same shared Supabase project**: one schema, one
source of truth, no drift across laptops. Only the backend owner runs migrations,
and destructive changes get announced first.

**Checks**

```bash
npm run lint
npm run build     # runs tsc -b, so type errors fail it
```

**Docs** — `docs/HACKATHON_PLAN.md` is the operating manual. `docs/SCHEMA.md` and
`docs/SERVICES.md` are the data contract; if something is not in them, it does
not exist. `docs/BUILD_RULES.md` goes into your local, gitignored `CLAUDE.md`
before you run an AI session on this repo.

</details>
