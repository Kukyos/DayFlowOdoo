// Builds the Vercel deployment with the Build Output API: the Vite SPA as static
// files plus the Hono + SQLite API bundled into one Node function at /api.
import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'

const out = '.vercel/output'
const fn = `${out}/functions/api.func`
rmSync(out, { recursive: true, force: true })

cpSync('frontend/dist', `${out}/static`, { recursive: true })

mkdirSync(fn, { recursive: true })
await build({
  entryPoints: ['backend/src/vercel.ts'],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // Bundled CJS deps may call require(); give ESM output one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
})
// db.ts reads schema.sql from next to itself, which is now the bundle.
cpSync('backend/src/schema.sql', `${fn}/schema.sql`)
writeFileSync(`${fn}/package.json`, JSON.stringify({ type: 'module' }))
writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs24.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false }),
)

writeFileSync(
  `${out}/config.json`,
  JSON.stringify({
    version: 3,
    routes: [
      { src: '^/api(/.*)?$', dest: '/api' },
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/index.html' },
    ],
  }),
)
console.log('Vercel output written to .vercel/output')
