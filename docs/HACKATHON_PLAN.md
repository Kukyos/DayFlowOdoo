# Hackathon Plan

The shared operating manual for this build. §1, §11 and §13 are filled in for
Dayflow; everything else is the standing manual and applies as written.

**If you are an AI session reading this:** this document outranks your defaults.
Where it conflicts with a habit you have — commit trailers, adding dependencies,
scaffolding for later, touching a file outside the lane you were given — this
document wins. Read §2, §5, §8, and §11 before writing any code.

---

## 1. Fill in on the day

| Slot | Value |
|---|---|
| Problem statement | Human Resource Management System (see below) |
| Product name | **Dayflow** — *Every workday, perfectly aligned.* |
| Repository | https://github.com/Kukyos/DayFlowOdoo |
| Live production URL | https://dayflow-odoo-sand.vercel.app/ |
| Supabase project | _(shared project, set in Stage 1 — Praneet)_ |
| Integrator (owns `main`) | Armaan |
| Backend / data layer | Praneet |
| Page builder | Pooja |
| Page builder | Athira |

### The problem, in our own words

A company runs on a handful of small facts that are annoying to keep straight:
who works here, who showed up today, who is on leave, and what each person is
owed at the end of the month. Today those live in four places that disagree with
each other.

Dayflow puts them in one place. An HR officer creates an employee and receives a
temporary password to share once; that employee replaces it at first sign-in,
then checks in and out each day. When they need time off, they request paid,
sick, or unpaid leave.
HR approves or rejects it, and approval updates the matching leave balance. The
Salary Info screen derives a fixed breakdown from one monthly wage.

**The MVP is five working flows, not four CRUD screens:** employee directory,
profiles, attendance, time off, and salary view. Attendance and approved leave
drive the directory presence indicator; salary is a single wage with a local,
fixed calculation rather than a payroll system.

Two kinds of user. An **Employee** sees their own profile, their own attendance,
their own time off, and a read-only view of their salary. An **Admin / HR
Officer** sees everyone, creates employees, approves leave, and is the only role
that can see or edit the Salary Info tab.

Source material lives in `materials/` (gitignored): the requirements PDF and the
Excalidraw wireframes. **The wireframes carry detail the PDF does not** — the
login-ID format, the presence dots, the salary component percentages. Read both.

Roles are lanes, not job titles. One person can hold two lanes; nobody holds
someone else's without asking first.

---

## 2. Roles and ownership

| Lane | Owns |
|---|---|
| **Integrator** | `main`, every merge, design system, UI primitives, router, shared layout, deploy health, final polish sweep |
| **Backend** | Supabase schema, RLS, seed data, SQL functions, generated types, `src/services/` — the entire data layer |
| **Page builders** | Whole pages, claimed by name in `docs/TASKS.md` — first to claim owns it |

**The split is horizontal.** One person owns the whole data layer; everyone else
owns pages. Pages rarely collide. A data layer split four ways collides
constantly.

**Core rule: nobody edits outside their lane without asking.** This is the only
reason several parallel AI sessions can share one repo without destroying each
other's work.

---

## 3. Stack (locked)

React 19 · TypeScript · Vite · Tailwind v4 · React Router v7 · Supabase · Vercel

> **Deviation from the locked stack, recorded rather than silent.** This manual
> said React 18 and Router v6. `npm create vite` now scaffolds React 19, and the
> current Router is v7; pinning back would have cost time and bought nothing.
> The v6 APIs we use — `createBrowserRouter`, `Link`, `useParams`,
> `useNavigate` — are unchanged in v7. Tailwind is v4, which is configured in
> CSS via `@theme` rather than in a `tailwind.config.js`; there is no config
> file to look for. The linter is oxlint, not eslint, and `npm run lint` runs it.

**No Next.js. No Express.** Supabase is the backend; `src/services/` is the
contract in front of it. An Express layer would mostly proxy Supabase, cost a
second deploy plus CORS, and invite "why does this exist?" from a judge.

**Edge Functions only when a secret cannot reach the browser** — a third-party
API key, a webhook signer. The cost is real: the function and its secret deploy
to Supabase separately from the Vercel build, so a green Vercel deploy stops
implying a working app. Know that before adding the first one.

