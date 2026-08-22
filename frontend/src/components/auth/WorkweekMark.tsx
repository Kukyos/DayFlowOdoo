/**
 * The auth illustration — original artwork, not the reference's.
 *
 * The reference stacks books into a spiral staircase. This is the same idea in
 * Dayflow's terms: a week of days stacked into a climb, with the pages fanning
 * out of the top one into a checked day.
 *
 * **Monochrome on purpose.** The obvious move is to colour the slabs, but lime,
 * cornflower, spring green and red all mean a presence or a request state
 * (DESIGN.md §2.4) and using them as decoration is what makes a green dot stop
 * meaning "present". Paper fills and one ink hairline is also simply more of
 * what this system is.
 *
 * Strokes are `currentColor`, so the drawing inherits `--auth-panel-ink` and
 * inverts with the theme rather than needing a second asset. Decorative — the
 * layout marks it `aria-hidden`.
 */

const STEPS = [
  { w: 250, pages: 4 },
  { w: 232, pages: 3 },
  { w: 214, pages: 4 },
  { w: 198, pages: 3 },
  { w: 182, pages: 4 },
  { w: 168, pages: 3 },
]

const STEP_H = 34
const STEP_GAP = 6
const BASE_X = 20
const BASE_Y = 392
const RISE_X = 30

const LEAVES = 34
const FAN_CX = 322
const FAN_CY = 214
const FAN_R_INNER = 14
const FAN_R_OUTER = 168

export function WorkweekMark({ className }: { className?: string }) {
  const leaves = Array.from({ length: LEAVES }, (_, i) => {
    // Sweeps from straight up round to lower-right, so the fan opens like the
    // block of a book held open at the spine.
    const t = i / (LEAVES - 1)
    const angle = (-99 + t * 168) * (Math.PI / 180)
    const belly = 1 - 0.1 * Math.sin(t * Math.PI)
    const r = FAN_R_OUTER * belly
    return {
      key: i,
      x1: FAN_CX + Math.cos(angle) * FAN_R_INNER,
      y1: FAN_CY + Math.sin(angle) * FAN_R_INNER,
      x2: FAN_CX + Math.cos(angle) * r,
      y2: FAN_CY + Math.sin(angle) * r,
    }
  })

  const first = leaves[0]
  const last = leaves[LEAVES - 1]

  return (
    <svg
      viewBox="0 0 540 470"
      className={className}
      width="100%"
      role="presentation"
      style={{ display: 'block', maxHeight: '64vh' }}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeWidth="2"
      >
        {/* The page block, drawn first so the slabs sit in front of its spine. */}
        <g>
          {leaves.map((l) => (
            <line
              key={l.key}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              strokeWidth="1.25"
              opacity="0.85"
            />
          ))}
          {/* Outer edge, bowed, so the fan reads as a solid block of paper. */}
          <path
            d={`M ${first.x2} ${first.y2} Q ${FAN_CX + 214} ${FAN_CY + 40} ${last.x2} ${last.y2}`}
            strokeWidth="2"
          />
        </g>

        {/* The climb: one slab per day, each a bound edge with its pages. */}
        {STEPS.map((s, i) => {
          const x = BASE_X + i * RISE_X
          const y = BASE_Y - i * (STEP_H + STEP_GAP)
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={s.w}
                height={STEP_H}
                rx="3"
                fill="var(--surface-raised)"
              />
              {/* Spine block at the left edge. */}
              <line x1={x + 16} y1={y + 3} x2={x + 16} y2={y + STEP_H - 3} strokeWidth="2" />
              {/* Page edges at the open side. */}
              {Array.from({ length: s.pages }, (_, p) => (
                <line
                  key={p}
                  x1={x + s.w - 10 - p * 7}
                  y1={y + 7}
                  x2={x + s.w - 10 - p * 7}
                  y2={y + STEP_H - 7}
                  strokeWidth="1.25"
                  opacity="0.7"
                />
              ))}
            </g>
          )
        })}

        {/* Ground rule. The register everything is set on. */}
        <line x1="12" y1={BASE_Y + STEP_H + 16} x2="500" y2={BASE_Y + STEP_H + 16} />

        {/* The day at the top of the climb, ticked. The point of the picture. */}
        <g transform="translate(398, 66)">
          <rect x="0" y="0" width="96" height="96" rx="5" fill="var(--surface-raised)" />
          <line x1="0" y1="27" x2="96" y2="27" strokeWidth="2" />
          <line x1="24" y1="-8" x2="24" y2="12" strokeWidth="2.5" />
          <line x1="72" y1="-8" x2="72" y2="12" strokeWidth="2.5" />
          <path d="M 27 60 l 15 15 l 28 -33" strokeWidth="3.5" />
        </g>
      </g>
    </svg>
  )
}
