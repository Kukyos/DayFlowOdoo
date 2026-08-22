import type { Company } from '@/types/models'
import { ServiceError, supabaseClient, unwrap } from './client'

export async function getCompany(): Promise<Company> {
  const { data, error } = await supabaseClient().from('companies').select('*').single()
  return unwrap({ data, error }, 'Could not load your company.')
}

export async function updateCompany(patch: Pick<Partial<Company>, 'name' | 'logo_url'>): Promise<Company> {
  const company = await getCompany()
  const { data, error } = await supabaseClient()
    .from('companies')
    .update(patch)
    .eq('id', company.id)
    .select('*')
    .single()
  return unwrap({ data, error }, 'Could not update your company.')
}

const LOGO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export async function uploadCompanyLogo(file: File): Promise<string> {
  const extension = LOGO_TYPES[file.type]
  if (!extension) throw new ServiceError('Use a JPG, PNG, WebP, or SVG logo.')
  if (file.size > 5 * 1024 * 1024) throw new ServiceError('The logo must be 5 MB or smaller.')
  const client = supabaseClient()
  const company = await getCompany()
  const path = `${company.id}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('company-logos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new ServiceError('Could not upload that company logo.', error)
  return client.storage.from('company-logos').getPublicUrl(path).data.publicUrl
}
