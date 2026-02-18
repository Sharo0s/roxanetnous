'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendValidationResultEmail } from '@/lib/emails'

export type ValidationResult = {
  error?: string
  success?: boolean
}

export async function validateAuxiliaire(
  profileId: string,
  decision: 'valide' | 'refuse' | 'a_completer',
  motif?: string
): Promise<ValidationResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  // Verifier que l'utilisateur est admin
  const { data: adminData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Acces non autorise.' }
  }

  // Verifier que le motif est fourni pour refus ou a_completer
  if ((decision === 'refuse' || decision === 'a_completer') && !motif) {
    return { error: 'Le motif est requis pour un refus ou une demande de complement.' }
  }

  // Mettre a jour le profil
  const updateData: Record<string, unknown> = {
    validation_status: decision,
    validation_date: new Date().toISOString(),
    validated_by: user.id,
  }

  if (motif) {
    updateData.refus_motif = motif
  }

  const { error: updateError } = await supabase
    .from('auxiliaires_profiles')
    .update(updateData)
    .eq('id', profileId)

  if (updateError) {
    return { error: 'Erreur lors de la mise a jour du profil.' }
  }

  // Logger l'action admin
  const supabaseAdmin = await createClient({ serviceRole: true })

  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: decision,
    target_type: 'auxiliaire',
    target_id: profileId,
    details: { motif: motif || null, decision },
  })

  // Envoyer l'email de resultat de validation (non-bloquant)
  void (async () => {
    try {
      const { data: auxProfile } = await supabaseAdmin
        .from('auxiliaires_profiles')
        .select('user_id')
        .eq('id', profileId)
        .single()

      if (!auxProfile) return

      const { data: auxUser } = await supabaseAdmin
        .from('users')
        .select('email, first_name')
        .eq('id', auxProfile.user_id)
        .single()

      if (!auxUser) return

      await sendValidationResultEmail({
        email: auxUser.email,
        firstName: auxUser.first_name || '',
        decision,
        motif,
        userId: auxProfile.user_id,
      })
    } catch {}
  })()

  redirect('/admin')
}
