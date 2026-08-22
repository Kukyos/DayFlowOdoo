# Design

**Owner: Armaan.** Everything visual is decided here first and consumed
everywhere else. Pages use tokens; pages do not use raw hex.

> **Status: direction set, values pending.** Section 2 is filled in Stage 2 by
> extracting from the reference below, and §8 of the plan is explicit that an AI
> session does not invent the palette. **Stage 3 does not start until §2 has real
> values and they are verified in a running browser.** A previous run shipped an
> entire build in fallback Arial while four people read a document saying
> otherwise.

---

## 1. Direction — decided by the team

**Reference: https://switch-lit.com**

Sleek and restrained. Dayflow is a utility people open every workday, not a
landing page they visit once — the design should feel quiet, precise and
composed rather than loud. Take the reference's polish as far as it goes without
letting decoration slow the screens down.

**Light and dark theme, both first-class, switchable from a button in the header.**
Not a nice-to-have and not a Stage 5 task: it is a stated requirement, so every
token is defined in both themes from the first commit and every screen is checked
in both before it counts as done.

Practical consequences the page builders should know now:

- **No component gets a hardcoded colour.** Every colour is a CSS variable
  redefined per theme. One hex in a page is a bug in dark mode.
- **The toggle sets `data-theme` on `<html>`**, and the choice persists in local
  storage. Default follows `prefers-color-scheme` on a first visit.
- **The status indicators must survive both themes.** Green / amber / plane on
  the directory cards is the app's most-looked-at piece of colour. Each needs a
  distinct value per theme and a non-colour cue — a shape, a label, or a tooltip
  — because colour alone fails for a colourblind judge and for a grayscale
  screenshot.
- **Contrast floor is 4.5:1 for text and 3:1 for UI boundaries, in both themes.**
  Dark mode fails this quietly; check it, do not assume it.

## 2. Tokens — **to be filled in Stage 2**

Extract from the reference, put real values here, then wire them into
`frontend/src/styles.css` as CSS variables in the same commit. Structure below is
the shape to fill, not a suggestion of values.

### Colour

Every row needs a light value **and** a dark value.

| token | light | dark | role |
|---|---|---|---|
| `--bg` | | | page canvas |
| `--surface` | | | cards, panels, table rows |
| `--surface-raised` | | | modals, dropdowns, the avatar menu |
| `--border` | | | dividers, input borders, table rules |
| `--text` | | | primary copy |
| `--text-muted` | | | labels, helper text, placeholders |
| `--accent` | | | primary buttons, active nav, focus rings |
| `--accent-contrast` | | | text on `--accent` |
| `--success` | | | 🟢 present |
| `--warning` | | | 🟡 absent |
| `--info` | | | ✈️ on leave |
| `--danger` | | | rejected, destructive actions, errors |

Status colours (`--success`, `--warning`, `--info`, `--danger`) are **semantic
and reserved.** They mean presence and request state. Never reach for them as
decoration — the moment a green button appears, a green dot stops meaning
"present".

### Type

| token | family | size | line height | weight | used for |
|---|---|---|---|---|---|
| `--text-display` | | | | | landing hero only |
| `--text-h1` | | | | | page titles |
| `--text-h2` | | | | | section headers, card titles |
| `--text-body` | | | | | body copy |
| `--text-label` | | | | | form labels, table headers |
| `--text-caption` | | | | | helper text, timestamps |
| `--text-mono` | | | | | login IDs, money, times |

**Money, login IDs and clock times are tabular.** Use a monospace or tabular-nums
face for them — a salary table where the digits do not line up column to column
looks broken however good the palette is. `font-variant-numeric: tabular-nums`
is usually enough and costs nothing.

**Load the fonts and verify them in a real browser** before ticking this section.
Open devtools, inspect a heading, confirm the computed family is the one written
here and not a fallback.

### Spacing, radius, elevation

4px base unit. Fill the scale actually used; do not ship twelve steps because a
generator produced twelve.

| | value |
|---|---|
| spacing scale | |
| radius — inputs, buttons | |
| radius — cards | |
| radius — avatars, pills | |
| shadow — resting card | |
| shadow — raised (modal, dropdown) | |

Shadows need separate dark-theme values. A shadow tuned for a white canvas is
invisible on a dark one; dark mode usually wants a lighter border instead.

---

## 3. Do and do not

**Do**

- Use the shared primitives in `components/ui/`. If one is missing, ask Armaan
  to add it rather than styling in place — this is how a build stays consistent
  across four people.
- Give every interactive element a visible focus ring in both themes.
- Give every table an empty state with a sentence and, where it makes sense, the
  action that fills it.
- Respect `prefers-reduced-motion`. Anything that moves has a still version.
- Keep touch targets at 44px and check every page at 375px width.

**Do not**

- No raw hex in a page. No inline `style` for colour.
- No new dependency for something CSS does — no animation library, no component
  kit, no icon pack beyond the one chosen. One library cost roughly 100 kB gzip
  and a class of layout bug in a previous run.
- No page-specific font sizes. If a size is missing from the scale, the scale is
  wrong; fix it here.
- No status colour used decoratively.
- No `.card h2 { ... }` descendant selectors in shared CSS. **Write `>` by
  default.** A third-party component injecting a generated `<span>` is the
  difference between working CSS and a Tuesday afternoon.

## 4. Screens that need design attention

Most of this app is tables and forms, which the tokens handle on their own. Three
screens carry the visual weight and are worth the time:

1. **The employee directory** — a card grid with avatars and status indicators.
   The hero screenshot in the README. It has to look dense, calm and alive.
2. **The salary structure tab** — a table of numbers that recomputes live as the
   wage changes. The transition when values update is where this screen either
   feels expensive or feels like a spreadsheet.
3. **The landing page** — the only screen judged before login.

## 5. Stage 2 checklist

- [ ] Extract the palette and type from the reference; fill §2 with real values
- [ ] Both themes defined for every token
- [ ] Tokens live in `frontend/src/styles.css`, consumed by the primitives
- [ ] Theme toggle in the header; persists; defaults to system preference
- [ ] Fonts loading and **verified in devtools**, not just written down
- [ ] Contrast checked in both themes
- [ ] Landing and sign-in look genuinely good in a real browser, both themes
