import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'

export default async function AdminHistoriquePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!adminData || adminData.role !== 'admin') redirect('/')

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
    a_completer: 'Demande complement',
    consultation_justificatif: 'Consultation justificatif',
    signalement_averti: 'Avertissement',
    signalement_suspendu: 'Suspension',
    signalement_supprime: 'Suppression',
    signalement_ignore: 'Signalement ignore',
    annonce_suspendue: 'Annonce suspendue',
    annonce_publiee: 'Annonce republiee',
    annonce_archivee: 'Annonce archivee',
    avis_masque: 'Avis masque',
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-xl font-bold text-black">roxanetnous</Link>
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm text-gray-500 hover:text-black">Tableau de bord</Link>
            <span className="text-sm text-gray-600">{adminData.first_name} {adminData.last_name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Historique des actions</h2>

        {!logs || logs.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
            Aucune action enregistree.
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Admin</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Cible</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => {
                  const admin = log.users as any
                  const details = log.details as any

                  return (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
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
    </main>
  )
}
