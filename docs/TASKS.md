# Tasks

Claim by putting your name in the **Owner** column and **push that claim before
you implement**. First to claim owns it. Tick the box in the same push as the
code — a push that changes code but not this file is an incomplete push.

Tick only your own rows. Append to your lane's section rather than restructuring
the file; that is what keeps this file from being the thing everyone conflicts on.

Do not start a tier until the one above is genuinely done. Six excellent screens
beat thirteen hollow ones — but only if the six include something beyond CRUD.

**Markers:** ☐ not started · ◐ partly done, with what remains stated in the row ·
☑ done and verified. Never tick ☑ for something only verified in theory.

---

## Stage 1 — Understand and scaffold

| # | Task | Owner | Done |
|---|---|---|---|
| 1.1 | Read the PDF and the wireframes in `materials/`. Whole team | all | ☐ |
| 1.2 | Docs commit: this file, `SCHEMA.md`, `SERVICES.md`, `AUTH.md`, `DESIGN.md`, `HACKATHON_PLAN.md`, `BUILD_RULES.md`, `README.md` | Armaan | ☑ |
| 1.3 | Vite + React + TS + Tailwind + Router scaffold in `frontend/` | Armaan | ☑ |
| 1.4 | `vercel.json` with the SPA rewrite. **Without it every deep-link refresh 404s** and twenty minutes go into blaming the router | Armaan | ◐ |
| 1.5 | `.env.example` committed, so nobody is blocked asking where the keys live | Armaan | ☑ |
| 1.6 | Vercel project linked; production tracks `main`; branch previews on. **Leave Root Directory as the repo root** — see the note below | Armaan | ☐ |
| 1.6a | **Verify the SPA rewrite on the deployed preview**: open a deep link such as `/employees/x` and hard-refresh. 200, not 404. This is the only test that exercises `vercel.json`, and it closes 1.4 | Armaan | ☐ |
| 1.7 | Supabase project created, keys shared with the team | Praneet | ☐ |
| 1.8 | Each builder copies `docs/BUILD_RULES.md` into a local, gitignored `CLAUDE.md` | all | ☐ |

> **Linking Vercel — the one setting that breaks the deploy.** Vercel looks for
> `vercel.json` *inside* the configured Root Directory. Ours is at the repo root
> and builds `frontend/` itself, so **Root Directory must stay as the repo
> root.** Vercel will often suggest `frontend` instead, because that is where the
> only `package.json` is. Accept that suggestion and the rewrite is silently
> ignored: the build still goes green, the landing page still loads, and every
> deep-link refresh in production 404s.

## Stage 2 — Landing and login set the look

Everything after this inherits these tokens. Backend runs in parallel; its target
is the sign-up → landing path working end to end.

