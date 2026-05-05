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
  const type = params.type || 'accompagnante'

  // Charger les counts des deux types en parallele
  const [auxResult, benResult] = await Promise.all([
    type === 'accompagnante'
      ? supabaseAdmin
          .from('annonces_accompagnantes')
          .select(`
            id, titre, ville, code_postal, status, created_at, published_at, vues, contacts_count,
            accompagnantes_profiles:accompagnante_id (
              users:user_id (first_name, last_name, email)
            )
          `)
          .order('created_at', { ascending: false })
      : supabaseAdmin
          .from('annonces_accompagnantes')
          .select('id', { count: 'exact', head: true }),
    type === 'accompagne'
      ? supabaseAdmin
          .from('annonces_accompagnes')
          .select(`
            id, titre, ville, code_postal, status, created_at, published_at,
            accompagnes_profiles:accompagne_id (
              users:user_id (first_name, last_name, email)
            )
          `)
          .order('created_at', { ascending: false })
      : supabaseAdmin
          .from('annonces_accompagnes')
          .select('id', { count: 'exact', head: true }),
  ])

  const rawAnnonces = (type === 'accompagnante' ? auxResult.data : benResult.data) || []
  const auxCount = type === 'accompagnante' ? rawAnnonces.length : (auxResult.count ?? 0)
  const benCount = type === 'accompagne' ? rawAnnonces.length : (benResult.count ?? 0)

  // Transformer les donnees pour le composant client
  const annonces = rawAnnonces.map((annonce: any) => {
    const profileData = type === 'accompagnante'
      ? annonce.accompagnantes_profiles
      : annonce.accompagnes_profiles
    const u = (profileData as any)?.users
    return {
      id: annonce.id,
      titre: annonce.titre,
      ville: annonce.ville,
      code_postal: annonce.code_postal,
      status: annonce.status,
      created_at: annonce.created_at,
      auteur_nom: u ? `${u.first_name} ${u.last_name}` : '',
      type: type as 'accompagnante' | 'accompagne',
    }
  })

  return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Gestion des annonces</h1>

        <div className="flex gap-2 mb-6">
          <Link
            href="/admin/annonces?type=accompagnante"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition btn-hover ${
              type === 'accompagnante' ? 'bg-accent text-black' : 'bg-white border border-gray-400 text-gray-700 hover:border-accent'
            }`}
          >
            Accompagnantes ({auxCount})
          </Link>
          <Link
            href="/admin/annonces?type=accompagne"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition btn-hover ${
              type === 'accompagne' ? 'bg-accent text-black' : 'bg-white border border-gray-400 text-gray-700 hover:border-accent'
            }`}
          >
            Accompagnés ({benCount})
          </Link>
        </div>

        <AnnoncesSearchTable annonces={annonces} type={type as 'accompagnante' | 'accompagne'} />
      </div>
  )
}
