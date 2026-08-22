# Design

**Owner: Armaan.** Everything visual is decided here first and consumed
everywhere else. Pages use tokens; pages do not use raw hex.

Reference: **https://switch-lit.com** — the full extraction is in
`materials/DESIGN-switch-lit-extract.md`. Read this file; open that one only when
you need a detail this one does not settle.

---

## 1. The direction

*Inked editorial grid on cream paper.*

Every structural element is drawn in a **single hairline of ink** — card edges,
dividers, input borders, button outlines, table rules. No fills, no shadows, no
gradients. The border does the work that elevation does elsewhere, so the page
reads like a typeset sheet rather than a stack of floating panels.

Typography carries the personality: a heavy condensed display face, a light
flared serif for section headings, and a wide-tracked grotesque for everything
else. Accent colour appears as **highlighter punctuation** — flat fills carrying
black text, never a page background and never coloured text. In this app those
fills are load-bearing: they are the presence indicators (§2.4).

This suits Dayflow better than a conventional SaaS look. An HR tool is a
document people read every day — a directory, a register, an employee record. An inked
editorial grid is what a well-set register looks like.

---

## 2. Four conflicts with the reference, and how they resolve

The reference is a sparse editorial site. Dayflow is a dense utility with a
stated dark-mode requirement, and its palette has to carry meaning here that it
only carries decoration there. These are the four places it does not transfer
directly. **Decided; do not re-litigate them mid-build.**

### 2.1 Dark mode — the reference forbids it, we ship it anyway

The reference says outright: *"never invert to dark mode — the cream is the
system's defining surface."* Dark mode is a stated requirement for this build, so
it wins. What carries over is **the ink metaphor, not the specific cream**:

- Light theme is black ink on cream paper. Dark theme is **cream ink on warm
  near-black** — same single-hairline system, inverted stock.
- Never pure `#000` as the dark canvas. The palette is warm; a pure black
  background next to cream ink looks like a rendering bug.
- **The accent fills do not change between themes.** Lime, cornflower and spring
  green are all light, high-chroma colours that carry black text — they work on
  either canvas untouched. This is the single best property of this palette for
  a themed app: chips and status pills are theme-independent.
- Ink at full strength is right for a card border and too loud for thirty table
  rules. Hence `--border` and `--border-soft`, and the soft one diverges most
  between themes.

### 2.2 Density — the reference is a magazine, this is a register

80px section gaps, 20px card padding and 15px body with +0.04em tracking are
right for an editorial page and wrong for an attendance table. Wide tracking in
particular makes a numeric table hard to scan.

**Data-dense surfaces get their own rules**, and only these: tables, the salary
component list, and the attendance grid.

| | editorial surfaces | dense surfaces |
|---|---|---|
| tracking | +0.04em | **0** |
| row height | — | 40px |
| body size | 15–18px | 14px |
| numerals | default | **`tabular-nums`, always** |

Everything else — landing, sign-in, cards, forms, dashboards — keeps the
reference's spacing as written.

### 2.3 The palette has no red, and its placeholder colour fails contrast

Two gaps, both fixed below rather than worked around:

- **No danger colour.** Rejected requests and destructive actions need one. Added
  as `--danger` / `--danger-ink`, tuned warm so it belongs with the cream.
- **Mist Green `#dee5dd` as placeholder text is roughly 1.3:1 on cream.** It is
  effectively invisible and fails WCAG badly. It is used here for *decorative
  icon strokes only*. Placeholders use `--text-muted`.

### 2.4 There is no accent-filled button, and the accents are status colours

`--accent` and `--warning` are the same lime; `--accent-alt` and `--info` are the
same cornflower. That is not an oversight in the palette — the palette has three
accents and this app has three presence states, so they are the same three
colours doing one job.

Which means **any decorative use of lime or cornflower at chip scale collides
with a status.** The directory is exactly where they would meet: primary buttons
and absent chips in one viewport, in the hero screenshot.

The reference already settles this. Its guide says *"primary action: no distinct
CTA colour"*, and it calls the outlined button *"the button you reach for
first"*; accent fills are scoped to *"featured or category"* surfaces. So:

- **The primary button is the outlined one.** Ink border, no fill,
  `--neutral-fill` on hover. There is no accent-filled button variant in this
  system — emphasis comes from position and border weight, not colour.
- **Accent fills appear only on card-sized surfaces**, where scale and context
  make them read as a featured panel rather than as a status. Never on a chip,
  a badge, a button, or a nav item.
- Active nav is a 1px underline, per the reference. Not a fill.

This is also the plan's own lesson: a one-accent design system cannot carry a
categorical palette, so do not try to make it carry two meanings at once.

---

## 3. Tokens

Wire these into `frontend/src/styles.css` as CSS variables under `:root` and
`[data-theme="dark"]`, and expose them to Tailwind through
`theme.extend.colors`. **Every colour below is defined in both themes.** One hex
in a page is a bug in dark mode.

### Colour

