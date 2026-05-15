import Link from 'next/link'
import { getDepartementsOuverts, type Departement } from '@/lib/departements'

type Presentation =
  | { kind: 'empty' }
  | { kind: 'mono'; region: string; departements: Departement[] }
  | { kind: 'multi'; groups: Array<{ region: string; departements: Departement[] }> }

// Map préposition + article par région pour rendre "Disponible <prefix> <region>"
// grammaticalement correct ("en Bretagne", "dans les Pays de la Loire", etc.).
// Couvre les 13 régions métropolitaines + 5 DROM. Fallback "en" si région inconnue.
// NB : les clés doivent correspondre exactement aux valeurs stockées en BDD
// (table departements_ouverts.region). Les noms ont été accentués en prod
// 2026-05-11 via MCP. Si une nouvelle région est ajoutée, mettre à jour le map
// et la BDD en parallèle, sinon le fallback `??` renverra "en" par défaut.
const PREFIXE_REGION: Record<string, string> = {
  'Auvergne-Rhône-Alpes': 'en',
  'Bourgogne-Franche-Comté': 'en',
  'Bretagne': 'en',
  'Centre-Val de Loire': 'dans le',
  'Corse': 'en',
  'Grand Est': 'dans le',
  'Hauts-de-France': 'dans les',
  'Île-de-France': 'en',
  'Normandie': 'en',
  'Nouvelle-Aquitaine': 'en',
  'Occitanie': 'en',
  'Pays de la Loire': 'dans les',
  'Provence-Alpes-Côte d\'Azur': 'en',
}

function prefixeRegion(region: string): string {
  return PREFIXE_REGION[region] ?? 'en'
}

const CTA_WAITLIST_LABEL = 'Mon département n\'est pas encore couvert ? Me tenir au courant.'

// Règle D1 : si la whitelist contient exactement {Bretagne, Pays de la Loire}
// et que les codes Pays de la Loire ouverts sont uniquement '44', on présente
// l'ensemble comme une seule région "Bretagne" (Bretagne historique pré-1955).
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
      <section
        className="px-4 py-5 md:py-6 bg-[#faf7f2] border-y border-[#e8dfd2]"
        aria-labelledby="departements-ouverts-heading"
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          <h2 id="departements-ouverts-heading" className="text-gray-700">
            <span className="uppercase tracking-[0.18em] text-xs text-kraft font-medium mr-2">Lancement imminent</span>
            <span className="text-gray-600">Le service ouvre prochainement.</span>
          </h2>
          <Link
            href="/me-tenir-au-courant"
            className="text-kraft hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
          >
            Me tenir au courant →
          </Link>
        </div>
      </section>
    )
  }

  if (presentation.kind === 'mono') {
    const total = presentation.departements.length
    return (
      <section
        className="px-4 py-5 md:py-6 bg-[#faf7f2] border-y border-[#e8dfd2]"
        aria-labelledby="departements-ouverts-heading"
      >
        <div className="max-w-5xl mx-auto">
          <details className="group">
            <summary
              aria-label={`Voir la couverture : ${total} département${total > 1 ? 's' : ''} ouvert${total > 1 ? 's' : ''} ${prefixeRegion(presentation.region)} ${presentation.region}`}
              className="cursor-pointer list-none flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
            >
              <h2 id="departements-ouverts-heading" className="text-sm text-gray-700">
                <span className="uppercase tracking-[0.18em] text-xs text-kraft font-medium">Disponible {prefixeRegion(presentation.region)} {presentation.region}</span>
                <span className="italic text-gray-900 ml-2 text-base">{total}</span>
                <span className="text-gray-500 ml-1">département{total > 1 ? 's' : ''} ouvert{total > 1 ? 's' : ''}</span>
              </h2>
              <span className="flex items-center gap-2 text-sm text-kraft hover:text-gray-900">
                <span className="group-open:hidden">Voir la couverture</span>
                <span className="hidden group-open:inline">Masquer</span>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#f4c8a3] shrink-0">
                  <svg className="group-open:rotate-180 transition-transform" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </span>
            </summary>
            <div className="mt-3 pt-3 border-t border-[#e8dfd2]">
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-700">
                {presentation.departements.map((d) => (
                  <li key={d.code}>
                    <span className="font-medium">{d.nom}</span>{' '}
                    <span className="text-gray-400">({d.code})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 pt-3 border-t border-[#e8dfd2] text-base">
                <Link
                  href="/me-tenir-au-courant"
                  className="text-kraft hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
                >
                  {CTA_WAITLIST_LABEL}
                </Link>
              </p>
            </div>
          </details>
        </div>
      </section>
    )
  }

  const totalDepartements = presentation.groups.reduce((acc, g) => acc + g.departements.length, 0)
  return (
    <section
      className="px-4 py-5 md:py-6 bg-[#faf7f2] border-y border-[#e8dfd2]"
      aria-labelledby="departements-ouverts-heading"
    >
      <div className="max-w-5xl mx-auto">
        <details className="group">
          <summary
            aria-label={`Voir le détail de la couverture : ${totalDepartements} départements dans ${presentation.groups.length} régions`}
            className="cursor-pointer list-none flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
          >
            <h2 id="departements-ouverts-heading" className="text-sm text-gray-700">
              <span className="uppercase tracking-[0.18em] text-xs text-kraft font-medium">Couverture</span>
              <span className="italic text-gray-900 ml-2 text-base">{totalDepartements}</span>
              <span className="text-gray-500 ml-1">départements · {presentation.groups.length} régions</span>
            </h2>
            <span className="text-sm text-kraft hover:text-gray-900">
              <span className="group-open:hidden">Voir le détail →</span>
              <span className="hidden group-open:inline">Masquer ↑</span>
            </span>
          </summary>
          <div className="mt-3 pt-3 border-t border-[#e8dfd2] space-y-4">
            {presentation.groups.map((g) => (
              <div key={g.region}>
                <h3 className="text-xs uppercase tracking-[0.14em] text-kraft font-medium mb-1.5">{g.region}</h3>
                <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-700">
                  {g.departements.map((d) => (
                    <li key={d.code}>
                      <span className="font-medium">{d.nom}</span>{' '}
                      <span className="text-gray-400">({d.code})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-base pt-3 border-t border-[#e8dfd2]">
              <Link
                href="/me-tenir-au-courant"
                className="text-kraft hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
              >
                {CTA_WAITLIST_LABEL}
              </Link>
            </p>
          </div>
        </details>
      </div>
    </section>
  )
}
