'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type AvisResult = {
  error?: string
  success?: boolean
}

export async function submitAvis(data: {
  cible_id: string
  note: number
  commentaire: string
}): Promise<AvisResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  if (data.note < 1 || data.note > 5) {
    return { error: 'La note doit être entre 1 et 5.' }
  }

  if (!data.commentaire.trim()) {
    return { error: 'Le commentaire est requis.' }
  }

  // Verifier qu'on n'a pas deja laisse un avis
  const { data: existing } = await supabase
    .from('avis')
    .select('id')
    .eq('auteur_id', user.id)
    .eq('cible_id', data.cible_id)
    .single()

  if (existing) {
    return { error: 'Vous avez déjà laissé un avis pour cette personne.' }
  }

  const { error } = await supabase
    .from('avis')
    .insert({
      auteur_id: user.id,
      cible_id: data.cible_id,
      note: data.note,
      commentaire: data.commentaire.trim(),
    })

  if (error) {
    return { error: 'Erreur lors de l\'envoi de l\'avis.' }
  }

  revalidatePath('/recherche')
  return { success: true }
}

export async function signalerAvis(avisId: string): Promise<AvisResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { error } = await supabase
    .from('avis')
    .update({ signale: true })
    .eq('id', avisId)

  if (error) {
    return { error: 'Erreur lors du signalement.' }
  }

  return { success: true }
}
