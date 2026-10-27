import { serve } from '@hono/node-server'
import { app } from './app.ts'
import { DB_PATH, one } from './db.ts'
import { seed } from './seed.ts'

const PORT = Number(process.env.PORT ?? 8787)

// A fresh checkout starts with the demo company, so `npm run dev` just works.
if (!one('select 1 from users limit 1')) {
  seed()
  console.log('Seeded the demo company (password for every demo account: DayflowDemo7!)')
}

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Dayflow API on http://localhost:${PORT}/api (database: ${DB_PATH})`)
})
