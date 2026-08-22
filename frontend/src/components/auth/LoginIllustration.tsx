import loginRoom from '@/assets/loginrem.png'

/**
 * The auth illustration: a cut-out office scene, centred on the plain
 * `--auth-panel` field with a slow vertical float for movement — matching the
 * reference's floating book-staircase on its own flat colour field.
 *
 * `float-y` is a plain CSS animation, so the global `prefers-reduced-motion`
 * rule in index.css (which zeroes every animation-duration) silences it for
 * anyone who has that set, with no extra handling needed here.
 */
export function LoginIllustration({ className }: { className?: string }) {
  return (
    <img
      src={loginRoom}
      alt=""
      aria-hidden="true"
      className={`login-illustration select-none ${className ?? ''}`}
    />
  )
}
