import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
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
const LIMIT = 100

const ACTION_LABELS: Record<string, string> = {
  valide: 'Validation profil',
  refuse: 'Refus profil',
  a_completer: 'Demande complément',
  visio_planifiee: 'Visio planifiée',
  visio_realisee: 'Visio réalisée',
  consultation_profil: 'Consultation profil',
  consultation_justificatif: 'Consultation justificatif',
  grant_subscription: 'Abonnement offert',
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
  parrainage_debloque_par_validation: 'Parrainage débloqué',
  parrainage_autorise_exception: 'Parrainage - exception autorisée',
  parrainage_fraude_confirmee: 'Parrainage - fraude confirmée',
  parrainage_ignore_flag: 'Parrainage - flag ignoré',
  parrainage_recompense_appliquee: 'Parrainage - récompense 6 mois appliquée',
  parrainage_admin_alert_lost: 'Alerte parrainage perdue (email admin manquant)',
}

const TARGET_LABELS: Record<string, string> = {
  auxiliaire: 'un accompagnant',
  accompagnante: 'un accompagnant',
  accompagne: 'un accompagné',
  parrainage: 'un parrainage',
  signalement: 'un signalement',
  annonce: 'une annonce',
  subscription: 'un abonnement',
}

const ACTION_TONE: Record<string, 'kraft' | 'green' | 'amber' | 'red' | 'grey'> = {
  valide: 'green',
  refuse: 'red',
  a_completer: 'amber',
  visio_planifiee: 'kraft',
  visio_realisee: 'green',
  consultation_profil: 'grey',
  consultation_justificatif: 'grey',
  grant_subscription: 'kraft',
  signalement_averti: 'amber',
  signalement_suspendu: 'red',
  signalement_supprime: 'red',
  signalement_ignore: 'grey',
  annonce_suspendue: 'red',
  annonce_publiee: 'green',
  annonce_archivee: 'grey',
  validation_par_parrainage: 'green',
  parrainage_bloque: 'red',
  parrainage_flag: 'amber',
  parrainage_debloque_par_validation: 'green',
  parrainage_autorise_exception: 'kraft',
  parrainage_fraude_confirmee: 'red',
  parrainage_ignore_flag: 'grey',
  parrainage_recompense_appliquee: 'green',
  parrainage_admin_alert_lost: 'red',
}

const TONE_CLASS: Record<string, string> = {
  kraft: 'bg-[#f3ebde] text-[#a8714f]',
  green: 'bg-green-50 text-green-800',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-800',
  grey: 'bg-gray-100 text-gray-600',
}

const PLAN_LABELS: Record<string, string> = {
  mensuel: 'Plan mensuel',
  annuel: 'Plan annuel',
  monthly: 'Plan mensuel',
  annual: 'Plan annuel',
}

// Traductions des valeurs internes (codes raison/flag, decisions, statuts).
// Si la valeur n'est pas dans cette table, on l'affiche telle quelle.
const VALUE_LABELS: Record<string, string> = {
  // Decisions de validation
  valide: 'Validé',
  refuse: 'Refusé',
  a_completer: 'À compléter',
  // Raisons techniques de deblocage parrainage
  rattrapage_post_fix: 'Rattrapage après correctif',
  // Flags / raisons de suspicion parrainage
  meme_ip: 'Même adresse IP',
  meme_carte: 'Même carte bancaire',
  meme_email: 'Même email',
  meme_adresse: 'Même adresse',
  webhook_meme_carte: 'Détecté via webhook (même carte)',
  webhook_meme_ip: 'Détecté via webhook (même IP)',
}

function translateValue(v: string | null | undefined): string {
  if (!v) return ''
  return VALUE_LABELS[v] || v
}

// Cles techniques qu'on ne veut pas reafficher en clair (deja portees par l'entree elle-meme
// ou trop bruyantes pour Sylvain). On les enleve avant le fallback JSON pour ne pas etaler
// du bruit dans la timeline.
const NOISY_KEYS = new Set<string>([
  'viewed_at',
  'stripe_subscription_id',
  'parrainage_id',
  'marraine_id',
  'filleule_id',
  'cancelled_at',
  'deleted_at',
  'planifie_le',
  'visio_date',
])