| # | Task | Owner | Done |
|---|---|---|---|
| 2.1 | `DESIGN.md` tokens — filled from the switch-lit reference | Armaan | ☑ |
| 2.2 | Tokens live in `src/index.css`; light **and** dark defined for every one | Armaan | ☑ |
| 2.3 | Theme toggle — mechanism done in `lib/theme.ts`, persists, defaults to system, no flash on load. **Still to move into the real header** when 2.6 builds it | Armaan | ◐ |
| 2.4 | Anton + Instrument Serif + Inter loading, **verified in devtools** — not just written in the doc | Armaan | ☑ |
| 2.5 | UI primitives: Button, Input, Select, Card, Badge, Avatar, Table, Modal, Tabs, Toast, EmptyState, Spinner | Armaan | ☐ |
| 2.6 | App shell: header with logo, nav (Employees / Attendance / Time Off), Check In-Out control, avatar dropdown → My Profile / Log Out | Armaan | ☐ |
| 2.7 | Landing page. The only screen judged before login | Pooja | ☐ |
| 2.8 | Sign In page — login ID **or** email, plus error states | Athira | ☐ |
| 2.9 | Sign Up page — company name, logo upload, admin details. Company registration only, per `AUTH.md` §1 | Athira | ☐ |
| 2.10 | Migrations: every table in `SCHEMA.md` | Praneet | ☐ |
| 2.11 | RLS on every table. **Test each policy manually against both dev accounts** | Praneet | ☐ |
| 2.12 | `generate_login_id()` + `login_id_counters`, with the atomic serial | Praneet | ☐ |
| 2.12a | `email_for_login_id()` — the one unauthenticated lookup, exact-match, email only. **Sign-in by login ID fails 100% without it** | Praneet | ☐ |
| 2.12b | `guard_employee_update()` trigger — RLS has no column dimension, so this is what makes self-edit "limited columns" true | Praneet | ☐ |
| 2.12c | `lib/workdays.ts`, with its unit test. Three callers, one implementation | Praneet | ☐ |
| 2.13 | `employee_presence` (**`security_invoker = false`**, own scoping, presence enum only) and `time_off_balances` views | Praneet | ☐ |
| 2.14 | Seed data per `SCHEMA.md` — 12–15 employees, a month of attendance, allocations, pending requests | Praneet | ☐ |
| 2.15 | **Two seeded dev accounts, admin and employee, logged into from a real browser** | Praneet | ☐ |
| 2.16 | `AuthProvider` + `ProtectedRoute` + `AdminRoute` + forced password change | Praneet | ☐ |
| 2.17 | `npx supabase gen types typescript` → `types/database.ts`, committed | Praneet | ☐ |
| 2.18 | Decide employee-creation mechanism: Edge Function or claim. `AUTH.md` §5 | Praneet + Armaan | ☐ |
| 2.19 | Smoke test rendering every route, so unbuilt screens still fail loudly | Armaan | ☐ |
| 2.20 | Delete `pages/Scaffold.tsx` once every route has a real page | Armaan | ☐ |

**Exit criteria.** Landing and sign-in look right in a real browser in both
themes; tokens are in `DESIGN.md` *and* live in the app; schema, RLS, types and
seed data are up; **both dev accounts log in**. Stage 3 does not start early.

## Stage 3 — Every remaining page

One page per commit — page, its services wiring, and its loading, empty and error
states together. A broken page is then one revert instead of an unpicking job.

**Pre-flight, before page one.** Stop and ask if any of these is missing; do not
start and fill the gap by inventing: (1) `SCHEMA.md` current, (2) `SERVICES.md`
current, (3) `DESIGN.md` tokens live in the running app, (4) the end-to-end flow
from sign-up to the last screen, (5) this page list with tiers agreed.

### Tier 1 — the demo dies without these

| # | Page | Owner | Done |
|---|---|---|---|
| 3.1 | **Employee directory** — card grid, avatar, name, position, department, presence indicator, search. Cards open the profile read-only. *The hero screenshot* | Pooja | ☐ |
| 3.2 | **Employee profile — view mode**, tabs: Resume · Private Info · Salary Info (privileged only) · Settings | Pooja | ☐ |
| 3.3 | **My Profile — edit mode**, employee-editable fields only, avatar upload, skills and certifications | Pooja | ☐ |
| 3.4 | **Salary Info tab — the reactive component engine.** Wage in, six components recomputing live, PF and professional tax configurable, gross asserted equal to wage. *The single hardest screen and the reason this is not four CRUD pages* | Athira | ☐ |
| 3.5 | **Check In / Check Out** in the header — flips the presence dot red→green, idempotent per day | Athira | ☐ |
| 3.6 | **Attendance — employee view**, day-wise for the current month: date, day, check in, check out, work hours, extra hours; month stepper; present/absent/leave counts | Athira | ☐ |
| 3.7 | **Attendance — admin view**, all employees for one day, date stepper, search | Athira | ☐ |
| 3.8 | **Time Off — employee view**: balance cards, request form (type, date range, remarks, attachment for sick leave), own request list with status | Pooja | ☐ |
| 3.9 | **Time Off — admin view**: all requests, search, filter, approve / reject with a comment | Pooja | ☐ |
| 3.10 | **Add Employee** (privileged) — form, generated login ID and temp password shown once, seeds salary components and allocations | Athira | ☐ |
| 3.11 | **Dashboard** — employee: quick cards for profile, attendance, leave, plus today's status. Admin: headcount, present today, pending approvals, recent activity | Pooja | ☐ |
| 3.12 | **Change password** — forced on first login | Athira | ☐ |

