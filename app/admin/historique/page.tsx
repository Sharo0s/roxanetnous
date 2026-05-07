import { createClient } from '@/lib/supabase/server'

export default async function AdminHistoriquePage() {
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: logs } = await supabaseAdmin
    .from('admin_actions_log')
    .select(`
      id, action_type, target_type, target_id, details, created_at,
      users:admin_id (first_name, last_name)
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
                {logs.map((log: any) => {
                  const admin = log.users as any
                  const details = log.details as any

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
                        {details?.motif || details?.decision || details?.status || ''}
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
