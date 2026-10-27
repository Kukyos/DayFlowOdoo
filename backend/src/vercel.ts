import { getRequestListener } from '@hono/node-server'
import { app } from './app.ts'
import { one } from './db.ts'
import { seed } from './seed.ts'

// The hosted demo: each function instance gets a fresh SQLite file in /tmp and
// seeds the demo company on cold start, the same way `npm run dev` does locally.
if (!one('select 1 from users limit 1')) seed()

export default getRequestListener(app.fetch)
