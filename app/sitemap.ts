import { createClient } from '@/lib/supabase/server'
import { getCodesPostauxFilterOr } from '@/lib/departements'
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient({ serviceRole: true })

  // Pages statiques
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/recherche`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/mentions-legales`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/politique-de-confidentialite`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/accessibilite`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/cgu`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Annonces accompagnantes publiees (whitelist departements_ouverts)
  const codesFilter = await getCodesPostauxFilterOr()
  const { data: annonces } = await supabase
    .from('annonces_accompagnantes')
    .select('id, updated_at')
    .eq('status', 'publiee')
    .or(codesFilter)

  const annoncesPages: MetadataRoute.Sitemap = (annonces || []).map((a) => ({
    url: `${BASE_URL}/recherche/${a.id}`,
    lastModified: new Date(a.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...annoncesPages]
}
