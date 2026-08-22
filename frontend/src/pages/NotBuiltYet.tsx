import { Link } from 'react-router-dom'
import { Button, Card } from '@/components/ui'

/**
 * Stands in for a route whose page is not on `main` yet.
 *
 * The pages exist — they are built and working on a branch — but only the auth
 * pages are merged while the backend is being wired, so that `main` stays a
 * small, stable surface for Praneet to integrate against.
 *
 * When your page lands, delete its entry from `router.tsx`. When every route
 * has a real page, delete this file.
 */
export function NotBuiltYet({ name }: { name: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center px-5">
      <Card className="w-full">
        <p className="t-label text-text-muted">Route reserved</p>
        <h1 className="t-h1 mt-3">{name}</h1>
        <p className="t-body mt-4 text-text-muted">
          This screen is not on <code>main</code> yet. Only the sign-in and
          sign-up pages are merged while the data layer is being wired, so the
          branch everyone integrates against stays small and buildable.
        </p>
        <p className="t-caption mt-4 text-text-muted">
          Claim it in <code>docs/TASKS.md</code>, then swap its element in{' '}
          <code>src/router.tsx</code> in the same commit as the page.
        </p>
        <Link to="/signin">
          <Button className="mt-6" variant="strong">
            Back to sign in
          </Button>
        </Link>
      </Card>
    </div>
  )
}
