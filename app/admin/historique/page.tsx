import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

// Story 4.6 : narrowing applicatif pour `admin_actions_log.details: Json | null`.
// Whitelist des cles connues inserees par les actions admin (cf. app/actions/*.ts +
// app/api/webhooks/stripe + app/api/cron/confirm-parrainages). Story 4.6 review pass 2
// patch F1 : ajout des cles parrainage fraude (`flag`, `raison`, `via`, `coupon_id`,
// `marraine_id`, `filleule_id`) absentes du whitelist initial qui forcaient le fallback
// JSON sur les rows `parrainage_flag` (truncate mid-UUID -> perte de la valeur `flag`).
type AdminLogDetails = {
  motif?: string
  decision?: string
  status?: string
  viewed_at?: string
  notes?: string
  notes_admin?: string | null
  reason?: string
  planifie_le?: string
  visio_date?: string
  deleted_at?: string
  cancelled_at?: string
  plan_type?: string
  current_status?: string | null
  stripe_subscription_id?: string
  parrainage_id?: string
  flag?: string
  raison?: string
  via?: string
  coupon_id?: string
  marraine_id?: string | null
  filleule_id?: string | null
}

const PREFERRED_LIMIT = 200
const FALLBACK_LIMIT = 200

// Rendu de la cellule "Details" : prefere les cles humainement lisibles, fallback
// JSON.stringify tronque pour ne pas masquer silencieusement les actions hors whitelist.
function renderDetails(details: AdminLogDetails | null): string {
  if (!details || typeof details !== 'object') return ''
  const preferred =
    details.motif ||
    details.decision ||
    details.status ||
    details.reason ||
    details.notes ||
    details.flag ||
    details.raison ||
    details.via
  if (preferred) return preferred.slice(0, PREFERRED_LIMIT)
  const fallback = JSON.stringify(details)
  return fallback === '{}' ? '' : fallback.slice(0, FALLBACK_LIMIT)
}

export default async function AdminHistoriquePage() {
  // Story 4.6 (variante locale SCP) : factories Supabase non typees `<Database>`
  // pour preserver les 17 fichiers hors-admin. Cast localise au point d'appel.
  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  const { data: logs } = await supabaseAdmin
    .from('admin_actions_log')
    .select(`
      id, action_type, target_type, target_id, details, created_at,
      users!admin_id (first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const actionLabels: Record<string, string> = {
    valide: 'Validation profil',
    refuse: 'Refus profil',
    a_completer: 'Demande complément',
    visio_planifiee: 'Visio planifiée',
    visio_realisee: 'Visio réalisée',
    consultation_justificatif: 'Consultation justificatif',
    signalement_averti: 'Avertissement',
    signalement_suspendu: 'Suspension',
    signalement_supprime: 'Suppression',
    signalement_ignore: 'Signalement ignoré',
    annonce_suspendue: 'Annonce suspendue',
    annonce_publiee: 'Annonce republiée',
    annonce_archivee: 'Annonce archivée',
    validation_par_parrainage: 'Validation par parrainage',
    parrainage_bloque: 'Parrainage bloqué',
    parrainage_flag: 'Parrainage suspect',
    parrainage_autorise_exception: 'Parrainage - exception autorisée',
    parrainage_fraude_confirmee: 'Parrainage - fraude confirmée',
    parrainage_ignore_flag: 'Parrainage - flag ignoré',
    parrainage_recompense_appliquee: 'Parrainage - récompense 6 mois appliquée',
    parrainage_admin_alert_lost: 'Alerte parrainage perdue (email admin manquant)',
  }

  return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Historique des actions</h1>

        {!logs || logs.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
            Aucune action enregistrée.
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-accent/20 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Admin</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Cible</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Détails</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const admin = log.users
                  const rawDetails = log.details
                  const details = (rawDetails && typeof rawDetails === 'object' && !Array.isArray(rawDetails)
                    ? rawDetails
                    : null) as AdminLogDetails | null

                  return (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-accent/10">
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {admin?.first_name} {admin?.last_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {actionLabels[log.action_type] || log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 capitalize">
                        {log.target_type}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">
                        {renderDetails(details)}
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
