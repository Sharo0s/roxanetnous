import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ParrainageBlacklistActions } from '@/components/admin/parrainage-blacklist-actions'

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

function formatFlag(flag: string | null): string {
  if (!flag) return '-'
  return flag
    .split(',')
    .map((f) => FLAG_LABELS[f.trim()] || f.trim())
    .filter(Boolean)
    .join(', ') || '-'
}

type SearchParams = {
  id?: string
}

export default async function AdminParrainagesBlacklistPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const highlightId = params.id?.toString() || ''

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Lecture des rows bloquées, frauduleuses ou flaggées.
  // PostgREST ne permet pas un OR avec IS NOT NULL trivialement ; on fait deux passes
  // puis on déduplique côté JS (le volume reste petit, c'est admin only).
  const [{ data: blockedRows }, { data: flaggedRows }] = await Promise.all([
    supabaseAdmin
      .from('parrainages')
      .select(
        `id, code, statut, blocage_raison, flag_suspicion, created_at, filleule_id,
         marraine:marraine_id (first_name, last_name, email, phone),
         filleule:filleule_id (first_name, last_name, email, phone)`,
      )
      .in('statut', ['bloque', 'fraude'])
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('parrainages')
      .select(
        `id, code, statut, blocage_raison, flag_suspicion, created_at, filleule_id,
         marraine:marraine_id (first_name, last_name, email, phone),
         filleule:filleule_id (first_name, last_name, email, phone)`,
      )
      .not('flag_suspicion', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  const seen = new Set<string>()
  const rows: any[] = []
  for (const r of [...(blockedRows || []), ...(flaggedRows || [])]) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    rows.push(r)
  }
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Charger en une passe les adresses des filleules pour l'affichage.
  const allFilleuleIds = [
    ...new Set(rows.map((r) => r.filleule_id).filter(Boolean) as string[]),
  ]

  const adressesByUserId: Record<string, string> = {}
  if (allFilleuleIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('accompagnantes_profiles')
      .select('user_id, adresse, ville, code_postal')
      .in('user_id', allFilleuleIds)
    if (profiles) {
      for (const p of profiles) {
        const parts = [p.adresse, p.code_postal, p.ville].filter(Boolean)
        adressesByUserId[p.user_id as string] = parts.join(', ')
      }
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Blacklist et flags</h2>
          <p className="text-sm text-gray-500 mt-1">
            Parrainages bloqués, frauduleux ou avec une suspicion à examiner.
          </p>
        </div>
        <Link
          href="/admin/parrainages"
          className="text-sm font-medium text-black hover:underline"
        >
          Vue d&apos;ensemble
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
          Aucun parrainage suspect ou bloqué.
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-accent/20 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Marraine</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Filleule</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Raison / Flag</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
                const marraine = row.marraine as
                  | { first_name?: string; last_name?: string; email?: string; phone?: string }
                  | null
                const filleule = row.filleule as
                  | { first_name?: string; last_name?: string; email?: string; phone?: string }
                  | null
                const isHighlighted = highlightId && row.id === highlightId
                const filleuleAdresse = row.filleule_id
                  ? adressesByUserId[row.filleule_id] || ''
                  : ''
                const isBlocked = row.statut === 'bloque' || row.statut === 'fraude'
                const hasFlag = !!row.flag_suspicion
                return (
                  <tr
                    key={row.id}
                    id={`row-${row.id}`}
                    aria-current={isHighlighted ? 'true' : undefined}
                    className={`border-b last:border-0 align-top ${
                      isHighlighted ? 'bg-accent/30' : 'hover:bg-accent/10'
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
                    <td className="px-4 py-3 text-gray-700">
                      <div className="font-medium">
                        {marraine
                          ? `${marraine.first_name || ''} ${marraine.last_name || ''}`.trim() || '-'
                          : '-'}
                      </div>
                      {marraine?.email && (
                        <div className="text-xs text-gray-400">{marraine.email}</div>
                      )}
                      {marraine?.phone && (
                        <div className="text-xs text-gray-400">{marraine.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="font-medium">
                        {filleule
                          ? `${filleule.first_name || ''} ${filleule.last_name || ''}`.trim() ||
                            'N/A'
                          : 'N/A'}
                      </div>
                      {filleule?.email && (
                        <div className="text-xs text-gray-400">{filleule.email}</div>
                      )}
                      {filleule?.phone && (
                        <div className="text-xs text-gray-400">{filleule.phone}</div>
                      )}
                      {filleuleAdresse && (
                        <div className="text-xs text-gray-400">{filleuleAdresse}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {row.blocage_raison && (
                        <div>
                          <span className="font-medium text-black">Blocage :</span>{' '}
                          {RAISON_LABELS[row.blocage_raison] || row.blocage_raison}
                        </div>
                      )}
                      {row.flag_suspicion && (
                        <div>
                          <span className="font-medium text-black">Flag :</span>{' '}
                          {formatFlag(row.flag_suspicion)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isBlocked ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {STATUT_LABELS[row.statut] || row.statut}
                      </span>
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
