import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AnnoncesSearchTable } from '@/components/admin/annonces-client'

export default async function AdminAnnoncesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams

  const supabaseAdmin = await createClient({ serviceRole: true })
  const type = params.type || 'auxiliaire'

  // Charger les counts des deux types en parallele
  const [auxResult, benResult] = await Promise.all([
    type === 'auxiliaire'
      ? supabaseAdmin
          .from('annonces_auxiliaires')
          .select(`
            id, titre, ville, code_postal, status, created_at, published_at, vues, contacts_count,
            auxiliaires_profiles:auxiliaire_id (
              users:user_id (first_name, last_name, email)
            )
          `)
          .order('created_at', { ascending: false })
      : supabaseAdmin
          .from('annonces_auxiliaires')
          .select('id', { count: 'exact', head: true }),
    type === 'beneficiaire'
      ? supabaseAdmin
          .from('annonces_beneficiaires')
          .select(`
            id, titre, ville, code_postal, status, created_at, published_at,
            beneficiaires_profiles:beneficiaire_id (
              users:user_id (first_name, last_name, email)
            )
          `)
          .order('created_at', { ascending: false })
      : supabaseAdmin
          .from('annonces_beneficiaires')
          .select('id', { count: 'exact', head: true }),
  ])

  const rawAnnonces = (type === 'auxiliaire' ? auxResult.data : benResult.data) || []
  const auxCount = type === 'auxiliaire' ? rawAnnonces.length : (auxResult.count ?? 0)
  const benCount = type === 'beneficiaire' ? rawAnnonces.length : (benResult.count ?? 0)

  // Transformer les donnees pour le composant client
  const annonces = rawAnnonces.map((annonce: any) => {
    const profileData = type === 'auxiliaire'
      ? annonce.auxiliaires_profiles
      : annonce.beneficiaires_profiles
    const u = (profileData as any)?.users
    return {
      id: annonce.id,
      titre: annonce.titre,
      ville: annonce.ville,
      code_postal: annonce.code_postal,
      status: annonce.status,
      created_at: annonce.created_at,
      auteur_nom: u ? `${u.first_name} ${u.last_name}` : '',
      type: type as 'auxiliaire' | 'beneficiaire',
    }
  })

  return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Gestion des annonces</h2>

        <div className="flex gap-2 mb-6">
          <Link
            href="/admin/annonces?type=auxiliaire"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition btn-hover ${
              type === 'auxiliaire' ? 'bg-accent text-black' : 'bg-white border border-gray-300 text-gray-700 hover:border-accent'
            }`}
          >
            Auxiliaires ({auxCount})
          </Link>
          <Link
            href="/admin/annonces?type=beneficiaire"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition btn-hover ${
              type === 'beneficiaire' ? 'bg-accent text-black' : 'bg-white border border-gray-300 text-gray-700 hover:border-accent'
            }`}
          >
            Beneficiaires ({benCount})
          </Link>
        </div>

        <AnnoncesSearchTable annonces={annonces} type={type as 'auxiliaire' | 'beneficiaire'} />
      </div>
  )
}
