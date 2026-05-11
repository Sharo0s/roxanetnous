import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AnnoncesSearchTable } from '@/components/admin/annonces-client'
import type { Database } from '@/types/supabase'

// Story 4.6 (D7) : cast applicatif chirurgical sur la forme retournee par
// Supabase pour reconcilier les 2 branches de l'union annonce_aux/annonce_ben.
// Tolere car (1) reflete fidelement la forme Supabase post-jointure imbriquee,
// (2) evite un narrow conditionnel verbose, (3) reflete un type concret, pas une elision.
type RawAnnonceWithProfile = {
  id: string
  titre: string
  ville: string | null
  code_postal: string | null
  status: string
  created_at: string
  accompagnantes_profiles?: { users: { first_name: string; last_name: string; email: string } | null } | null
  accompagnes_profiles?: { users: { first_name: string; last_name: string; email: string } | null } | null
}

function extractUser(
  annonce: RawAnnonceWithProfile,
  type: 'accompagnante' | 'accompagne',
): { first_name: string; last_name: string; email: string } | null {
  if (type === 'accompagnante') return annonce.accompagnantes_profiles?.users ?? null
  return annonce.accompagnes_profiles?.users ?? null
}

export default async function AdminAnnoncesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams

  // Story 4.6 (variante locale SCP) : cast localise au point d'appel.
  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>
  const type = params.type || 'accompagnante'

  // Charger les counts des deux types en parallele
  const [auxResult, benResult] = await Promise.all([
    type === 'accompagnante'
      ? supabaseAdmin
          .from('annonces_accompagnantes')
          .select(`
            id, titre, ville, code_postal, status, created_at, published_at, vues, contacts_count,
            accompagnantes_profiles:accompagnante_id (
              users!user_id (first_name, last_name, email)
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
              users!user_id (first_name, last_name, email)
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

  // Transformer les donnees pour le composant client. Cast applicatif sur
  // rawAnnonces : l'inference Supabase produit une union avec la branche
  // count head:true (forme `{ id }[]`). Le narrow vers RawAnnonceWithProfile[]
  // reflete la branche reellement utilisee (data:select fluide).
  const annonces = (rawAnnonces as RawAnnonceWithProfile[]).map((annonce) => {
    const u = extractUser(annonce, type as 'accompagnante' | 'accompagne')
    return {
      id: annonce.id,
      titre: annonce.titre,
      ville: annonce.ville ?? '',
      code_postal: annonce.code_postal,
      status: annonce.status,
      created_at: annonce.created_at,
      auteur_nom: u ? `${u.first_name} ${u.last_name}` : '',
      type: type as 'accompagnante' | 'accompagne',
    }
  })

  return (
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Gestion des annonces</h1>
        </header>

        <div className="flex gap-2 mb-6 flex-wrap">
          <Link
            href="/admin/annonces?type=accompagnante"
            className={`inline-flex items-center px-5 py-2 rounded-full text-sm font-medium transition ${
              type === 'accompagnante'
                ? 'bg-accent border border-accent text-black'
                : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
            }`}
          >
            Accompagnants ({auxCount})
          </Link>
          <Link
            href="/admin/annonces?type=accompagne"
            className={`inline-flex items-center px-5 py-2 rounded-full text-sm font-medium transition ${
              type === 'accompagne'
                ? 'bg-accent border border-accent text-black'
                : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
            }`}
          >
            Accompagnés ({benCount})
          </Link>
        </div>

        <AnnoncesSearchTable annonces={annonces} type={type as 'accompagnante' | 'accompagne'} />
      </div>
  )
}