**Adding a dependency is a decision, not a reflex.** Animation and component
libraries in particular: check the bundle delta before adopting, not after. One
library cost roughly 100 kB gzip in a previous run, plus a class of layout bug.

---

## 4. Repo shape

Backend and frontend stay in separate top-level folders. This boundary is
mandatory.

```
frontend/src/
  components/ui/        ← integrator only
  components/layout/    ← integrator only
  pages/<screen>/       ← page owner's lane
  services/             ← backend only. ALL Supabase access.
  context/AuthProvider  ← backend
  fixtures/             ← placeholder data, shaped to SCHEMA.md
  hooks/
  types/database.ts     ← generated, never hand-edited
  router.tsx            ← integrator only
backend/supabase/
  migrations/           ← backend only
  seed.sql              ← backend only
docs/
```

**Frontend never imports `supabase` directly.** Pages call services; services
call Supabase. If a service function does not exist, ask the backend owner — do
not reach around the layer.

**Fixtures live outside `services/`.** Pages need placeholder data before the
data layer exists, but `services/` is one owner's lane. `src/fixtures/` shaped
to documented `SCHEMA.md` columns invents nothing and makes integration a
one-line import swap per page.

---

## 5. Git and merge discipline

- Every builder has a **named branch** they own and push to freely.
- Feature work: `feat/<page-name>`; backend: `feat/schema`, `fix/rls`.
- Push a branch → Vercel builds a **preview URL** for it → verify there.
- **Only the integrator merges to `main`. Nobody else pushes to `main`.**
- **Vercel production tracks `main` only.** Branch previews stay on — they are
  how the backend lane tests against real auth — but the production domain shows
  merged work exclusively.
- `git pull main` before starting any new branch, and again every time one of
  your branches is merged.
- Claim work in `docs/TASKS.md` and push that claim **before** implementing.
- If a merge breaks production: **revert first, debug after.** A broken `main`
  blocks everyone; a revert costs thirty seconds.
- **Deleting or moving a file needs an announcement, not just a commit.** The
  only unresolvable merge conflict in the last run was a page deleted in one
  lane while being rewritten in another. Both changes were correct; only the
  sequencing was wrong.

**No AI attribution in commit history.** No `Co-Authored-By:` naming an
assistant, no session trailers, no "generated with" lines, in commit messages or
PR bodies. Commits are authored by the builder who ran them. Put this in every
builder's local `CLAUDE.md` / `AGENTS.md` — some tools add trailers by default.

**Never fake authorship.** No `--author` set to a teammate who did not write the
commit, no `GIT_AUTHOR_DATE` backdating. GitHub records author and committer
separately and shows contributor activity, so invented attribution is visible to
anyone who looks — a worse outcome than a lopsided but honest history.

---

## 6. Environment

Everyone runs `npm run dev` against the **same shared Supabase project** — one
schema, one source of truth, no drift across laptops. Only the backend owner
runs migrations; destructive changes get announced first.

### Staying logged in

Supabase persists the session in local storage by default. Leave that on, seed one
dev account with realistic data, and log in once — the session survives reloads and
restarts, so nobody needs a dev-only bypass and everyone is exercising the real auth
path all day.

**Never build a mock user object.** A fake user passes the route guard, but every
query still goes out without a JWT, RLS rejects it, and you lose hours to phantom
401s.

**The seeded dev account is a Stage 2 exit criterion**, not a Stage 4 task. Until it
exists, every screen behind `ProtectedRoute` is unreviewable — a previous run built
ten screens that nobody could open.

### Commit in the first commit

- `vercel.json` with the SPA rewrite. Without it a Vite SPA on Vercel 404s on
  any deep-link refresh, and you lose twenty minutes assuming the router broke.
- `.env.example`, so nobody is blocked asking where the keys are.

### Types

`npx supabase gen types typescript` after every migration, committed. With
several AI sessions writing queries, this is the one thing stopping them
inventing four spellings of the same column.

---

## 7. Docs, written in the first commit

