'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleFavori(
  annonceId: string,
  type: 'accompagnante' | 'accompagne'
): Promise<{ error?: string; isFavori?: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  // Story 5.A.2 (D4) : colonnes renommees accompagnant_id, table conservee accompagnantes (D3).
  const field = type === 'accompagnante' ? 'annonce_accompagnant_id' : 'annonce_accompagne_id'

  // Verifier si deja en favori
  const { data: existing } = await supabase
    .from('favoris')
    .select('id')
    .eq('user_id', user.id)
    .eq(field, annonceId)
    .single()

  if (existing) {
    // Retirer le favori
    const { error } = await supabase
      .from('favoris')
      .delete()
      .eq('id', existing.id)

    if (error) return { error: 'Erreur lors de la suppression du favori.' }

    revalidatePath('/favoris')
    return { isFavori: false }
  }

  // Ajouter le favori
  const insertData: Record<string, string> = {
    user_id: user.id,
    [field]: annonceId,
  }

  const { error } = await supabase
    .from('favoris')
    .insert(insertData)

  if (error) return { error: 'Erreur lors de l\'ajout du favori.' }

  // Mettre a jour le compteur sur l'annonce accompagnante
  if (type === 'accompagnante') {
    await supabase
      .from('annonces_accompagnants')
      .update({ favoris_count: (await supabase.from('favoris').select('id', { count: 'exact', head: true }).eq('annonce_accompagnant_id', annonceId)).count || 0 })
      .eq('id', annonceId)
  }

  revalidatePath('/favoris')
  return { isFavori: true }
}
