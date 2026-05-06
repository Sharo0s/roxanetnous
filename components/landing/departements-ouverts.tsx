import Link from 'next/link'
import { getDepartementsOuverts, type Departement } from '@/lib/departements'
import { Reveal } from '@/components/landing/reveal'

type Presentation =
  | { kind: 'empty' }
  | { kind: 'mono'; region: string; departements: Departement[] }
  | { kind: 'multi'; groups: Array<{ region: string; departements: Departement[] }> }

// Map preposition + article par region pour rendre "Disponible <prefix> <region>"
// grammaticalement correct ("en Bretagne", "dans les Pays de la Loire", etc.).
// Couvre les 13 regions metropolitaines + 5 DROM. Fallback "en" si region inconnue.
const PREFIXE_REGION: Record<string, string> = {
  'Auvergne-Rhone-Alpes': 'en',
  'Bourgogne-Franche-Comte': 'en',
  'Bretagne': 'en',
  'Centre-Val de Loire': 'dans le',
  'Corse': 'en',
  'Grand Est': 'dans le',
  'Guadeloupe': 'en',
  'Guyane': 'en',
  'Hauts-de-France': 'dans les',
  'Ile-de-France': 'en',
  'La Reunion': 'a',
  'Martinique': 'en',
  'Mayotte': 'a',
  'Normandie': 'en',
  'Nouvelle-Aquitaine': 'en',
  'Occitanie': 'en',
  'Pays de la Loire': 'dans les',
  'Provence-Alpes-Cote d\'Azur': 'en',
}

function prefixeRegion(region: string): string {
  return PREFIXE_REGION[region] ?? 'en'
}

const CTA_WAITLIST_LABEL = 'Mon departement n\'est pas dans la liste — me prevenir a l\'ouverture'

// Regle D1 : si la whitelist contient exactement {Bretagne, Pays de la Loire}
// et que les codes Pays de la Loire ouverts sont uniquement '44', on presente
// l'ensemble comme une seule region "Bretagne" (Bretagne historique pre-1955).
function buildPresentation(deps: Departement[]): Presentation {
  if (deps.length === 0) return { kind: 'empty' }

  const sorted = [...deps].sort((a, b) => a.code.localeCompare(b.code, 'fr', { numeric: true }))
  const regions = new Set(sorted.map((d) => d.region))

  if (
    regions.size === 2 &&
    regions.has('Bretagne') &&
    regions.has('Pays de la Loire') &&
    sorted.filter((d) => d.region === 'Pays de la Loire').every((d) => d.code === '44')
  ) {
    return { kind: 'mono', region: 'Bretagne', departements: sorted }
  }

  if (regions.size === 1) {
    return { kind: 'mono', region: sorted[0].region, departements: sorted }
  }

  const groups = Array.from(regions)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((region) => ({
      region,
      departements: sorted.filter((d) => d.region === region),
    }))
  return { kind: 'multi', groups }
}

export async function DepartementsOuverts() {
  const departements = await getDepartementsOuverts()
  const presentation = buildPresentation(departements)

  if (presentation.kind === 'empty') {
    return (
      <section className="px-4 py-12 md:py-16 kraft bg-kraft" aria-labelledby="departements-ouverts-heading">
        <Reveal className="max-w-2xl mx-auto text-center relative z-10">
          <h2 id="departements-ouverts-heading" className="text-2xl md:text-3xl font-bold text-black mb-3">
            Lancement imminent
          </h2>
          <p className="text-base text-black mb-6">
            Le service ouvre prochainement. Laissez-nous votre email pour etre informe de l&apos;ouverture dans votre departement.
          </p>
          <p>
            <Link
              href="/waitlist"
              className="underline font-medium text-black hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
            >
              M&apos;inscrire a la waitlist
            </Link>
          </p>
        </Reveal>
      </section>
    )
  }

  if (presentation.kind === 'mono') {
    const total = presentation.departements.length
    return (
      <section className="px-4 py-12 md:py-16 kraft bg-kraft" aria-labelledby="departements-ouverts-heading">
        <Reveal className="max-w-4xl mx-auto text-center relative z-10">
          <h2 id="departements-ouverts-heading" className="text-2xl md:text-3xl font-bold text-black mb-2">
            Disponible {prefixeRegion(presentation.region)} {presentation.region}
          </h2>
          <p className="text-base text-black mb-6">
            {total} departement{total > 1 ? 's' : ''} actuellement couvert{total > 1 ? 's' : ''}.
          </p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-base text-black mb-6">
            {presentation.departements.map((d) => (
              <li key={d.code}>
                <span className="font-medium">{d.nom}</span>{' '}
                <span className="text-black/75">({d.code})</span>
              </li>
            ))}
          </ul>
          <p>
            <Link
              href="/waitlist"
              className="underline font-medium text-black hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
            >
              {CTA_WAITLIST_LABEL}
            </Link>
          </p>
        </Reveal>
      </section>
    )
  }

  const totalDepartements = presentation.groups.reduce((acc, g) => acc + g.departements.length, 0)
  return (
    <section className="px-4 py-12 md:py-16 kraft bg-kraft" aria-labelledby="departements-ouverts-heading">
      <Reveal className="max-w-4xl mx-auto text-center relative z-10">
        <h2 id="departements-ouverts-heading" className="text-2xl md:text-3xl font-bold text-black mb-2">
          Disponible actuellement
        </h2>
        <p className="text-base text-black mb-6">
          {totalDepartements} departement{totalDepartements > 1 ? 's' : ''} dans {presentation.groups.length} region{presentation.groups.length > 1 ? 's' : ''}.
        </p>
        <div className="space-y-6">
          {presentation.groups.map((g) => (
            <div key={g.region}>
              <h3 className="text-xl font-semibold text-black mb-2">{g.region}</h3>
              <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-base text-black">
                {g.departements.map((d) => (
                  <li key={d.code}>
                    <span className="font-medium">{d.nom}</span>{' '}
                    <span className="text-black/75">({d.code})</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6">
          <Link
            href="/waitlist"
            className="underline font-medium text-black hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
          >
            Mon departement n&apos;est pas dans la liste — me prevenir a l&apos;ouverture
          </Link>
        </p>
      </Reveal>
    </section>
  )
}