function renderDetails(action: string, details: AdminLogDetails | null): string {
  if (!details || typeof details !== 'object') return ''

  // Cas specifiques par action
  if (action === 'grant_subscription' && details.plan_type) {
    return PLAN_LABELS[details.plan_type] || `Plan ${details.plan_type}`
  }

  // Cles humaines preferees
  const preferred =
    details.motif ||
    details.decision ||
    details.status ||
    details.reason ||
    details.notes ||
    details.flag ||
    details.raison ||
    details.via
  if (preferred) {
    // Si la decision duplique le label de l'action (ex : action=valide + decision=valide),
    // on masque pour ne pas afficher deux fois la meme info.
    if (preferred.toLowerCase() === action.toLowerCase()) return ''
    return translateValue(preferred).slice(0, PREFERRED_LIMIT)
  }

  // Fallback : on ne montre que les cles non bruyantes et non vides
  const visible: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
    if (NOISY_KEYS.has(k)) continue
    if (v === null || v === undefined || v === '') continue
    visible[k] = v
  }
  if (Object.keys(visible).length === 0) return ''
  return JSON.stringify(visible).slice(0, FALLBACK_LIMIT)
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (target.getTime() === today.getTime()) return "Aujourd'hui"
  if (target.getTime() === yesterday.getTime()) return 'Hier'
  return target.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

type SearchParams = {
  admin?: string
  action?: string
  q?: string
}

