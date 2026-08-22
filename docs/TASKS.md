# Tasks

Claim by putting your name in the **Owner** column and **push that claim before
you implement**. First to claim owns it. Tick the box in the same push as the
code — a push that changes code but not this file is an incomplete push.

Tick only your own rows. Append to your lane's section rather than restructuring
the file; that is what keeps this file from being the thing everyone conflicts on.

Do not start a tier until the one above is genuinely done. Six excellent screens
beat thirteen hollow ones — but only if the six include something beyond CRUD.

**Markers:** ☐ not started · ◐ partly done, with what remains stated in the row ·
☑ done and verified · ✖ dropped, with the reason in the row. Never tick ☑ for
something only verified in theory.

---

## Stage 1 — Understand and scaffold

| # | Task | Owner | Done |
|---|---|---|---|
| 1.1 | Read the PDF and the wireframes in `materials/`. Whole team | all | ☐ |
| 1.2 | Docs commit: this file, `SCHEMA.md`, `SERVICES.md`, `AUTH.md`, `DESIGN.md`, `HACKATHON_PLAN.md`, `BUILD_RULES.md`, `README.md` | Armaan | ☑ |
| 1.3 | Vite + React + TS + Tailwind + Router scaffold in `frontend/` | Armaan | ☑ |
| 1.4 | `vercel.json` with the SPA rewrite. **Without it every deep-link refresh 404s** and twenty minutes go into blaming the router | Armaan | ☑ |
| 1.5 | `.env.example` committed, so nobody is blocked asking where the keys live | Armaan | ☑ |
| 1.6 | Vercel project linked; production tracks `main`; branch previews on. **Leave Root Directory as the repo root** — see the note below | Armaan | ☑ https://dayflow-odoo-sand.vercel.app/ |
| 1.6a | **Verify the SPA rewrite on the deployed preview**: open a deep link such as `/employees/x` and hard-refresh. 200, not 404. This is the only test that exercises `vercel.json`, and it closes 1.4 | Armaan | ☑ `/employees/abc123`, `/attendance`, `/time-off` all 200 and serve the app HTML |
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
| 2.3 | Theme toggle — in the auth header and the app shell, persists, defaults to system, no flash on load | Armaan | ☑ |
| 2.4 | Anton + Instrument Serif + Inter loading, **verified in devtools** — not just written in the doc | Armaan | ☑ |
| 2.5 | UI primitives in `components/ui/index.tsx`: Button, Input, Select, Textarea, Field, Card, Avatar, presence/status/attendance chips, Table, Modal, Tabs, EmptyState, ErrorState, Spinner, PageHeader, StatCard | Armaan | ☑ |
| 2.6 | App shell: header with logo, nav (Employees / Attendance / Time Off), Check In-Out control, avatar dropdown → My Profile / Log Out | Armaan | ☐ |
| 2.7 | Landing page | Pooja | ✖ dropped — Dayflow is an internal HR tool and `/` redirects to sign in |
| 2.8 | Sign In page — email and password, plus error states | Athira | ☐ |
| 2.9 | Sign Up page — company name, logo upload, admin details. Company registration only, per `AUTH.md` §1 | Athira | ☐ |
| 2.9a | Backend Milestone 0 — linked/local migration parity, auth/salary contract decisions, and RLS test matrix locked | Praneet | ☑ linked and local history both at `20260822043456`; see `RLS_TEST_MATRIX.md` |
| 2.10 | Migrations: every table in `SCHEMA.md` | Praneet | ☑ all four MVP tables and guarded operations are migrated locally and remotely |
| 2.11 | RLS on every table. **Test each policy manually against both dev accounts** | Praneet | ◐ directory/profile/attendance/leave boundaries covered by rollback tests; linked two-user browser verification remains |
| 2.12 | Use work email as the only sign-in identifier — no generated login ID or login-ID authentication | Praneet | ☑ employee creation returns only a temporary password |
| 2.12a | Employee self-update guard — RLS has no column dimension, so prevent changes to role, company, wage, balances, and active state | Praneet | ☑ `enforce_employee_update_boundary` trigger |
| 2.12b | Company-scoped directory-safe RPC with only documented safe columns | Praneet | ☑ `list_employee_directory()` |
| 2.12c | Leave-review transaction: set reviewer/status and decrement the matching leave balance exactly once | Praneet | ☑ guarded `review_leave_request()` with rollback-tested one-time balance movement |
| 2.13 | Seed data per `SCHEMA.md` — 10–12 employees, current attendance, all presence states, and pending requests | Praneet | ☑ repeatable local-only seed with 12 employees and mixed attendance/leave data |
| 2.15 | **Two seeded dev accounts, admin and employee, logged into from a real browser** | Praneet | ◐ both local accounts passed real Auth/API login; visible browser and linked-account pass remain |
| 2.16 | `AuthProvider` + `ProtectedRoute` + `AdminRoute` | Praneet | ◐ implemented; signed-out browser redirect verified, authenticated admin/employee browser verification remains |
| 2.17 | `npx supabase gen types typescript` → `types/database.ts`, committed | Praneet | ◐ generated from the verified linked schema and build-tested; commit remains |
| 2.18 | Server-side employee creation with a one-time temporary password and forced first-login change; verify the browser never receives a service-role key | Praneet + Armaan | ◐ Edge Function deployed and local authenticated E2E passed; linked signed-in browser flow remains |
| 2.19 | Smoke test rendering every route, so unbuilt screens still fail loudly | Armaan | ☐ |
| 2.20 | `pages/Scaffold.tsx` deleted. `pages/NotBuiltYet.tsx` replaces it — delete that once every route on `main` has a real page | Armaan | ◐ |

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
| 3.1 | **Employee directory** — card grid, avatar, name, position, department, presence indicator, search. Cards open the profile read-only. *The hero screenshot* | Pooja | ◐ |
| 3.2 | **Employee profile — view mode**, tabs: Work Info · Resume · Private Info · Salary Info. Coworker profiles use directory-safe data only | Pooja | ◐ |
| 3.3 | **My Profile — edit mode**, permitted profile/private fields, avatar upload, and skills | Pooja | ◐ live profile and Storage avatar upload wired; signed-in browser verification remains |
| 3.4 | **Salary Info tab** — one monthly wage and the fixed six-component MVP calculation. Admin/HR can edit wage; employees can view only their own | Athira | ◐ |
| 3.5 | **Check In / Check Out** in the header — flips the presence dot red→green, idempotent per day | Athira | ◐ |
| 3.6 | **Attendance — employee view**, day-wise for the current month: date, day, check in, check out, derived work hours, and present/absent/leave counts | Athira | ◐ live service wired; signed-in browser verification remains |
| 3.7 | **Attendance — admin view**, all employees for one day, date stepper, search | Athira | ◐ guarded live RPC wired; signed-in Admin/HR browser verification remains |
| 3.8 | **Time Off — employee view**: balance cards, request form (type, date range, remarks, attachment for sick leave), own request list with status | Pooja | ◐ live balances/request/cancel and private attachment upload wired; signed-in browser verification remains |
| 3.8a | **Time Off — full year calendar view**, matching the reference wireframe: 12-month grid, status legend (approved/pending/rejected), static public-holiday list, year stepper. Toggle alongside the existing List view | Armaan | ☑ |
| 3.9 | **Time Off — admin view**: all requests, search, filter, approve / reject with a comment | Pooja | ◐ live company reads and approve/reject wired; comment-entry UI and signed-in browser verification remain |
| 3.10 | **Add Employee** (privileged) — form and server-side account creation. Use work email for sign-in and show the temporary password once; balances and wage live on the employee row | Athira | ◐ live Edge Function and one-time credential result wired; linked signed-in browser verification remains |
| 3.11 | **Dashboard** — employee: quick cards for profile, attendance, leave, plus today's status. Admin: headcount, present today, pending approvals, recent activity | Pooja | ◐ guarded single-RPC live summary wired and two-role API tested; visible browser verification remains |
| 3.12 | **Change password** — normal account setting and mandatory first-login flow for HR-created employees | Athira | ◐ page, Auth update, database trigger, and route enforcement implemented; live forced-flow browser verification remains |

