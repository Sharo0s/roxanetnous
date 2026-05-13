import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Database } from '@/types/supabase'
import { ParrainageBlacklistActions } from '@/components/admin/parrainage-blacklist-actions'

const STATUT_LABELS: Record<string, string> = {
  inscrite: 'Inscrit',
  abonnee: 'Abonné',
  confirme: 'Confirmé',
  bloque: 'Bloqué',
  fraude: 'Fraude',
}

const STATUT_TONE: Record<string, string> = {
  inscrite: 'bg-gray-100 text-gray-700',
  abonnee: 'bg-blue-50 text-blue-800',
  confirme: 'bg-green-50 text-green-800',
  bloque: 'bg-red-50 text-red-800',
  fraude: 'bg-black text-white',
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
const STATUTS = ['inscrite', 'abonnee', 'confirme', 'bloque', 'fraude'] as const

function formatFlag(flag: string | null): string {
  if (!flag) return ''
  return flag
    .split(',')
    .map((f) => FLAG_LABELS[f.trim()] || f.trim())
    .filter(Boolean)
    .join(', ')
}

type SearchParams = {
  vue?: 'tous' | 'suspects' | 'bloques'
  statut?: string
  page?: string
  id?: string
}

type ParrainageRow = {
  id: string
  code: string | null
  statut: string
  blocage_raison: string | null
  flag_suspicion: string | null
  created_at: string
  filleule_id: string | null
  marraine: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null
  filleule: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null
}

export default async function AdminParrainagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const vue = params.vue === 'suspects' || params.vue === 'bloques' ? params.vue : 'tous'
  const statutFilter = params.statut?.toString() || ''
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const highlightId = params.id?.toString() || ''

  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  // Compteurs globaux (tous statuts + flags actifs)
  const counterPromises = STATUTS.map((s) =>
    supabaseAdmin
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .eq('statut', s),
  )
  const flagCounterPromise = supabaseAdmin
    .from('parrainages')
    .select('id', { count: 'exact', head: true })
    .not('flag_suspicion', 'is', null)
    .not('statut', 'in', '(bloque,fraude)')

  const counterResults = await Promise.all([...counterPromises, flagCounterPromise])
  const counters: Record<string, number> = {}
  STATUTS.forEach((s, i) => {
    counters[s] = counterResults[i].count || 0
  })
  counters.flag_suspicion = counterResults[counterResults.length - 1].count || 0

  // Requête principale (paginée)
  let query = supabaseAdmin
    .from('parrainages')
    .select(
      `id, code, statut, blocage_raison, flag_suspicion, created_at, filleule_id,
       marraine:marraine_id (first_name, last_name, email, phone),
       filleule:filleule_id (first_name, last_name, email, phone)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (vue === 'bloques') {
    query = query.in('statut', ['bloque', 'fraude'])
  } else if (vue === 'suspects') {
    query = query.not('flag_suspicion', 'is', null).not('statut', 'in', '(bloque,fraude)')
  }
  if (statutFilter && (STATUTS as readonly string[]).includes(statutFilter)) {
    query = query.eq('statut', statutFilter)
  }

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data: rawRows, count } = await query.range(from, to)
  const rows = (rawRows || []) as unknown as ParrainageRow[]

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE))
  if (page > totalPages && (count || 0) > 0) {
    const qs = new URLSearchParams()
    if (vue !== 'tous') qs.set('vue', vue)
    if (statutFilter) qs.set('statut', statutFilter)
    if (totalPages > 1) qs.set('page', String(totalPages))
    redirect(`/admin/parrainages${qs.toString() ? `?${qs.toString()}` : ''}`)
  }

  // Charger les adresses des filleules (utile en vue à risque pour audit anti-fraude)
  const adressesByUserId: Record<string, string> = {}
  if (vue !== 'tous' && rows.length > 0) {
    const filleuleIds = Array.from(new Set(rows.map((r) => r.filleule_id).filter(Boolean) as string[]))
    if (filleuleIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('accompagnants_profiles')
        .select('user_id, adresse, ville, code_postal')
        .in('user_id', filleuleIds)
      for (const p of profiles || []) {
        const parts = [p.adresse, p.code_postal, p.ville].filter(Boolean)
        adressesByUserId[p.user_id as string] = parts.join(', ')
      }
    }
  }

  function buildHref(overrides: Partial<SearchParams>): string {
    const merged = { vue, statut: statutFilter, page: String(page), ...overrides }
    const qs = new URLSearchParams()
    if (merged.vue && merged.vue !== 'tous') qs.set('vue', merged.vue)
    if (merged.statut) qs.set('statut', merged.statut)
    if (merged.page && merged.page !== '1') qs.set('page', merged.page)
    const s = qs.toString()
    return `/admin/parrainages${s ? `?${s}` : ''}`
  }

  const showRichDetails = vue !== 'tous'
  const totalAtRisk = counters.flag_suspicion + counters.bloque + counters.fraude

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8 max-w-2xl">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
        <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Parrainages</h1>
        <p className="text-sm text-gray-600 mt-3">
          Toutes les relations marraine / filleule, leur statut et leur risque éventuel.
          {totalAtRisk > 0 && (
            <> Actuellement <strong className="text-gray-900">{totalAtRisk}</strong> dossier{totalAtRisk > 1 ? 's' : ''} à examiner.</>
          )}
        </p>
      </header>

      {/* KPI globaux */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {(
          [
            ['inscrite', 'Inscrits'],
            ['abonnee', 'Abonnés'],
            ['confirme', 'Confirmés'],
            ['flag_suspicion', 'Flags actifs'],
            ['bloque', 'Bloqués'],
            ['fraude', 'Fraude'],
          ] as const
        ).map(([key, label]) => {
          const isRisk = key === 'flag_suspicion' || key === 'bloque' || key === 'fraude'
          return (
            <div
              key={key}
              className={`rounded-2xl border p-4 ${
                isRisk && (counters[key] ?? 0) > 0
                  ? 'border-kraft bg-[#f3ebde]'
                  : 'border-[#e8dfd2] bg-white'
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-kraft font-medium">{label}</p>
              <p className="italic text-3xl text-gray-900 mt-1 tabular-nums">{counters[key] ?? 0}</p>
            </div>
          )
        })}
      </div>

      {/* Onglets de vue (liens drill-down, pas un pattern ARIA tablist) */}
      <nav aria-label="Filtrer par vue" className="flex gap-2 mb-4 flex-wrap">
        {(
          [
            ['tous', 'Tous les parrainages', count],
            ['suspects', 'Suspects (flags)', counters.flag_suspicion],
            ['bloques', 'Bloqués & fraude', counters.bloque + counters.fraude],
          ] as const
        ).map(([key, label, badge]) => {
          const active = vue === key
          return (
            <Link
              key={key}
              href={buildHref({ vue: key, statut: '', page: '1' })}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition border ${
                active
                  ? 'bg-accent border-accent text-black font-medium'
                  : 'bg-white border-[#e8dfd2] text-gray-700 hover:border-kraft'
              }`}
            >
              {label}
              {typeof badge === 'number' && badge > 0 && (
                <span className={`text-xs tabular-nums ${active ? 'text-gray-700' : 'text-gray-500'}`}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Filtre statut secondaire (seulement en vue "tous") */}
      {vue === 'tous' && (
        <div className="flex items-center gap-2 mb-6 flex-wrap" role="group" aria-label="Filtrer par statut">
          <Link
            href={buildHref({ statut: '', page: '1' })}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${
              !statutFilter
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-[#e8dfd2] hover:border-kraft'
            }`}
          >
            Tous statuts
          </Link>
          {STATUTS.map((s) => (
            <Link
              key={s}
              href={buildHref({ statut: s, page: '1' })}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                statutFilter === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-[#e8dfd2] hover:border-kraft'
              }`}
            >
              {STATUT_LABELS[s]}
              <span className="ml-1.5 tabular-nums opacity-70">{counters[s]}</span>
            </Link>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-500 mb-4 tabular-nums">
        {count ?? 0} résultat{(count ?? 0) > 1 ? 's' : ''}
      </p>

      {/* Tableau */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-10 text-center text-gray-500 italic">
          {vue === 'suspects' && 'Aucun parrainage avec flag actif.'}
          {vue === 'bloques' && 'Aucun parrainage bloqué ou frauduleux.'}
          {vue === 'tous' && (statutFilter ? `Aucun parrainage avec le statut "${STATUT_LABELS[statutFilter] || statutFilter}".` : 'Aucun parrainage à afficher.')}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8dfd2] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#faf7f2] text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th scope="col" className="text-left px-4 py-3 font-medium">Date</th>
                <th scope="col" className="text-left px-4 py-3 font-medium">Marraine</th>
                <th scope="col" className="text-left px-4 py-3 font-medium">Filleule</th>
                <th scope="col" className="text-left px-4 py-3 font-medium">Statut</th>
                {showRichDetails ? (
                  <>
                    <th scope="col" className="text-left px-4 py-3 font-medium">Raison / Flag</th>
                    <th scope="col" className="text-left px-4 py-3 font-medium">Actions</th>
                  </>
                ) : (
                  <>
                    <th scope="col" className="text-left px-4 py-3 font-medium">Flag</th>
                    <th scope="col" className="text-left px-4 py-3 font-medium">Détail</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const marraine = row.marraine
                const filleule = row.filleule
                const isHighlighted = highlightId && row.id === highlightId
                const filleuleAdresse = row.filleule_id ? adressesByUserId[row.filleule_id] || '' : ''
                const isBlocked = row.statut === 'bloque' || row.statut === 'fraude'
                const hasFlag = !!row.flag_suspicion

                return (
                  <tr
                    key={row.id}
                    id={`row-${row.id}`}
                    aria-current={isHighlighted ? 'true' : undefined}
                    className={`border-t border-[#f0e8db] align-top ${
                      isHighlighted ? 'bg-[#f3ebde]' : 'hover:bg-[#faf7f2]'
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium">
                        {marraine
                          ? `${marraine.first_name || ''} ${marraine.last_name || ''}`.trim() || '—'
                          : '—'}
                      </div>
                      {marraine?.email && (
                        <div className="text-xs text-gray-500 break-all">{marraine.email}</div>
                      )}
                      {showRichDetails && marraine?.phone && (
                        <div className="text-xs text-gray-400">{marraine.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium">
                        {filleule
                          ? `${filleule.first_name || ''} ${filleule.last_name || ''}`.trim() || 'N/A'
                          : 'N/A'}
                      </div>
                      {filleule?.email && (
                        <div className="text-xs text-gray-500 break-all">{filleule.email}</div>
                      )}
                      {showRichDetails && filleule?.phone && (
                        <div className="text-xs text-gray-400">{filleule.phone}</div>
                      )}
                      {showRichDetails && filleuleAdresse && (
                        <div className="text-xs text-gray-400">{filleuleAdresse}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_TONE[row.statut] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUT_LABELS[row.statut] || row.statut}
                      </span>
                    </td>

                    {showRichDetails ? (
                      <>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {row.blocage_raison && (
                            <div className="mb-1">
                              <span className="font-medium text-gray-900">Blocage :</span>{' '}
                              {RAISON_LABELS[row.blocage_raison] || row.blocage_raison}
                            </div>
                          )}
                          {row.flag_suspicion && (
                            <div>
                              <span className="font-medium text-gray-900">Flag :</span>{' '}
                              {formatFlag(row.flag_suspicion)}
                            </div>
                          )}
                          {!row.blocage_raison && !row.flag_suspicion && '—'}
                        </td>
                        <td className="px-4 py-3">
                          {row.statut === 'fraude' ? (
                            <span className="text-xs text-gray-400">Fraude confirmée</span>
                          ) : (
                            <ParrainageBlacklistActions
                              parrainageId={row.id}
                              hasFlag={hasFlag}
                              isBlocked={isBlocked}
                            />
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatFlag(row.flag_suspicion) || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/parrainages?vue=bloques&id=${row.id}`}
                            className="text-xs font-medium text-kraft hover:text-gray-900 hover:underline transition"
                          >
                            Voir le détail
                          </Link>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500 tabular-nums">
            Page {page} / {totalPages} · {count || 0} résultats
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="px-3 py-1.5 text-xs rounded-full border border-[#e8dfd2] bg-white hover:border-kraft transition"
              >
                Précédent
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="px-3 py-1.5 text-xs rounded-full border border-[#e8dfd2] bg-white hover:border-kraft transition"
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
