import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  getKpis,
  getInscriptionsParMois,
  getRepartitionRoles,
  getActiviteParMois,
  getRevenusParMois,
  getMrrDetail,
  getChurn,
  getDernieresAnnulations,
} from '@/lib/admin-stats'
import { DashboardTabs } from '@/components/admin/dashboard-tabs'
import { InscriptionsTable, RevenusTable, ActiviteTable } from '@/components/admin/stats-tables'

function formatEur(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
}

function formatPlan(plan: string) {
  if (plan === 'annual' || plan === 'annuel') return 'Annuel'
  return 'Mensuel'
}

const FEEDBACK_LABELS: Record<string, string> = {
  customer_service: 'Service client',
  low_quality: 'Qualite insuffisante',
  missing_features: 'Fonctionnalites manquantes',
  switched_service: 'Passe a un concurrent',
  too_complex: 'Trop complexe',
  too_expensive: 'Trop cher',
  unused: 'Non utilise',
  other: 'Autre',
}

function formatFeedback(feedback: string | null) {
  if (!feedback) return '-'
  return FEEDBACK_LABELS[feedback] || feedback
}

export default async function AdminDashboard() {
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: pending } = await supabaseAdmin
    .from('accompagnantes_profiles')
    .select(`
      id,
      diplomes,
      experience,
      specialites,
      ville,
      code_postal,
      validation_status,
      created_at,
      user_id,
      users:user_id (first_name, last_name, email)
    `)
    .eq('validation_status', 'en_attente')
    .order('created_at', { ascending: true })

  const { count: signalementsCount } = await supabaseAdmin
    .from('signalements')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'en_attente')

  const [kpis, inscriptions, repartition, activite, revenus, mrrDetail, churn, annulations] =
    await Promise.all([
      getKpis(),
      getInscriptionsParMois(),
      getRepartitionRoles(),
      getActiviteParMois(),
      getRevenusParMois(),
      getMrrDetail(),
      getChurn(),
      getDernieresAnnulations(),
    ])

  const pctAux = repartition.total > 0
    ? (repartition.accompagnantes / repartition.total) * 100
    : 0

  const moisEnCours = activite.length > 0 ? activite[activite.length - 1] : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h2>

      {/* Queue de validation - compact quand vide */}
      {!pending || pending.length === 0 ? (
        <div className="bg-white rounded-lg border px-4 py-3 text-sm text-gray-500 mb-6">
          Aucune accompagnante en attente de validation.
        </div>
      ) : (
        <>
          <h3 className="text-lg font-semibold mb-4">Accompagnantes en attente de validation</h3>
          <div className="space-y-3 mb-8">
            {pending.map((profile: any) => {
              const u = profile.users as any
              return (
                <Link
                  key={profile.id}
                  href={`/admin/validation/${profile.id}`}
                  className="block bg-white rounded-xl border p-5 hover:border-accent hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {u?.first_name} {u?.last_name}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {u?.email}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {profile.ville} ({profile.code_postal}) — {(profile.diplomes as string[] || []).join(', ')} — {profile.experience}
                      </p>
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(profile.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {/* Signalements */}
      {(signalementsCount || 0) > 0 && (
        <Link href="/admin/signalements" className="block bg-white rounded-xl border p-5 hover:border-accent hover:shadow-lg hover:-translate-y-1 transition-all duration-200 mb-8">
          <p className="text-sm text-gray-500">Signalements en attente</p>
          <p className="text-3xl font-bold mt-1">{signalementsCount}</p>
        </Link>
      )}

      {/* Onglets */}
      <DashboardTabs>
        {{
          overview: (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">Revenu mensuel recurrent</p>
                  <p className="text-3xl font-bold mt-1">{formatEur(kpis.mrr)}</p>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">Utilisateurs actifs (30 derniers jours)</p>
                  <p className="text-3xl font-bold mt-1">{kpis.actifs30j}</p>
                  <p className="text-xs text-gray-400 mt-1">sur {kpis.totalUsers} inscrits au total</p>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">Taux de conversion (inscrits vers abonnes)</p>
                  <p className={`text-3xl font-bold mt-1 ${kpis.tauxConversion >= 80 ? 'text-green-700' : kpis.tauxConversion >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {kpis.tauxConversion.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{kpis.abonnesActifs} abonnes sur {kpis.totalUsers} inscrits</p>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">Taux de resiliation (ce mois)</p>
                  <p className={`text-3xl font-bold mt-1 ${kpis.churn <= 2 ? 'text-green-700' : kpis.churn <= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                    {kpis.churn.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {kpis.churnAnnulations} annulation{kpis.churnAnnulations > 1 ? 's' : ''} / {kpis.churnAbonnesDebutMois} abonne{kpis.churnAbonnesDebutMois > 1 ? 's' : ''} en debut de mois
                  </p>
                </div>
              </div>

              {/* Repartition utilisateurs */}
              <div className="bg-white rounded-xl border p-5 mb-8">
                <h4 className="font-medium text-gray-700 text-sm mb-3">Repartition des utilisateurs</h4>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-sm text-gray-600 w-28">Accompagnantes</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-accent h-full rounded-full"
                      style={{ width: `${pctAux}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-20 text-right">{repartition.accompagnantes} ({pctAux.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 w-28">Accompagnes</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-gray-400 h-full rounded-full"
                      style={{ width: `${100 - pctAux}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-20 text-right">{repartition.accompagnes} ({(100 - pctAux).toFixed(0)}%)</span>
                </div>
              </div>

              {/* Activite du mois en cours */}
              {moisEnCours && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border p-5">
                    <p className="text-sm text-gray-500">Messages envoyes ce mois</p>
                    <p className="text-3xl font-bold mt-1">{moisEnCours.messages}</p>
                  </div>
                  <div className="bg-white rounded-xl border p-5">
                    <p className="text-sm text-gray-500">Nouvelles conversations ce mois</p>
                    <p className="text-3xl font-bold mt-1">{moisEnCours.conversations}</p>
                  </div>
                  <div className="bg-white rounded-xl border p-5">
                    <p className="text-sm text-gray-500">Avis deposes ce mois</p>
                    <p className="text-3xl font-bold mt-1">{moisEnCours.avis}</p>
                  </div>
                </div>
              )}
            </>
          ),

          inscriptions: (
            <InscriptionsTable data={inscriptions} />
          ),

          revenus: (
            <>
              {/* Essai gratuit vs Payants + Churn */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">En essai gratuit</p>
                  <p className="text-3xl font-bold mt-1">{mrrDetail.essaiGratuit}</p>
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <p>{mrrDetail.essaiAccompagnantes} accompagnante{mrrDetail.essaiAccompagnantes > 1 ? 's' : ''}</p>
                    <p>{mrrDetail.essaiAccompagnes} accompagne{mrrDetail.essaiAccompagnes > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">Payants</p>
                  <p className="text-3xl font-bold mt-1">{mrrDetail.payants}</p>
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <p>{mrrDetail.segments.accompagnante_mensuel.count + mrrDetail.segments.accompagnante_annuel.count} accompagnantes ({mrrDetail.segments.accompagnante_mensuel.count} mens. / {mrrDetail.segments.accompagnante_annuel.count} ann.)</p>
                    <p>{mrrDetail.segments.accompagne_mensuel.count + mrrDetail.segments.accompagne_annuel.count} accompagnes ({mrrDetail.segments.accompagne_mensuel.count} mens. / {mrrDetail.segments.accompagne_annuel.count} ann.)</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">Resiliations ce mois</p>
                  <p className={`text-3xl font-bold mt-1 ${churn.taux <= 2 ? 'text-green-700' : churn.taux <= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                    {churn.taux.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {churn.annulations} annulation{churn.annulations > 1 ? 's' : ''} / {churn.abonnesDebutMois} debut de mois
                  </p>
                </div>
              </div>

              {/* MRR par segment */}
              <div className="bg-white rounded-xl border overflow-hidden mb-8">
                <div className="px-4 py-3 border-b bg-accent/20">
                  <h4 className="font-medium text-gray-700 text-sm">Revenu mensuel recurrent par segment</h4>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-accent/20 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Segment</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Abonnes</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Revenu mensuel</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-accent/10">
                      <td className="px-4 py-3">Accompagnante - Mensuel</td>
                      <td className="px-4 py-3 text-right">{mrrDetail.segments.accompagnante_mensuel.count}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatEur(mrrDetail.segments.accompagnante_mensuel.mrr)}</td>
                    </tr>
                    <tr className="border-b hover:bg-accent/10">
                      <td className="px-4 py-3">Accompagnante - Annuel</td>
                      <td className="px-4 py-3 text-right">{mrrDetail.segments.accompagnante_annuel.count}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatEur(mrrDetail.segments.accompagnante_annuel.mrr)}</td>
                    </tr>
                    <tr className="border-b hover:bg-accent/10">
                      <td className="px-4 py-3">Accompagne - Mensuel</td>
                      <td className="px-4 py-3 text-right">{mrrDetail.segments.accompagne_mensuel.count}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatEur(mrrDetail.segments.accompagne_mensuel.mrr)}</td>
                    </tr>
                    <tr className="border-b last:border-0 hover:bg-accent/10">
                      <td className="px-4 py-3">Accompagne - Annuel</td>
                      <td className="px-4 py-3 text-right">{mrrDetail.segments.accompagne_annuel.count}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatEur(mrrDetail.segments.accompagne_annuel.mrr)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mb-8">
                <RevenusTable data={revenus} />
              </div>

              {/* Dernieres annulations */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b bg-accent/20">
                  <h4 className="font-medium text-gray-700 text-sm">Dernieres resiliations</h4>
                </div>
                {annulations.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Aucune annulation.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-accent/20 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Raison</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Commentaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annulations.map((a, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-accent/10">
                          <td className="px-4 py-3">
                            {a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '-'}
                          </td>
                          <td className="px-4 py-3 font-medium">{a.nom}</td>
                          <td className="px-4 py-3 text-gray-500">{a.email}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                              {a.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">{formatPlan(a.plan)}</td>
                          <td className="px-4 py-3 text-gray-500">{formatFeedback(a.feedback)}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-48 truncate">{a.comment || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ),

          activite: (
            <ActiviteTable data={activite} />
          ),
        }}
      </DashboardTabs>
    </div>
  )
}
