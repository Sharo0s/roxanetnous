import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import Link from 'next/link'
import {
  getKpis,
  getInscriptionsParMois,
  getRepartitionRoles,
  getActiviteParMois,
  getMrrDetail,
  getChurn,
  getDernieresAnnulations,
} from '@/lib/admin-stats'

function formatMois(mois: string) {
  const [year, month] = mois.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

function formatPlan(plan: string) {
  if (plan === 'annual' || plan === 'annuel') return 'Annuel'
  return 'Mensuel'
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'admin') redirect('/')

  // Recuperer les auxiliaires en attente
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: pending } = await supabaseAdmin
    .from('auxiliaires_profiles')
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

  // Stats detaillees
  const [kpis, inscriptions, repartition, activite, mrrDetail, churn, annulations] =
    await Promise.all([
      getKpis(),
      getInscriptionsParMois(),
      getRepartitionRoles(),
      getActiviteParMois(),
      getMrrDetail(),
      getChurn(),
      getDernieresAnnulations(),
    ])

  const pctAux = repartition.total > 0
    ? (repartition.auxiliaires / repartition.total) * 100
    : 0

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-black">roxanetnous</h1>
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Admin Roxanetnous
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { href: '/admin', label: 'Tableau de bord' },
            { href: '/admin/utilisateurs', label: 'Utilisateurs' },
            { href: '/admin/annonces', label: 'Annonces' },
            { href: '/admin/signalements', label: 'Signalements' },
            { href: '/admin/avis', label: 'Avis' },
            { href: '/admin/historique', label: 'Historique' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2.5 text-sm text-gray-600 hover:text-black whitespace-nowrap border-b-2 border-transparent hover:border-black transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h2>

        {/* Queue de validation */}
        <h3 className="text-lg font-semibold mb-4">Auxiliaires en attente de validation</h3>

        {!pending || pending.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500 mb-8">
            Aucun auxiliaire en attente de validation.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {pending.map((profile: any) => {
              const u = profile.users as any
              return (
                <Link
                  key={profile.id}
                  href={`/admin/validation/${profile.id}`}
                  className="block bg-white rounded-xl border p-5 hover:border-black hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
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
        )}

        {/* Signalements */}
        {(signalementsCount || 0) > 0 && (
          <Link href="/admin/signalements" className="block bg-white rounded-xl border p-5 hover:border-black hover:shadow-lg hover:-translate-y-1 transition-all duration-200 mb-8">
            <p className="text-sm text-gray-500">Signalements en attente</p>
            <p className="text-3xl font-bold mt-1">{signalementsCount}</p>
          </Link>
        )}

        {/* Section : Vue d'ensemble */}
        <section className="mb-12">
          <h3 className="text-lg font-semibold mb-4">Vue d&apos;ensemble</h3>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-500">Revenu mensuel recurrent</p>
              <p className="text-3xl font-bold mt-1">{kpis.mrr.toFixed(2)} EUR</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-500">Actifs (30j)</p>
              <p className="text-3xl font-bold mt-1">{kpis.actifs30j}</p>
              <p className="text-xs text-gray-400 mt-1">sur {kpis.totalUsers} inscrits</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-500">Conversion</p>
              <p className="text-3xl font-bold mt-1">{kpis.tauxConversion.toFixed(1)}%</p>
              <p className="text-xs text-gray-400 mt-1">{kpis.abonnesActifs} abonnes / {kpis.totalUsers}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-500">Taux de resiliation</p>
              <p className="text-3xl font-bold mt-1">{kpis.churn.toFixed(1)}%</p>
            </div>
          </div>

          {/* Inscriptions 12 derniers mois */}
          <div className="bg-white rounded-xl border overflow-hidden mb-8">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h4 className="font-medium text-gray-700 text-sm">Inscriptions (12 derniers mois)</h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Mois</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Auxiliaires</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Beneficiaires</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {inscriptions.map((row) => (
                  <tr key={row.mois} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{formatMois(row.mois)}</td>
                    <td className="px-4 py-3 text-right">{row.auxiliaires}</td>
                    <td className="px-4 py-3 text-right">{row.beneficiaires}</td>
                    <td className="px-4 py-3 text-right font-medium">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Repartition auxiliaires / beneficiaires */}
          <div className="bg-white rounded-xl border p-5 mb-8">
            <h4 className="font-medium text-gray-700 text-sm mb-3">Repartition des utilisateurs</h4>
            <div className="flex items-center gap-4 mb-2">
              <span className="text-sm text-gray-600 w-28">Auxiliaires</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-black h-full rounded-full"
                  style={{ width: `${pctAux}%` }}
                />
              </div>
              <span className="text-sm font-medium w-20 text-right">{repartition.auxiliaires} ({pctAux.toFixed(0)}%)</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 w-28">Beneficiaires</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gray-400 h-full rounded-full"
                  style={{ width: `${100 - pctAux}%` }}
                />
              </div>
              <span className="text-sm font-medium w-20 text-right">{repartition.beneficiaires} ({(100 - pctAux).toFixed(0)}%)</span>
            </div>
          </div>

          {/* Activite 6 derniers mois */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h4 className="font-medium text-gray-700 text-sm">Activite (6 derniers mois)</h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Mois</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Messages</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Conversations</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Avis</th>
                </tr>
              </thead>
              <tbody>
                {activite.map((row) => (
                  <tr key={row.mois} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{formatMois(row.mois)}</td>
                    <td className="px-4 py-3 text-right">{row.messages}</td>
                    <td className="px-4 py-3 text-right">{row.conversations}</td>
                    <td className="px-4 py-3 text-right">{row.avis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section : Details revenus */}
        <section>
          <h3 className="text-lg font-semibold mb-4">Details revenus</h3>

          {/* MRR par segment */}
          <div className="bg-white rounded-xl border overflow-hidden mb-8">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h4 className="font-medium text-gray-700 text-sm">Revenu mensuel recurrent par segment</h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Segment</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Abonnes</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Revenu mensuel</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">Auxiliaire - Mensuel</td>
                  <td className="px-4 py-3 text-right">{mrrDetail.segments.auxiliaire_mensuel.count}</td>
                  <td className="px-4 py-3 text-right font-medium">{mrrDetail.segments.auxiliaire_mensuel.mrr.toFixed(2)} EUR</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">Auxiliaire - Annuel</td>
                  <td className="px-4 py-3 text-right">{mrrDetail.segments.auxiliaire_annuel.count}</td>
                  <td className="px-4 py-3 text-right font-medium">{mrrDetail.segments.auxiliaire_annuel.mrr.toFixed(2)} EUR</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">Beneficiaire - Mensuel</td>
                  <td className="px-4 py-3 text-right">{mrrDetail.segments.beneficiaire_mensuel.count}</td>
                  <td className="px-4 py-3 text-right font-medium">{mrrDetail.segments.beneficiaire_mensuel.mrr.toFixed(2)} EUR</td>
                </tr>
                <tr className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">Beneficiaire - Annuel</td>
                  <td className="px-4 py-3 text-right">{mrrDetail.segments.beneficiaire_annuel.count}</td>
                  <td className="px-4 py-3 text-right font-medium">{mrrDetail.segments.beneficiaire_annuel.mrr.toFixed(2)} EUR</td>
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
              <p className="text-3xl font-bold mt-1">{churn.taux.toFixed(1)}%</p>
              <p className="text-xs text-gray-400 mt-1">
                {churn.annulations} annulation{churn.annulations > 1 ? 's' : ''} / {churn.abonnesDebutMois} debut de mois
              </p>
            </div>
          </div>

          {/* Dernieres annulations */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h4 className="font-medium text-gray-700 text-sm">Dernieres resiliations</h4>
            </div>
            {annulations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                Aucune annulation.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
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
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
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
        </section>
      </div>
    </main>
  )
}