### Tier 2 — what makes it competitive

| # | Feature | Owner | Done |
|---|---|---|---|
| 3.13 | **Payslip generation.** Payable days from attendance minus unpaid leave and missing days, run through the salary engine, snapshotted. *The integration that ties the whole app together* | | ☐ |
| 3.14 | **Printable salary slip** — print stylesheet, no PDF dependency | | ☐ |
| 3.15 | Employee payslip list, read-only | | ☐ |
| 3.16 | Search and filter across the directory, attendance and time off | | ☐ |
| 3.17 | Team / reporting tree from `manager_id` | | ☐ |

### Tier 3 — only if 1 and 2 are polished

| # | Feature | Owner | Done |
|---|---|---|---|
| 3.18 | Analytics dashboard — attendance trend, leave usage, headcount by department | | ☐ |
| 3.19 | Attendance calendar view | | ☐ |
| 3.20 | Company settings — name, logo, time-off types, working schedule | | ☐ |
| 3.21 | In-app notifications on leave approval | | ☐ |

## Stage 4 — Real backend wiring

Fixtures out, real queries in. **A repo-wide event: announce it, then go page by
page.** A previous run moved every page to live data in one commit while another
lane had in-flight work on the same pages. Expect this stage to be ugly.

| # | Task | Owner | Done |
|---|---|---|---|
| 4.1 | Announce the start; confirm nobody has in-flight work on the pages being wired | Praneet | ☐ |
| 4.2 | Directory + profile | Praneet | ☐ |
| 4.3 | Attendance, both views, and the check in/out control | Praneet | ☐ |
| 4.4 | Time off, both views | Praneet | ☐ |
| 4.5 | Salary structure | Praneet | ☐ |
| 4.6 | Add employee, whichever mechanism §2.18 chose | Praneet | ☐ |
| 4.7 | Dashboard aggregates | Praneet | ☐ |
| 4.8 | Delete `fixtures/` once nothing imports it | Praneet | ☐ |

## Stage 5 — Test, then refine in parallel

Everyone takes pages in their own named branch; Armaan merges. This is where the
honest multi-author history comes from.

| # | Task | Owner | Done |
|---|---|---|---|
| 5.1 | Loading, empty and error states audited on **every** page | all | ☐ |
| 5.2 | Responsive pass at 375px | all | ☐ |
| 5.3 | Design consistency sweep across all pages | Armaan | ☐ |
| 5.4 | **Both themes checked on every screen** | Armaan | ☐ |
| 5.4a | Status chips legible in grayscale and with colour-vision deficiency simulated. **Present vs on leave is the failing pair** — spring green 0.61 and cornflower 0.65 relative luminance. Check the glyphs carry it | Armaan | ☐ |
| 5.5 | Keyboard reachability and focus rings | all | ☐ |
| 5.6 | Zero console errors, fresh browser, production link | all | ☐ |
| 5.7 | RLS re-verified: log in as an employee, confirm the salary tab is genuinely denied and not merely hidden | Praneet | ☐ |
| 5.8 | Seed data reviewed as a judge would read it — no "Employee 1", no lorem ipsum | all | ☐ |
| 5.9 | Screenshots and GIFs. **Needs a human at a visible browser** — a backgrounded tab gets no `requestAnimationFrame`, so automated capture freezes mid-animation | all | ☐ |
| 5.10 | **The showcase README.** A judge often opens it before the live link. Budget real time; it cannot be the last fifteen minutes | Armaan | ☐ |
| 5.11 | Demo script: sign in as admin → create employee → set wage → employee checks in → requests leave → admin approves → payslip | all | ☐ |

---

## Definition of done, per page

Uses services, never Supabase directly · uses shared primitives, no ad-hoc
styling · `npm run lint` and `npm run build` both pass · matches `DESIGN.md`,
checked in a real browser, **both themes** · has loading, empty and error states ·
works at mobile width · keyboard reachable · respects `prefers-reduced-motion` ·
zero console errors · preview URL works · this file ticked in the same push.

`npm run build` runs `tsc -b`, so a type error fails it. In a stage that produces
a dozen pages in one pass, a failing build is the most common way a page is
silently broken. Run both before asking for review, every time.
