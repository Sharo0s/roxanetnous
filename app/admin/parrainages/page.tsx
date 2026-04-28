import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const STATUT_LABELS: Record<string, string> = {
  inscrite: 'Inscrite',
  abonnee: 'Abonnée',
  confirme: 'Confirmé',
  bloque: 'Bloqué',
  fraude: 'Fraude',
}

const FLAG_LABELS: Record<string, string> = {
  meme_ip: 'Même IP',
  meme_adresse: 'Même adresse',
  meme_carte: 'Même carte',
}

const RAISON_LABELS: Record<string, string> = {
  meme_email: 'Même email',
  meme_carte: 'Même carte',
}

const PAGE_SIZE = 50

function formatFlag(flag: string | null): string {
  if (!flag) return '-'
  return flag
    .split(',')
    .map((f) => FLAG_LABELS[f.trim()] || f.trim())
    .filter(Boolean)
    .join(', ') || '-'
}

type SearchParams = {
  statut?: string
  flag?: string
  page?: string
}

export default async function AdminParrainagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const statutFilter = params.statut?.toString() || ''
  const flagOnly = params.flag === '1'
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Counters par statut + flag (agrégés en parallèle).
  // Statuts réels en BDD : inscrite, abonnee, confirme, bloque, fraude (pas 'en_attente').
  const counterStatuts = ['inscrite', 'abonnee', 'confirme', 'bloque', 'fraude']
  const counterPromises = counterStatuts.map((s) =>
    supabaseAdmin
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .eq('statut', s),
  )
  // Counter "Avec flag" : disjoint des statuts terminaux (bloque/fraude) pour éviter
  // le double comptage avec les counters bloque/fraude.
  const flagCounterPromise = supabaseAdmin
    .from('parrainages')
    .select('id', { count: 'exact', head: true })
    .not('flag_suspicion', 'is', null)
    .not('statut', 'in', '(bloque,fraude)')

  const counterResults = await Promise.all([...counterPromises, flagCounterPromise])
  const counters: Record<string, number> = {}
  counterStatuts.forEach((s, i) => {
    counters[s] = counterResults[i].count || 0
  })
  counters.flag_suspicion = counterResults[counterResults.length - 1].count || 0

  // Tableau paginé. Tie-break sur id pour stabilité de l'ordre quand created_at est égal.
  let query = supabaseAdmin
    .from('parrainages')
    .select(
      `id, code, statut, blocage_raison, flag_suspicion, created_at,
       marraine:marraine_id (first_name, last_name, email),
       filleule:filleule_id (first_name, last_name, email)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (statutFilter && counterStatuts.includes(statutFilter)) {
    query = query.eq('statut', statutFilter)
  }
  if (flagOnly) {
    query = query.not('flag_suspicion', 'is', null)
  }

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data: rows, count } = await query.range(from, to)
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE))

  // Clamp page > totalPages : redirect vers la dernière page valide.
  if (page > totalPages && (count || 0) > 0) {
    const qs = new URLSearchParams()
    if (statutFilter) qs.set('statut', statutFilter)
    if (flagOnly) qs.set('flag', '1')
    if (totalPages > 1) qs.set('page', String(totalPages))
    redirect(`/admin/parrainages${qs.toString() ? `?${qs.toString()}` : ''}`)
  }

  function buildHref(overrides: Partial<SearchParams>): string {
    const merged = {
      statut: statutFilter,
      flag: flagOnly ? '1' : '',
      page: String(page),
      ...overrides,
    }
    const qs = new URLSearchParams()
    if (merged.statut) qs.set('statut', merged.statut)
    if (merged.flag) qs.set('flag', merged.flag)
    if (merged.page && merged.page !== '1') qs.set('page', merged.page)
    const s = qs.toString()
    return `/admin/parrainages${s ? `?${s}` : ''}`
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Parrainages</h2>
        <Link
          href="/admin/parrainages/blacklist"
          className="text-sm font-medium text-black hover:underline"
        >
          Blacklist et flags
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {(
          [
            ['inscrite', 'Inscrites'],
            ['abonnee', 'Abonnées'],
            ['confirme', 'Confirmés'],
            ['bloque', 'Bloqués'],
            ['fraude', 'Fraude'],
            ['flag_suspicion', 'Flags actifs'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-black mt-1">{counters[key] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Link
          href={buildHref({ statut: '', page: '1' })}
          className={`px-3 py-1.5 text-xs rounded-full border ${!statutFilter ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-black'}`}
        >
          Tous
        </Link>
        {counterStatuts.map((s) => (
          <Link
            key={s}
            href={buildHref({ statut: s, page: '1' })}
            className={`px-3 py-1.5 text-xs rounded-full border ${statutFilter === s ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-black'}`}
          >
            {STATUT_LABELS[s] || s}
          </Link>
        ))}
        <Link
          href={buildHref({ flag: flagOnly ? '' : '1', page: '1' })}
          className={`px-3 py-1.5 text-xs rounded-full border ${flagOnly ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-black'}`}
        >
          Avec flag
        </Link>
      </div>

      {!rows || rows.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
          Aucun parrainage à afficher.
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-accent/20 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Marraine</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Filleule</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Flag</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
                const marraine = row.marraine as
                  | { first_name?: string; last_name?: string; email?: string }
                  | null
                const filleule = row.filleule as
                  | { first_name?: string; last_name?: string; email?: string }
                  | null
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-accent/10">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {marraine
                        ? `${marraine.first_name || ''} ${marraine.last_name || ''}`.trim() ||
                          marraine.email ||
                          '-'
                        : '-'}
                      {marraine?.email && (
                        <div className="text-xs text-gray-400">{marraine.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {filleule
                        ? `${filleule.first_name || ''} ${filleule.last_name || ''}`.trim() ||
                          filleule.email ||
                          'N/A'
                        : 'N/A'}
                      {filleule?.email && (
                        <div className="text-xs text-gray-400">{filleule.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.statut === 'bloque' || row.statut === 'fraude'
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {STATUT_LABELS[row.statut] || row.statut}
                      </span>
                      {row.blocage_raison && (
                        <div className="text-xs text-gray-400 mt-1">
                          {RAISON_LABELS[row.blocage_raison] || row.blocage_raison}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatFlag(row.flag_suspicion)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/parrainages/blacklist?id=${row.id}`}
                        className="text-xs font-medium text-black hover:underline"
                      >
                        Voir
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Page {page} / {totalPages} ({count || 0} résultats)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white hover:border-black"
              >
                Précédent
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white hover:border-black"
              >
                Suivant
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
