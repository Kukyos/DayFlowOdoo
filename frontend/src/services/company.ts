import type { Company } from '@/types/models'
import { ServiceError, api } from './client'

export async function getCompany(): Promise<Company> {
  return api<Company>('GET', '/company', undefined, 'Could not load your company.')
}

export async function updateCompany(
  patch: Pick<
    Partial<Company>,
    'name' | 'logo_url' | 'time_off_types' | 'working_days' | 'workday_start' | 'workday_end'
  >,
): Promise<Company> {
  return api<Company>('PATCH', '/company', patch, 'Could not update your company.')
}

const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

export async function uploadCompanyLogo(file: File): Promise<string> {
  if (!LOGO_TYPES.includes(file.type)) throw new ServiceError('Use a JPG, PNG, WebP, or SVG logo.')
  if (file.size > 5 * 1024 * 1024) throw new ServiceError('The logo must be 5 MB or smaller.')

  const form = new FormData()
  form.append('file', file)
  const { url } = await api<{ url: string }>('POST', '/uploads/company-logos', form, 'Could not upload that company logo.')
  return url
}

const LOGO_PREFIX = '/api/files/company-logos/'

export async function deleteCompanyLogo(url: string): Promise<void> {
  const pathname = new URL(url, window.location.origin).pathname
  if (!pathname.startsWith(LOGO_PREFIX)) return
  const path = decodeURIComponent(pathname.slice(LOGO_PREFIX.length))
  await api(
    'DELETE',
    `/uploads/company-logos?path=${encodeURIComponent(path)}`,
    undefined,
    'Could not remove the previous company logo.',
  )
}