export default async function AdminHistoriquePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const adminFilter = params.admin?.toString().trim() || ''
  const actionFilter = params.action?.toString().trim() || ''
  const qFilter = params.q?.toString().trim().toLowerCase() || ''

  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  const { data: logs } = await supabaseAdmin
    .from('admin_actions_log')
    .select(`
      id, action_type, target_type, target_id, details, created_at, admin_id,
      users!admin_id (first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  const all = logs || []

  // Listes pour les selects (calculées sur la fenêtre actuelle)
  const adminMap = new Map<string, string>()
  const actionSet = new Set<string>()
  for (const log of all) {
    if (log.admin_id) {
      const u = log.users
      adminMap.set(log.admin_id, u ? `${u.first_name} ${u.last_name}` : 'Admin inconnu')
    }
    actionSet.add(log.action_type)
  }
  const admins = Array.from(adminMap.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  const actions = Array.from(actionSet).sort()

  // Filtrage
  const filtered = all.filter((log) => {
    if (adminFilter && log.admin_id !== adminFilter) return false
    if (actionFilter && log.action_type !== actionFilter) return false
    if (qFilter) {
      const rawDetails = log.details
      const details = (rawDetails && typeof rawDetails === 'object' && !Array.isArray(rawDetails)
        ? rawDetails
        : null) as AdminLogDetails | null
      const haystack = [
        log.action_type,
        log.target_type,
        log.target_id,
        renderDetails(log.action_type, details),
        log.users ? `${log.users.first_name} ${log.users.last_name}` : '',
      ].join(' ').toLowerCase()
      if (!haystack.includes(qFilter)) return false
    }
    return true
  })

  // Groupement par jour
  const groupedMap = new Map<string, typeof filtered>()
  for (const log of filtered) {
    const key = dayKey(log.created_at)
    const list = groupedMap.get(key) ?? []
    list.push(log)
    groupedMap.set(key, list)
  }
  const grouped = Array.from(groupedMap.entries())

  const hasFilters = adminFilter || actionFilter || qFilter

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8 max-w-2xl">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
        <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Historique des actions</h1>
        <p className="text-sm text-gray-600 mt-3">
          Les {LIMIT} dernières actions administratives, du plus récent au plus ancien. Chaque entrée trace
          qui a fait quoi, sur quelle cible et quand.
        </p>
      </header>

      {/* Filtres */}
      <form
        className="flex flex-wrap gap-2 mb-8"
        role="search"
        aria-label="Filtrer l'historique"
      >
        <input
          type="search"
          name="q"
          defaultValue={qFilter}
          placeholder="Rechercher (action, détails, admin...)"
          aria-label="Rechercher dans l'historique"
          className="flex-1 min-w-[240px] bg-white border border-[#e8dfd2] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-kraft"
        />
        <select
          name="admin"
          defaultValue={adminFilter}
          aria-label="Filtrer par admin"
          className="bg-white border border-[#e8dfd2] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-kraft"
        >
          <option value="">Tous les admins</option>
          {admins.map(([id, nom]) => (
            <option key={id} value={id}>{nom}</option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={actionFilter}
          aria-label="Filtrer par type d'action"
          className="bg-white border border-[#e8dfd2] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-kraft"
        >
          <option value="">Toutes les actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-accent hover:bg-kraft border border-accent hover:border-kraft text-black rounded-full px-5 py-2 text-sm font-medium transition"
        >
          Filtrer
        </button>
        {hasFilters && (
          <Link
            href="/admin/historique"
            className="inline-flex items-center px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {/* Compteur */}
      <p className="text-sm text-gray-500 mb-6 tabular-nums">
        {filtered.length} action{filtered.length > 1 ? 's' : ''}
        {hasFilters && all.length !== filtered.length && ` sur ${all.length}`}
      </p>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-10 text-center text-gray-500 italic">
          {all.length === 0
            ? 'Aucune action enregistrée.'
            : 'Aucune action ne correspond à ces filtres.'}
        </div>
      ) : (
        <div className="relative pl-8">
          {/* Ligne verticale */}
          <div
            className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-[#e8dfd2]"
            aria-hidden="true"
          />

          {grouped.map(([key, items]) => (
            <section key={key} className="mb-8" aria-label={dayLabel(key)}>
              {/* Jalon */}
              <div className="relative -ml-8 mb-4 flex items-center gap-3">
                <span className="w-4 h-px bg-[#e8dfd2]" aria-hidden="true" />
                <h2 className="italic text-base text-gray-900 capitalize">
                  {dayLabel(key)}
                </h2>
                <span className="text-xs text-gray-400 tabular-nums">
                  {items.length} action{items.length > 1 ? 's' : ''}
                </span>
                <span className="flex-1 h-px bg-[#f0e8db]" aria-hidden="true" />
              </div>

              <ul className="space-y-2">
                {items.map((log) => {
                  const admin = log.users
                  const rawDetails = log.details
                  const details = (rawDetails && typeof rawDetails === 'object' && !Array.isArray(rawDetails)
                    ? rawDetails
                    : null) as AdminLogDetails | null
                  const detailText = renderDetails(log.action_type, details)
                  const tone = ACTION_TONE[log.action_type] || 'grey'
                  const targetLabel = TARGET_LABELS[log.target_type] || log.target_type

                  return (
                    <li key={log.id} className="relative">
                      {/* Puce sur la ligne */}
                      <span
                        className="absolute -left-8 top-3.5 w-[9px] h-[9px] rounded-full bg-white border-2 border-kraft"
                        aria-hidden="true"
                      />
                      <article className="bg-white rounded-2xl border border-[#e8dfd2] px-4 py-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TONE_CLASS[tone]}`}>
                                {ACTION_LABELS[log.action_type] || log.action_type}
                              </span>
                              <span className="text-xs text-gray-400">
                                sur {targetLabel}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-1">
                              par <span className="font-medium text-gray-900">{admin ? `${admin.first_name} ${admin.last_name}` : 'Admin inconnu'}</span>
                            </p>
                            {detailText && (
                              <p className="text-xs text-gray-500 mt-1.5 break-all">
                                {detailText}
                              </p>
                            )}
                          </div>
                          <time
                            dateTime={log.created_at}
                            className="text-xs text-gray-400 tabular-nums whitespace-nowrap flex-shrink-0"
                          >
                            {timeLabel(log.created_at)}
                          </time>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