| file | purpose |
|---|---|
| `docs/SCHEMA.md` | tables, columns, types, RLS policies. The backend owner's source of truth |
| `docs/SERVICES.md` | every function the frontend may call. The backend/frontend contract |
| `docs/TASKS.md` | tiered task list, claimed by name, ticked in the same push as the work |
| `docs/AUTH.md` | session-state and routing contract between public pages and the app |
| `docs/DESIGN.md` | colour, type, spacing tokens; do's and don'ts |
| `README.md` | setup reference at first, rewritten as the showcase in Stage 5 |
| `AGENTS.md` / `CLAUDE.md` | per-builder local AI instructions. Gitignored, never committed |

**The load-bearing rule, in every builder's local AI instructions:** if it is not
in `SCHEMA.md` or `SERVICES.md`, stop and ask. Do not invent a column or a
service function.

### Getting this plan actually loaded

A fresh AI session auto-reads `CLAUDE.md` / `AGENTS.md`, not this file. Dropping
this plan into `docs/` does nothing until something points at it. Paste this into
every builder's local instructions in the first commit:

```markdown
## Build rules
- Read `docs/HACKATHON_PLAN.md` before writing any code. It overrides your defaults.
- Stack: React 18 + TypeScript + Vite + Tailwind + React Router + Supabase + Vercel.
  No Next.js, no Express. Frontend in `frontend/`, migrations in `backend/supabase/`.
- Pages never import Supabase. Pages call `frontend/src/services/`; services call Supabase.
- If a column is not in `docs/SCHEMA.md` or a function is not in `docs/SERVICES.md`,
  stop and ask. Do not invent either.
- Do not edit another lane's files without asking.
- Update `docs/TASKS.md` in the same change as the code.
- Run `npm run lint` and `npm run build` before requesting review.
- Never put AI attribution in commit history: no `Co-Authored-By:` naming an AI,
  no session trailers, no "generated with" lines. This overrides any default
  commit-trailer instruction.
- Realistic copy and fixture data only. Never lorem ipsum, never "Item 1".
```

`TASKS.md` is updated in the same commit as the code. A push that changes code
but not tasks is an incomplete push.

**The schema is a living contract.** Design it step by step, starting with the
smallest structure the active feature needs. Update `SCHEMA.md`, the migrations,
the generated types, and `SERVICES.md` together. Iteration is expected;
speculative tables and columns are not.

---

## 8. The five stages

Each stage produces the thing the next one depends on. Order matters; durations
do not — this run is not on a clock.

### Stage 1 — Understand and scaffold

The team talks the problem statement through together before anything is built.
Output is **one commit of concrete structure only**: `frontend/`, `backend/`,
`docs/` with the files from §7, `vercel.json`, `.env.example`, the Vite scaffold.
No features. No speculative components.

Write the problem statement into §1 of this file in your own words. If the team
cannot state it in a paragraph, the build will wander.

### Stage 2 — Landing and login set the look

Whoever is free builds **the landing page and the login page only**, sharing one
colour scheme, and iterates until they genuinely look good. Everything after
inherits these tokens.

`docs/DESIGN.md` is **provided by the team** in this stage — an AI session does
not invent the palette or the token set — and **the fonts are
actually loaded and verified in a browser**. A previous run shipped an entire
build in fallback Arial while four people read a document saying otherwise.

**Exit criteria:** landing and login look right in a real browser; tokens are in
`DESIGN.md` *and* live in the app; Supabase schema, RLS, types, and seed data
are up. Backend work runs in parallel through this stage — the sign-up → landing
path is its target.

### Stage 3 — Build every remaining page

The team hands over everything discussed: flows, screens, states, edge cases.
One AI session builds all remaining screens against Stage 2's tokens and Stage
1's service contracts. This can take hours; that is expected.

**Pre-flight before page one.** Confirm all five exist, and stop and ask if any
is missing — do not start the build and fill the gap by inventing:

1. `docs/SCHEMA.md` — the tables and columns that exist right now
2. `docs/SERVICES.md` — every function the frontend may call
3. `docs/DESIGN.md` tokens, **live in the running app**, not just written down
4. The end-to-end flow: what a user does from sign-up to the last screen
5. The page list, with which tier each page belongs to

**One page per commit, not one drop.** Each commit carries the page, its
services wiring, and its loading, empty, and error states. A broken page is then
one revert instead of an unpicking job.

