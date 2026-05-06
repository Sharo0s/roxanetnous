import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { extraireCodeDepartement } from '@/lib/code-postal'

export { extraireCodeDepartement }

export type Departement = {
  code: string
  nom: string
  region: string
  ouvert: boolean
  ouvert_le: string | null
}

export const DEPARTEMENTS_CACHE_TAG = 'departements-ouverts'

const fetchDepartements = unstable_cache(
  async (): Promise<Departement[]> => {
    const supabase = await createClient({ serviceRole: true })
    const { data, error } = await supabase
      .from('departements_ouverts')
      .select('code, nom, region, ouvert, ouvert_le')
      .order('code', { ascending: true })

    if (error || !data) return []
    return data as Departement[]
  },
  ['departements-ouverts-all'],
  { revalidate: 30, tags: [DEPARTEMENTS_CACHE_TAG] }
)

export async function getAllDepartements(): Promise<Departement[]> {
  return fetchDepartements()
}

export async function getDepartementsOuverts(): Promise<Departement[]> {
  const all = await fetchDepartements()
  return all.filter((d) => d.ouvert)
}

export async function getCodesDepartementsOuverts(): Promise<string[]> {
  const ouverts = await getDepartementsOuverts()
  return ouverts.map((d) => d.code)
}

// Construit une chaine PostgREST `.or()` filtrant code_postal sur les 2
// premiers chars (code departement). 2A et 2B sont mappes a code_postal LIKE
// '20%' (codes postaux corses 20xxx). Liste vide -> filtre qui ne match jamais.
export function buildCodesPostauxFilterOr(codesDepartements: string[]): string {
  if (codesDepartements.length === 0) {
    return 'code_postal.eq.__none__'
  }

  const prefixes = new Set<string>()
  for (const code of codesDepartements) {
    if (code === '2A' || code === '2B') {
      prefixes.add('20')
    } else {
      prefixes.add(code)
    }
  }

  return Array.from(prefixes)
    .map((p) => `code_postal.like.${p}%`)
    .join(',')
}

export async function getCodesPostauxFilterOr(): Promise<string> {
  const codes = await getCodesDepartementsOuverts()
  return buildCodesPostauxFilterOr(codes)
}

export async function isDepartementOuvert(codePostal: string | null | undefined): Promise<boolean> {
  const code = extraireCodeDepartement(codePostal)
  if (!code) return false
  const codes = await getCodesDepartementsOuverts()
  // Cas Corse : 20xxx couvre 2A et 2B. Si l'un des deux est ouvert, on accepte.
  if (code === '20') {
    return codes.includes('2A') || codes.includes('2B')
  }
  return codes.includes(code)
}

export async function getMessageRestriction(): Promise<string> {
  const ouverts = await getDepartementsOuverts()

  if (ouverts.length === 0) {
    return "L'inscription n'est pas encore ouverte. Merci de revenir prochainement."
  }

  const regions = Array.from(new Set(ouverts.map((d) => d.region))).sort()
  const codes = ouverts.map((d) => d.code).sort()

  const regionsTxt =
    regions.length === 1
      ? regions[0]
      : regions.length === 2
        ? `${regions[0]} et ${regions[1]}`
        : `${regions.slice(0, -1).join(', ')} et ${regions[regions.length - 1]}`

  return `Roxane et Nous est actuellement disponible uniquement en ${regionsTxt} (departements ${codes.join(', ')}). D'autres territoires ouvriront prochainement.`
}
