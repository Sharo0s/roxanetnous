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

function formatMois(mois: string) {
  const [year, month] = mois.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

function formatEur(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
}

function formatPlan(plan: string) {
  if (plan === 'annual' || plan === 'annuel') return 'Annuel'
  return 'Mensuel'
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

  const inscriptionsRecentes = inscriptions
  const activiteRecente = activite

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
                  <p className="text-sm text-gray-500">Actifs (30j)</p>
                  <p className="text-3xl font-bold mt-1">{kpis.actifs30j}</p>
                  <p className="text-xs text-gray-400 mt-1">sur {kpis.totalUsers} inscrits</p>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">Conversion</p>
                  <p className={`text-3xl font-bold mt-1 ${kpis.tauxConversion >= 80 ? 'text-green-700' : kpis.tauxConversion >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {kpis.tauxConversion.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{kpis.abonnesActifs} abonnes / {kpis.totalUsers}</p>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">Taux de resiliation</p>
                  <p className={`text-3xl font-bold mt-1 ${kpis.churn <= 2 ? 'text-green-700' : kpis.churn <= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                    {kpis.churn.toFixed(1)}%
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
                    <p className="text-sm text-gray-500">Messages ce mois</p>
                    <p className="text-3xl font-bold mt-1">{moisEnCours.messages}</p>
                  </div>
                  <div className="bg-white rounded-xl border p-5">
                    <p className="text-sm text-gray-500">Conversations ce mois</p>
                    <p className="text-3xl font-bold mt-1">{moisEnCours.conversations}</p>
                  </div>
                  <div className="bg-white rounded-xl border p-5">
                    <p className="text-sm text-gray-500">Avis ce mois</p>
                    <p className="text-3xl font-bold mt-1">{moisEnCours.avis}</p>
                  </div>
                </div>
              )}
            </>
          ),

          inscriptions: (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-accent/20">
                <h4 className="font-medium text-gray-700 text-sm">Inscriptions (12 derniers mois)</h4>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-accent/20 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Mois</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Accompagnantes</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Accompagnes</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inscriptionsRecentes.map((row) => {
                    const isZero = row.total === 0
                    return (
                      <tr key={row.mois} className={`border-b last:border-0 hover:bg-accent/10 ${isZero ? 'text-gray-300' : ''}`}>
                        <td className={`px-4 py-3 ${isZero ? '' : 'font-medium'}`}>{formatMois(row.mois)}</td>
                        <td className="px-4 py-3 text-right">{row.accompagnantes}</td>
                        <td className="px-4 py-3 text-right">{row.accompagnes}</td>
                        <td className={`px-4 py-3 text-right ${isZero ? '' : 'font-medium'}`}>{row.total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ),

          revenus: (
            <>
              {/* Historique revenus 12 mois */}
              <div className="bg-white rounded-xl border overflow-hidden mb-8">
                <div className="px-4 py-3 border-b bg-accent/20">
                  <h4 className="font-medium text-gray-700 text-sm">Revenus (12 derniers mois)</h4>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-accent/20 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Mois</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Abonnes</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenus.map((row) => {
                      const isZero = row.abonnes === 0
                      return (
                        <tr key={row.mois} className={`border-b last:border-0 hover:bg-accent/10 ${isZero ? 'text-gray-300' : ''}`}>
                          <td className={`px-4 py-3 ${isZero ? '' : 'font-medium'}`}>{formatMois(row.mois)}</td>
                          <td className="px-4 py-3 text-right">{row.abonnes}</td>
                          <td className={`px-4 py-3 text-right ${isZero ? '' : 'font-medium'}`}>{formatEur(row.mrr)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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

              {/* Essai gratuit vs Payants + Churn */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">En essai gratuit</p>
                  <p className="text-3xl font-bold mt-1">{mrrDetail.essaiGratuit}</p>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <p className="text-sm text-gray-500">Payants</p>
                  <p className="text-3xl font-bold mt-1">{mrrDetail.payants}</p>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ),

          activite: (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-accent/20">
                <h4 className="font-medium text-gray-700 text-sm">Activite (12 derniers mois)</h4>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-accent/20 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Mois</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Messages</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Conversations</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Avis</th>
                  </tr>
                </thead>
                <tbody>
                  {activiteRecente.map((row) => {
                    const isZero = row.messages === 0 && row.conversations === 0 && row.avis === 0
                    return (
                      <tr key={row.mois} className={`border-b last:border-0 hover:bg-accent/10 ${isZero ? 'text-gray-300' : ''}`}>
                        <td className={`px-4 py-3 ${isZero ? '' : 'font-medium'}`}>{formatMois(row.mois)}</td>
                        <td className="px-4 py-3 text-right">{row.messages}</td>
                        <td className="px-4 py-3 text-right">{row.conversations}</td>
                        <td className="px-4 py-3 text-right">{row.avis}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ),
        }}
      </DashboardTabs>
    </div>
  )
}