| token | light | dark | role |
|---|---|---|---|
| `--bg` | `#f9f9f7` | `#131311` | page canvas — cream paper / warm near-black |
| `--surface` | `#f9f9f7` | `#131311` | cards. **Same as canvas by design** — a card is its border, not its fill |
| `--surface-raised` | `#ffffff` | `#1d1d1a` | modals, dropdowns, the avatar menu. The only surfaces that lift |
| `--border` | `#000000` | `#f2f2ee` | the ink. Card edges, inputs, buttons, dividers. 1px |
| `--border-soft` | `#d2ddd2` | `#3a3a35` | table rules and repeated hairlines, where full ink is too loud |
| `--text` | `#000000` | `#f2f2ee` | body copy, headings |
| `--text-muted` | `#55554f` | `#a3a39b` | labels, helper text, placeholders, timestamps |
| `--accent` | `#edfe5e` | `#edfe5e` | highlighter lime. **Featured card fills only** — see §2.4 |
| `--accent-alt` | `#bed4fb` | `#bed4fb` | cornflower. Featured card fills only |
| `--accent-ink` | `#000000` | `#000000` | text on any accent fill. **Always black, both themes** |
| `--neutral-fill` | `#edf0e9` | `#26261f` | button hover, disabled fill, zebra rows |
| `--success` | `#31e992` | `#31e992` | 🟢 present |
| `--warning` | `#edfe5e` | `#edfe5e` | 🟡 absent |
| `--info` | `#bed4fb` | `#bed4fb` | ✈️ on leave |
| `--danger` | `#ff5c4d` | `#ff5c4d` | rejected / destructive **fills**, black text on top |
| `--danger-ink` | `#c62f1f` | `#ff8577` | error **text** and error borders. The fill colour fails as text |

**Status colours are semantic and reserved.** `--success`, `--warning`, `--info`
and `--danger` mean presence and request state, nowhere else. The moment a green
button appears, a green dot stops meaning "present". They overlap with the
accents by design — read §2.4 before using either.

### Type

Three families. The reference's faces (ABCArizonaSans, ABCArizonaFlare,
ABCCameraHeavy) are commercial Dinamo fonts we do not have a licence for, and so
are every substitute it suggests. **Free equivalents, chosen to preserve the
role, not the exact drawing:**

| token | family | fallback intent | role |
|---|---|---|---|
| `--font-display` | **Anton** 400 | heavy condensed | hero only. Closest free stand-in for Camera Heavy |
| `--font-heading` | **Instrument Serif** 400 | light flared serif | section and card headings. Editorial calm |
| `--font-body` | **Inter** 400/500/700 | wide grotesque | everything else — UI, body, labels, tables, numerals |

```css
--font-display: 'Anton', 'Arial Narrow', sans-serif;
--font-heading: 'Instrument Serif', Georgia, serif;
--font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
```

| token | family | size | line height | tracking | weight |
|---|---|---|---|---|---|
| `--text-display` | display | 64px | 0.82 | -0.001em | 400 |
| `--text-h1` | heading | 48px | 1.04 | +0.002em | 400 |
| `--text-h2` | heading | 28px | 1.07 | 0 | 400 |
| `--text-h3` | body | 20px | 1.15 | +0.025em | 700 |
| `--text-body` | body | 15px | 1.5 | +0.04em | 400 |
| `--text-body-lg` | body | 18px | 1.5 | +0.05em | 400 |
| `--text-label` | body | 11px | 1.2 | +0.067em | 700, uppercase |
| `--text-caption` | body | 13px | 1.4 | +0.04em | 400 |
| `--text-data` | body | 14px | 1.4 | **0** | 400, `tabular-nums` |

Two deviations from the reference, both deliberate. Its display line-height of
0.74 clips descenders and diacritics in Anton — 0.82 keeps the dense stack
without the clipping. Its body line-height of 1.18–1.27 is too tight for
multi-line form help text; 1.5 is used for anything that wraps.

**`--text-data` is not optional.** Money, login IDs, clock times, work hours and
day counts all use it. A salary table whose digits do not line up column to
column looks broken however good the palette is, and `tabular-nums` is the entire
fix — no extra font, no extra bytes.

**Load the fonts and verify them in devtools** before ticking this section.
Inspect a heading, confirm the computed family is Anton and not a fallback. A
previous run shipped a whole build in fallback Arial while four people read a
document saying otherwise.

### Spacing, radius, elevation

4px base. Use `4 8 12 16 20 24 32 40 60 80`. The reference's 5/6/13/19/29/170
steps are artefacts of one page's layout — do not port them.

| | value |
|---|---|
| radius — buttons, inputs, chips | 6px |
| radius — cards | 12px |
| radius — pills, avatars | 9999px |
| card padding | 20px |
| grid gutter / element gap | 20px |
| section gap | 80px editorial · 32px inside the app shell |
| page max width | 1200px editorial · 1440px for table pages |
| **elevation** | **none.** Cards are their border |
| button shadow | `rgba(0,0,0,0.2) 0 2px 6px` — the single shadow in the system |
| dark-theme shadow | none. Use `--border` instead; a shadow tuned for cream is invisible on near-black |

