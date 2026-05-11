import {
  getInscriptionsParMois,
  getActiviteParMois,
  getRevenusParMois,
  getMrrDetail,
  getMrrParSegmentParMois,
  getChurn,
  getDernieresAnnulations,
} from '@/lib/admin-stats'
import { DashboardTabs } from '@/components/admin/dashboard-tabs'
import {
  InscriptionsTable,
  RevenusTable,
  MrrSegmentTable,
  ActiviteTable,
  ResiliationsTable,
} from '@/components/admin/stats-tables'

export default async function AdminStatistiquesPage() {
  const [inscriptions, activite, revenus, mrrDetail, mrrSegmentParMois, churn, annulations] =
    await Promise.all([
      getInscriptionsParMois(),
      getActiviteParMois(),
      getRevenusParMois(),
      getMrrDetail(),
      getMrrParSegmentParMois(),
      getChurn(),
      getDernieresAnnulations(),
    ])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-10">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
        <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Statistiques détaillées</h1>
        <p className="text-sm text-gray-600 mt-3 max-w-2xl">
          Vue historique mensuelle. Inscriptions, revenus, churn et activité depuis le lancement.
        </p>
      </header>

      <DashboardTabs>
        {{
          inscriptions: (
            <InscriptionsTable data={inscriptions} />
          ),
          revenus: (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-[#e8dfd2] p-5">
                  <p className="text-sm text-gray-500">En essai gratuit</p>
                  <p className="italic text-3xl text-gray-900 mt-1">{mrrDetail.essaiGratuit}</p>
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <p>{mrrDetail.essaiAccompagnantes} accompagnant{mrrDetail.essaiAccompagnantes > 1 ? 's' : ''}</p>
                    <p>{mrrDetail.essaiAccompagnes} accompagné{mrrDetail.essaiAccompagnes > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-[#e8dfd2] p-5">
                  <p className="text-sm text-gray-500">Payants</p>
                  <p className="italic text-3xl text-gray-900 mt-1">{mrrDetail.payants}</p>
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <p>{mrrDetail.segments.accompagnante_mensuel.count + mrrDetail.segments.accompagnante_annuel.count} accompagnants ({mrrDetail.segments.accompagnante_mensuel.count} mens. / {mrrDetail.segments.accompagnante_annuel.count} ann.)</p>
                    <p>{mrrDetail.segments.accompagne_mensuel.count + mrrDetail.segments.accompagne_annuel.count} accompagnés ({mrrDetail.segments.accompagne_mensuel.count} mens. / {mrrDetail.segments.accompagne_annuel.count} ann.)</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-[#e8dfd2] p-5">
                  <p className="text-sm text-gray-500">Résiliations ce mois</p>
                  <p className={`italic text-3xl mt-1 ${churn.taux <= 2 ? 'text-green-700' : churn.taux <= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                    {churn.taux.toFixed(1)}%
                  </p>
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <p>{churn.annulations} annulation{churn.annulations > 1 ? 's' : ''} / {churn.abonnesDebutMois} abonné{churn.abonnesDebutMois > 1 ? 's' : ''} début de mois</p>
                    {churn.annulations > 0 && (
                      <>
                        <p>{churn.annulAccompagnantes} accompagnant{churn.annulAccompagnantes > 1 ? 's' : ''}, {churn.annulAccompagnes} accompagné{churn.annulAccompagnes > 1 ? 's' : ''}</p>
                        <p>{churn.annulMensuel} mens., {churn.annulAnnuel} ann.</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <h4 className="font-medium text-gray-700 text-sm mb-3">Revenu mensuel récurrent par segment</h4>
              <div className="mb-8">
                <MrrSegmentTable data={mrrSegmentParMois} />
              </div>

              <div className="mb-8">
                <RevenusTable data={revenus} />
              </div>

              <h4 className="font-medium text-gray-700 text-sm mb-3">Résiliations</h4>
              <ResiliationsTable data={annulations} />
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
