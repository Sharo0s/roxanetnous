import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Database } from '@/types/supabase'
import {
  getKpis,
  getRepartitionRoles,
  getActiviteMois,
  getWaitlistStats,
  getParrainagesStats,
  getDerniereActionAdmin,
} from '@/lib/admin-stats'

function formatEur(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
}

function joursDepuis(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function ageLabel(iso: string): string {
  const j = joursDepuis(iso)
  if (j === 0) return "aujourd'hui"
  if (j === 1) return 'hier'
  return `il y a ${j} j`
}

function derniereActionLabel(iso: string | null): string {
  if (!iso) return 'aucune action récente'
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  const jours = Math.floor(heures / 24)
  return `il y a ${jours} j`
}

const STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  visio_a_planifier: 'Visio à planifier',
  visio_realisee: 'Visio réalisée',
}

const STATUS_PILL: Record<string, string> = {
  en_attente: 'bg-gray-100 text-gray-700',
  visio_a_planifier: 'bg-blue-50 text-blue-800 border border-blue-200',
  visio_realisee: 'bg-amber-50 text-amber-800 border border-amber-200',
}

export default async function AdminDashboard() {
  // Story 4.6 (variante locale SCP) : cast localisé au point d'appel.
  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  const [pendingResult, signalementsResult, visiosResult, incompletsResult, kpis, repartition, activiteMois, waitlist, parrainages, derniereAction] =
    await Promise.all([
      supabaseAdmin
        .from('accompagnants_profiles')
        .select(`
          id,
          ville,
          code_postal,
          diplomes,
          experience,
          validation_status,
          created_at,
          user_id,
          users!user_id (first_name, last_name, email)
        `)
        .in('validation_status', ['en_attente', 'visio_a_planifier', 'visio_realisee'])
        .order('created_at', { ascending: true })
        .limit(3),
      supabaseAdmin
        .from('signalements')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'en_attente'),
      supabaseAdmin
        .from('accompagnants_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('validation_status', 'visio_a_planifier'),
      supabaseAdmin
        .from('accompagnants_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('validation_status', 'a_completer'),
      getKpis(),
      getRepartitionRoles(),
      getActiviteMois(),
      getWaitlistStats(),
      getParrainagesStats(),
      getDerniereActionAdmin(),
    ])

  const pending = pendingResult.data || []
  const signalementsCount = signalementsResult.count || 0
  const visiosCount = visiosResult.count || 0
  const incompletsCount = incompletsResult.count || 0

  const pctAux = repartition.total > 0
    ? (repartition.accompagnantes / repartition.total) * 100
    : 0
  const pctBen = 100 - pctAux

  const churnColor =
    kpis.churn <= 2 ? 'text-green-700' : kpis.churn <= 5 ? 'text-amber-600' : 'text-red-600'
  const conversionColor =
    kpis.tauxConversion >= 80 ? 'text-green-700' : kpis.tauxConversion >= 50 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">

      {/* HEADER ÉDITORIAL */}
      <header className="mb-10 max-w-2xl">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
        <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Tableau de bord</h1>
        <p className="text-sm text-gray-600 mt-3">
          À gauche, ce qui demande une décision. À droite, l&apos;état de RoxanetNous. Tout est cliquable.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-8">

        {/* COLONNE GAUCHE — À TRAITER */}
        <section aria-labelledby="col-a-traiter">
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <h2 id="col-a-traiter" className="text-xl italic text-gray-900">À traiter</h2>
            <span className="text-[11px] uppercase tracking-[0.18em] text-kraft font-medium">File d&apos;action</span>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Les profils les plus anciens en premier.
          </p>

          {pending.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e8dfd2] px-5 py-4 text-sm text-gray-500 italic mb-3">
              Aucun accompagnant en attente de validation.
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {pending.map((profile, idx) => {
                const u = profile.users
                const nom = u ? `${u.first_name} ${u.last_name}` : 'Profil sans nom'
                const priority = idx === 0
                return (
                  <Link
                    key={profile.id}
                    href={`/admin/utilisateurs/${profile.user_id}`}
                    className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 ${
                      priority
                        ? 'border-kraft bg-[#f3ebde] hover:border-[#a8714f]'
                        : 'bg-white border-[#e8dfd2] hover:border-kraft'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{nom}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_PILL[profile.validation_status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[profile.validation_status] || profile.validation_status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {profile.ville} ({profile.code_postal}) · {(profile.diplomes as string[] | null || []).join(', ') || '—'} · {profile.experience || '—'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Arrivé {ageLabel(profile.created_at)}
                        </p>
                      </div>
                      <span className="italic text-2xl text-kraft leading-none flex-shrink-0 tabular-nums" aria-hidden="true">
                        {idx + 1}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="mt-4 space-y-2">
            {signalementsCount > 0 && (
              <SectionCard
                href="/admin/signalements"
                label="Signalements ouverts"
                meta="aucun grave"
                value={signalementsCount}
                accent
              />
            )}

            {waitlist.total > 0 && (
              <SectionCard
                href="/admin/inscrits-hors-zone"
                label="Inscrits hors zone"
                meta={waitlist.top3.length > 0
                  ? `top : ${waitlist.top3.map((d) => `${d.code} (${d.count})`).join(' · ')}`
                  : 'inscriptions en attente d\'ouverture'}
                value={waitlist.total}
              />
            )}

            {parrainages.flagActifs > 0 && (
              <SectionCard
                href="/admin/parrainages?flag=1"
                label="Parrainages — fraude potentielle"
                meta={`${parrainages.blacklist} blacklist${parrainages.blacklist > 1 ? 's' : ''} · ${parrainages.flagActifs} flag${parrainages.flagActifs > 1 ? 's' : ''} actif${parrainages.flagActifs > 1 ? 's' : ''}`}
                value={parrainages.flagActifs}
                accent
              />
            )}

            {visiosCount > 0 && (
              <SectionCard
                href="/admin/utilisateurs"
                label="Visios à planifier"
                meta="accompagnants en attente de créneau"
                value={visiosCount}
              />
            )}
          </div>
        </section>

        {/* COLONNE DROITE — PILOTAGE */}
        <section aria-labelledby="col-pilotage">
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <h2 id="col-pilotage" className="text-xl italic text-gray-900">Pilotage</h2>
            <span className="text-[11px] uppercase tracking-[0.18em] text-kraft font-medium">L&apos;état de Roxanetnous</span>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Chaque chiffre ouvre sa page de détail.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <KpiCard
              href="/admin/statistiques"
              label="Revenu mensuel récurrent"
              value={formatEur(kpis.mrr)}
              hint={`${kpis.abonnesActifs} abonné${kpis.abonnesActifs > 1 ? 's' : ''}`}
            />
            <KpiCard
              href="/admin/statistiques"
              label="Conversion inscrits → abonnés"
              value={`${kpis.tauxConversion.toFixed(1)} %`}
              valueClass={conversionColor}
              hint={`${kpis.abonnesActifs} / ${kpis.totalUsers}`}
            />
            <KpiCard
              href="/admin/statistiques"
              label="Taux de résiliation (ce mois)"
              value={`${kpis.churn.toFixed(1)} %`}
              valueClass={churnColor}
              hint={`${kpis.churnAnnulations} annul. / ${kpis.churnAbonnesDebutMois} début mois`}
            />
            <KpiCard
              href="/admin/utilisateurs"
              label="Utilisateurs actifs (30 j)"
              value={String(kpis.actifs30j)}
              hint={`${kpis.totalUsers > 0 ? Math.round((kpis.actifs30j / kpis.totalUsers) * 100) : 0} % des inscrits`}
            />
          </div>

          {/* Répartition */}
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-5 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Répartition des utilisateurs · {repartition.total.toLocaleString('fr-FR')} au total
            </h3>
            <div className="grid grid-cols-[110px_1fr_90px] items-center gap-3 text-sm mb-2">
              <span className="text-gray-600">Accompagnants</span>
              <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="bg-accent h-full rounded-full" style={{ width: `${pctAux}%` }} aria-hidden="true" />
              </div>
              <span className="text-right tabular-nums">{repartition.accompagnantes} · {pctAux.toFixed(0)} %</span>
            </div>
            <div className="grid grid-cols-[110px_1fr_90px] items-center gap-3 text-sm">
              <span className="text-gray-600">Accompagnés</span>
              <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="bg-gray-400 h-full rounded-full" style={{ width: `${pctBen}%` }} aria-hidden="true" />
              </div>
              <span className="text-right tabular-nums">{repartition.accompagnes} · {pctBen.toFixed(0)} %</span>
            </div>
            {incompletsCount > 0 && (
              <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-[#f3ebde]">
                Dont <span className="tabular-nums">{incompletsCount}</span> profil{incompletsCount > 1 ? 's' : ''} accompagnant{incompletsCount > 1 ? 's' : ''} incomplet{incompletsCount > 1 ? 's' : ''} (onboarding non finalisé).
              </p>
            )}
          </div>

          {/* Cartes navigation */}
          <nav aria-label="Sections du tableau de bord" className="space-y-2">
            <NavCard
              href="/admin/messages"
              title="Activité du mois"
              meta={`${activiteMois.messages.toLocaleString('fr-FR')} messages · ${activiteMois.conversations} nouvelle${activiteMois.conversations > 1 ? 's' : ''} conversation${activiteMois.conversations > 1 ? 's' : ''}`}
            />
            <NavCard
              href="/admin/annonces"
              title="Annonces publiées"
              meta="liste complète, modération et recherche"
            />
            <NavCard
              href="/admin/departements"
              title="Couverture géographique"
              meta="ouvrir et fermer les départements"
            />
            <NavCard
              href="/admin/inscrits-hors-zone"
              title="Inscrits hors zone"
              meta="personnes en attente d'ouverture, par département"
            />
            <NavCard
              href="/admin/parrainages"
              title="Programme de parrainage"
              meta={`${parrainages.aboutis} abouti${parrainages.aboutis > 1 ? 's' : ''} · ${parrainages.enCours} en cours`}
            />
            <NavCard
              href="/admin/statistiques"
              title="Statistiques détaillées"
              meta="inscriptions, revenus, churn et activité par mois"
            />
            <NavCard
              href="/admin/historique"
              title="Historique des actions"
              meta={`dernière action ${derniereActionLabel(derniereAction)}`}
            />
          </nav>
        </section>

      </div>
    </div>
  )
}

function SectionCard({
  href,
  label,
  meta,
  value,
  accent = false,
}: {
  href: string
  label: string
  meta: string
  value: number
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${
        accent
          ? 'border-kraft bg-[#f3ebde] hover:border-[#a8714f]'
          : 'bg-white border-[#e8dfd2] hover:border-kraft'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{meta}</p>
      </div>
      <span className={`italic text-2xl tabular-nums flex-shrink-0 ${accent ? 'text-[#a8714f]' : 'text-gray-900'}`}>
        {value}
      </span>
    </Link>
  )
}

function KpiCard({
  href,
  label,
  value,
  valueClass,
  hint,
}: {
  href: string
  label: string
  value: string
  valueClass?: string
  hint?: string
}) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-2xl border border-[#e8dfd2] p-4 transition hover:border-kraft hover:-translate-y-0.5"
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`italic text-2xl mt-1 leading-tight tabular-nums ${valueClass || 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </Link>
  )
}

function NavCard({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-[#e8dfd2] p-4 transition hover:border-kraft hover:-translate-y-0.5"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{meta}</p>
      </div>
      <span className="italic text-xl text-gray-300 flex-shrink-0" aria-hidden="true">&rsaquo;</span>
    </Link>
  )
}
