import { createClient } from '@/lib/supabase/server'

export default async function AdminUtilisateursPage() {
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name, last_name, role, created_at')
    .neq('role', 'admin')
    .order('created_at', { ascending: false })

  // Compter par role
  const auxCount = users?.filter((u) => u.role === 'auxiliaire').length || 0
  const benCount = users?.filter((u) => u.role === 'beneficiaire').length || 0

  return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Utilisateurs</h2>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Auxiliaires</p>
            <p className="text-3xl font-bold mt-1">{auxCount}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Beneficiaires</p>
            <p className="text-3xl font-bold mt-1">{benCount}</p>
          </div>
        </div>

        {!users || users.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
            Aucun utilisateur.
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Inscription</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.first_name} {u.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-gray-800 text-white'
                          : u.role === 'auxiliaire'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
  )
}