Services that do not exist yet are **stubbed with fixture data at the real
signature**. The frontend is never blocked, and the contract is proven before it
is implemented.

### Stage 4 — Real backend wiring

The backend lane replaces every fixture with real queries. **This is a repo-wide
event, so announce it and do it page by page** — a previous run moved every page
to live data in one commit while another lane had in-flight work on the same
pages.

Expect this stage to be ugly. It is the one worth rehearsing.

### Stage 5 — Test everything, then refine in parallel

Everything works end to end, so now everyone takes components, fixes, and
features in their own named branch, and the integrator merges to `main`. This is
where an honest multi-author commit history comes from.

**The mechanism, if Stage 3 ran as one session on one machine:** leave that
branch unpushed, have each builder pull it, take two or three pages, read them,
fix what they do not like, and commit those pages under their own git identity.
Review and revision are real work and this is real authorship of it. Nothing is
invented, and the history shows several people across honest timestamps.

Also in this stage:

- Loading, empty, and error states everywhere. Responsive pass. A design
  consistency sweep across all pages — the integrator owns it.
- Realistic seeded data. Never "Item 1", never lorem ipsum.
- Zero console errors. Fresh-browser test of the production link.
- **The showcase README** (below).

### The README is a deliverable, not a setup guide

A judge often opens it before the live link.

- Project name, one-line pitch, and the **live link** at the very top
- A hero screenshot immediately after — the strongest screen, full width
- Feature highlights, each with a screenshot or short GIF
- Tech stack, stated plainly
- A short architecture note — the `services/` boundary is the interesting part
- **Team roles table**, by name
- Setup and env vars at the *bottom* or inside a collapsed `<details>` block

**Budget real time for it.** Good screenshots need the app seeded and finished
first, so this cannot be the last fifteen minutes. And **screenshots of animated
UI need a human at a visible browser** — automated capture of a backgrounded tab
freezes mid-animation.

---

## 9. Scope triage

Do not start a tier until the one above is genuinely done.

- **Tier 1** — the demo dies without these. Auth, the main list view, the core
  create flow, the single hardest primary screen.
- **Tier 2** — what makes it competitive. Search, aggregation and charts, public
  sharing. The things that read as a product rather than CRUD.
- **Tier 3** — only if 1 and 2 are polished. Calendar views, settings, admin
  analytics.

**Seed data is Tier 1 even though it is not a screen.** Any search or list
feature is undemoable against an empty table. Seed early.

Judging is on creative, polished, feature-rich. Six excellent screens beat
thirteen hollow ones — but only if the six include something beyond CRUD.

---

## 10. Definition of done, per page

Uses services (no direct Supabase) · uses shared UI primitives (no ad-hoc
styling) · **`npm run lint` and `npm run build` both pass** · **matches
`docs/DESIGN.md`, checked in a real browser** · has loading, empty, and error
states · works at mobile width · keyboard reachable · respects
`prefers-reduced-motion` · zero console errors · preview URL works ·
`docs/TASKS.md` ticked in the same push.

`npm run build` runs `tsc -b`, so type errors fail it. In a stage that produces a
dozen pages in one pass, a failing build is the most common way a page is
silently broken. Run both before asking for review, every time.

---

## 11. Shared files — assign an owner before you start

Pages almost never collide. Every conflict in the last run landed in a file
nobody owned.

| file | why it collides | owner |
|---|---|---|
| `frontend/package.json` + lock | two people adding dependencies at once | **Armaan** — ask before adding any dependency |
| `frontend/src/styles.css` | one stylesheet, everyone adding to it | **Armaan** — token layer only; pages use Tailwind classes |
| smoke / render test file | every new or moved route touches it | **Armaan** |
| `frontend/src/router.tsx` | integrator's, keep it that way | **Armaan** |
| `docs/TASKS.md` | everyone, every commit — append-only per-lane sections | everyone; **tick only your own rows** |
| `docs/SCHEMA.md` · `docs/SERVICES.md` | the data contract everyone reads | **Praneet** — others open an issue, don't edit |
| `docs/DESIGN.md` | tokens everyone consumes | **Armaan** |
| `frontend/src/lib/salary.ts` | fixed Salary Info calculation | **Praneet** — pure function, no Supabase |

