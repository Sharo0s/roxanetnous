import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Database } from '@/types/supabase'
import { getAllDepartements } from '@/lib/departements'

type SearchParams = {
  dpt?: string
  q?: string
  status?: 'tous' | 'attente' | 'notifie'
}

const ROLE_LABELS: Record<string, string> = {
  accompagnant: 'Accompagnant',
  accompagne: 'Bénéficiaire',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function AdminInscritsHorsZonePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const dptFilter = params.dpt?.toString().trim() || ''
  const qFilter = params.q?.toString().trim().toLowerCase() || ''
  const statusFilter = (params.status === 'attente' || params.status === 'notifie') ? params.status : 'tous'

  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  const [{ data: rows }, departements] = await Promise.all([
    supabaseAdmin
      .from('notifications_ouverture')
      .select('id, email, code_departement, role, created_at, notified_at')
      .order('created_at', { ascending: false }),
    getAllDepartements(),
  ])

  const dptMap = new Map(departements.map((d) => [d.code, d]))
  const all = rows || []

  // Agrégat par département (avant filtres pour garder la vue d'ensemble)
  const parDpt = new Map<string, { total: number; enAttente: number; notifies: number }>()
  for (const r of all) {
    const code = r.code_departement
    const entry = parDpt.get(code) ?? { total: 0, enAttente: 0, notifies: 0 }
    entry.total++
    if (r.notified_at) entry.notifies++
    else entry.enAttente++
    parDpt.set(code, entry)
  }
  const top = Array.from(parDpt.entries())
    .map(([code, c]) => ({ code, ...c, dpt: dptMap.get(code) }))
    .sort((a, b) => b.enAttente - a.enAttente)
    .slice(0, 8)

  // Tableau filtré
  const filtered = all.filter((r) => {
    if (dptFilter && r.code_departement !== dptFilter) return false
    if (statusFilter === 'attente' && r.notified_at) return false
    if (statusFilter === 'notifie' && !r.notified_at) return false
    if (qFilter && !r.email.toLowerCase().includes(qFilter)) return false
    return true
  })

  const totalEnAttente = all.filter((r) => !r.notified_at).length
  const totalNotifies = all.length - totalEnAttente

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8 max-w-2xl">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
        <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Inscrits hors zone</h1>
        <p className="text-sm text-gray-600 mt-3">
          Les personnes qui se sont inscrites pour être prévenues à l&apos;ouverture d&apos;un département.
          Une fois le département ouvert, un mail leur est envoyé automatiquement.
        </p>
      </header>

      {/* Totaux */}
      <div className="grid grid-cols-3 gap-3 mb-10 max-w-2xl">
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-4">
          <p className="text-xs text-gray-500">Inscrits au total</p>
          <p className="italic text-2xl text-gray-900 mt-1 tabular-nums">{all.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-4">
          <p className="text-xs text-gray-500">En attente</p>
          <p className="italic text-2xl text-gray-900 mt-1 tabular-nums">{totalEnAttente}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-4">
          <p className="text-xs text-gray-500">Déjà notifiés</p>
          <p className="italic text-2xl text-gray-900 mt-1 tabular-nums">{totalNotifies}</p>
        </div>
      </div>

      {/* Top par département */}
      {top.length > 0 && (
        <section className="mb-10" aria-labelledby="top-dpts">
          <div className="flex items-baseline justify-between mb-3">
            <h2 id="top-dpts" className="italic text-xl text-gray-900">Par département</h2>
            <span className="text-[11px] uppercase tracking-[0.18em] text-kraft font-medium">Top 8</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Où ouvrir en priorité — départements avec le plus de personnes en attente.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {top.map((entry) => {
              const isOpen = entry.dpt?.ouvert ?? false
              return (
                <li key={entry.code}>
                  <Link
                    href={`/admin/inscrits-hors-zone?dpt=${entry.code}`}
                    className="block bg-white rounded-2xl border border-[#e8dfd2] p-4 transition hover:border-kraft hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-gray-400">{entry.code}</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">
                          {entry.dpt?.nom || 'Inconnu'}
                        </p>
                      </div>
                      {isOpen && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 flex-shrink-0">
                          Ouvert
                        </span>
                      )}
                    </div>
                    <p className="italic text-2xl text-gray-900 mt-3 tabular-nums">
                      {entry.enAttente}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      en attente{entry.notifies > 0 ? ` · ${entry.notifies} notifié${entry.notifies > 1 ? 's' : ''}` : ''}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Filtres */}
      <section aria-labelledby="liste-complete">
        <div className="flex items-baseline justify-between mb-3">
          <h2 id="liste-complete" className="italic text-xl text-gray-900">Liste complète</h2>
          <span className="text-sm text-gray-500 tabular-nums">
            {filtered.length} / {all.length}
          </span>
        </div>

        <form className="flex flex-wrap gap-2 mb-5" role="search" aria-label="Filtrer les inscrits">
          <input
            type="search"
            name="q"
            defaultValue={qFilter}
            placeholder="Rechercher un email"
            aria-label="Rechercher un email"
            className="flex-1 min-w-[200px] bg-white border border-[#e8dfd2] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-kraft"
          />
          <select
            name="dpt"
            defaultValue={dptFilter}
            aria-label="Filtrer par département"
            className="bg-white border border-[#e8dfd2] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-kraft"
          >
            <option value="">Tous les départements</option>
            {Array.from(parDpt.keys()).sort().map((code) => {
              const d = dptMap.get(code)
              return (
                <option key={code} value={code}>
                  {code} — {d?.nom || 'Inconnu'}
                </option>
              )
            })}
          </select>
          <select
            name="status"
            defaultValue={statusFilter}
            aria-label="Filtrer par statut"
            className="bg-white border border-[#e8dfd2] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-kraft"
          >
            <option value="tous">Tous statuts</option>
            <option value="attente">En attente</option>
            <option value="notifie">Notifiés</option>
          </select>
          <button
            type="submit"
            className="bg-accent hover:bg-kraft border border-accent hover:border-kraft text-black rounded-full px-5 py-2 text-sm font-medium transition"
          >
            Filtrer
          </button>
          {(dptFilter || qFilter || statusFilter !== 'tous') && (
            <Link
              href="/admin/inscrits-hors-zone"
              className="inline-flex items-center px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition"
            >
              Réinitialiser
            </Link>
          )}
        </form>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] px-5 py-8 text-center text-sm text-gray-500 italic">
            {all.length === 0
              ? 'Personne ne s\'est encore inscrit pour être notifié.'
              : 'Aucun inscrit ne correspond à ces filtres.'}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#faf7f2] text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="text-left px-4 py-3 font-medium">Email</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">Département</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">Rôle</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">Inscrit le</th>
                  <th scope="col" className="text-left px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const d = dptMap.get(r.code_departement)
                  return (
                    <tr key={r.id} className="border-t border-[#f0e8db]">
                      <td className="px-4 py-3 text-gray-900 break-all">{r.email}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="font-mono text-xs text-gray-400 mr-2">{r.code_departement}</span>
                        {d?.nom || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.role ? (ROLE_LABELS[r.role] || r.role) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {r.notified_at ? (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                            Notifié le {formatDate(r.notified_at)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            En attente
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
