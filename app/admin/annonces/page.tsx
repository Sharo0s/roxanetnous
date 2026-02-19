import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AdminAnnonceActions } from '@/components/admin/annonce-actions'

export default async function AdminAnnoncesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams

  const supabaseAdmin = await createClient({ serviceRole: true })
  const type = params.type || 'auxiliaire'

  let annonces: any[] = []

  if (type === 'auxiliaire') {
    const { data } = await supabaseAdmin
      .from('annonces_auxiliaires')
      .select(`
        id, titre, ville, code_postal, status, created_at, published_at, vues, contacts_count,
        auxiliaires_profiles:auxiliaire_id (
          users:user_id (first_name, last_name, email)
        )
      `)
      .order('created_at', { ascending: false })
    annonces = data || []
  } else {
    const { data } = await supabaseAdmin
      .from('annonces_beneficiaires')
      .select(`
        id, titre, ville, code_postal, status, created_at, published_at,
        beneficiaires_profiles:beneficiaire_id (
          users:user_id (first_name, last_name, email)
        )
      `)
      .order('created_at', { ascending: false })
    annonces = data || []
  }

  return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Gestion des annonces</h2>

        <div className="flex gap-2 mb-6">
          <Link
            href="/admin/annonces?type=auxiliaire"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              type === 'auxiliaire' ? 'bg-black text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-black'
            }`}
          >
            Auxiliaires ({type === 'auxiliaire' ? annonces.length : '...'})
          </Link>
          <Link
            href="/admin/annonces?type=beneficiaire"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              type === 'beneficiaire' ? 'bg-black text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-black'
            }`}
          >
            Beneficiaires ({type === 'beneficiaire' ? annonces.length : '...'})
          </Link>
        </div>

        {annonces.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
            Aucune annonce.
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Auteur</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ville</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {annonces.map((annonce: any) => {
                  const profileData = type === 'auxiliaire'
                    ? annonce.auxiliaires_profiles
                    : annonce.beneficiaires_profiles
                  const u = (profileData as any)?.users

                  return (
                    <tr key={annonce.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 line-clamp-1">{annonce.titre}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {u?.first_name} {u?.last_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {annonce.ville} {annonce.code_postal && `(${annonce.code_postal})`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          annonce.status === 'publiee' ? 'bg-black text-white' :
                          annonce.status === 'suspendue' ? 'bg-red-100 text-red-700' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {annonce.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(annonce.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AdminAnnonceActions
                          annonceId={annonce.id}
                          currentStatus={annonce.status}
                          type={type as 'auxiliaire' | 'beneficiaire'}
                        />
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