Other standing risks:

- **RLS policies** are the one place AI output looks correct and silently is
  not. Policies come out either too permissive or locking you out. Test each one
  manually against the dev account before moving on.
- **Long-lived branches.** Pull from `main` every time one of your branches
  merges, or you hit a two-hour conflict at the worst possible moment.
- **Shared AI accounts.** Several people on one account can trip rate limits.
  Test concurrent usage before the event, not during hour four.

---

## 12. Build lessons

These are paid for. Add to them in the same work cycle as the lesson — do not
leave process knowledge in chat.

- **A doc that describes the app is not the app.** Any doc describing an
  artifact needs a task that verifies the artifact matches it. Cheapest version:
  one line in the definition of done.
- **Verification blocks longer than implementation.** Building is fast;
  establishing that it *works* consumes the session. Budget for it explicitly
  and decide up front which things only a human can check.
- **Never conclude "slow" from an automated browser.** A backgrounded tab gets
  zero `requestAnimationFrame` callbacks, so JS-driven animation freezes
  mid-tween and screenshots capture the frozen state. Check
  `document.visibilityState` before trusting any timing measurement. Motion
  needs a human at a visible browser.
- **Scope every descendant selector in shared CSS.** `.hero h1 span { display:
  block }` is harmless until a third-party component injects generated spans.
  With one stylesheet and several people adding components, write `>` by default.
- **A negative assertion must be paired with a positive one.** A test proving an
  element is *absent* passes vacuously forever once that element is deleted.
  Every "must be absent" check needs a sibling "is present when it should be".
- **A harness that stubs a terminal state cannot catch transition bugs.** Pinning
  `status: 'authenticated'` from first render makes the loading → authenticated
  flip structurally invisible. Exercise transitions, not just end states.
- **An auth wall makes unbuilt-backend screens unreviewable.** Everything behind
  `ProtectedRoute` is invisible until credentials exist. A smoke check that
  renders every route catches crashes in the meantime and costs one file. It
  paid for itself repeatedly.
- **A one-accent design system cannot carry a categorical palette.** If a chart
  needs five distinguishable series and the palette has one accent, treat it as a
  *sequential* encoding: sort by magnitude, shade by rank, and direct-label every
  slice so identity never depends on colour. Validate for monotonic lightness and
  a 3:1 contrast floor.
- **Type and colour are the cheapest, highest-leverage visual work.** Wire the
  font stack and one shared header in the first commits. They do most of the
  visual work; component libraries land late and cost more than they return.
- **Vendored third-party source gets its own directory and a lint exclusion.**
  Keep it exactly as shipped so it can be re-pulled upstream. Linting files you
  do not own only creates pressure to edit them.

---

## 13. Open before kickoff

Resolved:

- ✅ Owners assigned for every shared file in §11.
- ✅ Roles assigned in §1.
- ✅ Page split drafted in `docs/TASKS.md` — page builders confirm their claims
  by pushing the claim before implementing.

Still open, and each one blocks something:

- ⬜ **Supabase project created and keys shared** (Praneet). Blocks every lane.
- ⬜ **Vercel project linked to this repo, production tracking `main`** (Armaan).
  Blocks preview-URL verification, which is how §10 gets checked.
- ⬜ **Design tokens extracted from the reference and filled into `docs/DESIGN.md`**
  (Armaan, Stage 2). §8 forbids an AI session inventing the palette. Blocks Stage 3.
- ✅ **Employee creation flow deployed and API-tested.** It creates the Auth user
  and linked employee record, returns a temporary password once, forces its
  replacement, and never exposes a service-role key. Blocks the
  "HR creates an employee" Tier 1 flow.
- ⬜ **Concurrent AI account usage tested.** Test before the event, not at hour four.
- ⬜ **Does this run keep a clock?** The one number worth measuring is how long
  Stages 1–2 take, because nothing else can start until they are done.

### Source-material decision

The PDF describes open employee registration. The MVP does not: public Sign Up
registers a company and its first admin only; normal employees are created by
Admin/HR with a one-time temporary password and sign in with email and password.
No separate login ID is generated; the work email is the sign-in identifier.