---

## 4. Components

Built once by Armaan in `components/ui/`, consumed everywhere. If a primitive is
missing, ask — do not style in place.

- **Button** — transparent fill, 1px `--border`, 6px radius, 12/20px padding,
  `--text-caption` at weight 500. Hover fills `--neutral-fill`. **This is the
  only button.** Emphasis comes from position and a 2px border, never from an
  accent fill — see §2.4. Destructive actions use `--danger-ink` for the border
  and label, still with no fill.
- **Card** — `--surface` fill, 1px `--border`, 12px radius, 20px padding. No
  shadow, ever. The featured variant swaps the fill for `--accent` or
  `--accent-alt` and keeps the border — **the only place an accent fill appears
  in the app.**
- **Input** — `--surface` fill, 1px `--border`, 6px radius. Focus **thickens the
  border to 2px** rather than adding a coloured ring — that is the system's
  language. Ensure the 2px does not shift layout; reserve it with an inset
  box-shadow or a transparent 2px border at rest.
- **Chip / Badge** — `--text-label`, all caps, 6px radius, 1px `--border`.
  **A filled chip means a status and nothing else** (§2.4). Every status chip
  carries a glyph or a label as well as its colour (§5).
- **Table** — `--border-soft` rules, 40px rows, `--text-data` for every numeric
  column, right-aligned numbers, left-aligned text.
- **Nav** — full-width bar on `--bg` with a 1px `--border` bottom rule. Active
  item carries a 1px underline. No pill, no fill, no accent.

---

## 5. Status indicators — the app's most-looked-at colour

The directory card indicator is the feature a judge notices first, and it is the
one place colour carries meaning on its own. **Colour is never the only cue:**

| state | fill | glyph | label |
|---|---|---|---|
| present | `--success` | ● | "In office" |
| absent | `--warning` | ● | "Absent" |
| on leave | `--info` | ✈ | "On leave" |

Each renders as a small filled chip with a glyph and black text, or as a dot with
an accessible label and a tooltip when space is tight. **A colourblind judge and
a grayscale screenshot must both still read the directory.**

The pair that fails is **present and on leave**: spring green and cornflower sit
at relative luminance 0.61 and 0.65, which is indistinguishable in grayscale.
Lime is far lighter at 0.89 and separates cleanly from both. The ● / ✈ glyph
split is what carries the distinction, which is why the glyph is not decoration
and not optional.

---

## 6. Do and do not

**Do**

- Draw structure with a 1px `--border`. Let the ink define shapes.
- Keep accent fills on card-sized surfaces only; keep status fills on chips.
- Give every interactive element a visible focus state in both themes.
- Give every table an empty state with a sentence and, where it fits, the action
  that fills it.
- Respect `prefers-reduced-motion`. Anything that moves has a still version.
- Keep touch targets at 44px; check every page at 375px.

**Do not**

- No box-shadows for elevation. Buttons get the one shadow; cards never do.
- No gradients. The system is flat by design.
- No accent colour as text, on either canvas. Fills behind black text only.
- No accent-filled button, chip, badge or nav item. §2.4 — the accents are the
  status colours, and a lime button makes a lime "absent" chip meaningless.
- No second grotesque next to Inter. No display type set in Inter Bold — display
  belongs to Anton, headings to Instrument Serif.
- No raw hex in a page. No inline `style` for colour.
- No page-specific font sizes. If a size is missing from the scale, the scale is
  wrong — fix it here.
- No new dependency for something CSS does. No animation library, no component
  kit. One library cost roughly 100 kB gzip and a class of layout bug in a
  previous run.
- No `.card h2 { ... }` descendant selectors in shared CSS. **Write `>` by
  default.**

---

## 7. Screens that carry the visual weight

Most of this app is tables and forms, which the tokens handle on their own. Three
screens are worth real time:

1. **The employee directory** — a bordered card grid with avatars and status
   chips. The hero screenshot. Dense, calm, alive.
2. **The salary structure tab** — a table of numbers that recomputes live as the
   wage changes. Whether this feels expensive or feels like a spreadsheet is
   decided by the transition when the values move.
3. **The landing page** — the only screen judged before login, and the one place
   the display face gets to shout.

## 8. Stage 2 checklist

- [ ] Tokens in `styles.css` under `:root` and `[data-theme="dark"]`, wired to Tailwind
- [ ] Anton, Instrument Serif and Inter loading; **verified in devtools**, not assumed
- [ ] Theme toggle in the header; persists to local storage; defaults to `prefers-color-scheme`
- [ ] Contrast checked in **both** themes: 4.5:1 text, 3:1 UI boundaries
- [ ] Status chips legible in grayscale and with colour vision deficiency simulated
- [ ] Landing and sign-in look genuinely good in a real browser, both themes
