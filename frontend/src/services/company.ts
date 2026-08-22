/** STUB — fixture-backed. Signatures from docs/SERVICES.md. */
import * as fx from '@/fixtures'
import { clone, latency } from './client'

export async function getCompany() {
  await latency(120)
  return clone(fx.company)
}
