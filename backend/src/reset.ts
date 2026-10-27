/** `npm run db:reset`: delete the local database and uploads, then reseed. */
import { rmSync } from 'node:fs'
import { DB_PATH, UPLOADS_DIR, closeDb, db } from './db.ts'
import { DEMO_PASSWORD, seed } from './seed.ts'

closeDb()
for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) rmSync(file, { force: true })
rmSync(UPLOADS_DIR, { recursive: true, force: true })

db()
seed()
console.log(`Reset ${DB_PATH} with the demo company. Password for every demo account: ${DEMO_PASSWORD}`)