### Tier 2 — what makes it competitive

| # | Feature | Owner | Done |
|---|---|---|---|
| 3.13 | Search and filter across the directory, attendance and time off | | ☐ |
| 3.14 | Team / reporting tree from `manager_id` | | ☐ |

### Tier 3 — only if 1 and 2 are polished

| # | Feature | Owner | Done |
|---|---|---|---|
| 3.18 | Analytics dashboard — attendance trend, leave usage, headcount by department | | ☐ |
| 3.19 | Attendance calendar view | | ☐ |
| 3.20 | Company settings — name, logo, time-off types, working schedule | Praneet | ◐ backend schema, RLS, and service complete; settings page remains |
| 3.21 | In-app notifications on leave approval | Praneet | ◐ secure notification creation/read API complete; notification UI remains |

## Stage 4 — Real backend wiring

Fixtures out, real queries in. **A repo-wide event: announce it, then go page by
page.** A previous run moved every page to live data in one commit while another
lane had in-flight work on the same pages. Expect this stage to be ugly.

| # | Task | Owner | Done |
|---|---|---|---|
| 4.1 | Announce the start; confirm nobody has in-flight work on the pages being wired | Praneet | ☑ backend wiring announced milestone by milestone |
| 4.2 | Directory + profile | Praneet | ☑ live safe/full reads, permitted updates, avatar upload, and presence |
| 4.3 | Attendance, both views, and the check in/out control | Praneet | ☑ live own-month, guarded company-day register, and header actions |
| 4.4 | Time off, both views | Praneet | ☑ live employee requests/balances/cancellation and atomic Admin/HR review |
| 4.5 | Salary Info calculation and wage updates | Praneet | ☑ live wage reads/privileged updates with client-side derived breakdown |
| 4.6 | Add employee through server-side temporary-password creation and force the first password change | Praneet | ☑ authenticated deployed Edge Function and forced-change trigger |
| 4.7 | Dashboard aggregates | Praneet | ☑ guarded `get_dashboard_summary()` RPC |
| 4.8 | Delete `fixtures/` once nothing imports it | Praneet | ☑ no fixture imports remain; directory deleted |

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
| 5.7 | RLS re-verified: log in as an employee and confirm coworker salary/private data is genuinely denied, not merely hidden | Praneet | ◐ local seeded two-role API test passed; linked visible-browser pass remains |
| 5.8 | Seed data reviewed as a judge would read it — no "Employee 1", no lorem ipsum | all | ◐ realistic named local seed is in place; final team review remains |
| 5.9 | Screenshots and GIFs. **Needs a human at a visible browser** — a backgrounded tab gets no `requestAnimationFrame`, so automated capture freezes mid-animation | all | ☐ |
| 5.10 | **The showcase README.** A judge often opens it before the live link. Budget real time; it cannot be the last fifteen minutes | Armaan | ☐ |
| 5.11 | Demo script: sign in as admin → create employee → set wage → employee checks in → requests leave → admin approves → balance and directory presence update | all | ☐ |

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
