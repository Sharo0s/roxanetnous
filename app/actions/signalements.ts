'use server'

import { createClient } from '@/lib/supabase/server'

export type SignalementResult = {
  error?: string
  success?: boolean
}

export async function creerSignalement(data: {
  cible_type: 'user' | 'annonce_accompagnante' | 'annonce_accompagne' | 'avis' | 'message'
  cible_id: string
  motif: string
  description: string
}): Promise<SignalementResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  if (!data.motif.trim()) {
    return { error: 'Le motif est requis.' }
  }

  const { error } = await supabase
    .from('signalements')
    .insert({
      auteur_id: user.id,
      cible_type: data.cible_type,
      cible_id: data.cible_id,
      motif: data.motif.trim(),
      description: data.description.trim() || null,
    })

  if (error) {
    return { error: 'Erreur lors du signalement.' }
  }

  return { success: true }
}
