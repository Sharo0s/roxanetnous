'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function traiterSignalement(
  signalementId: string,
  decision: 'suspendu' | 'supprime' | 'averti' | 'ignore',
  notesAdmin: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const { data: adminData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Acces non autorise.' }
  }

  const supabaseAdmin = await createClient({ serviceRole: true })

  const { error } = await supabaseAdmin
    .from('signalements')
    .update({
      status: decision === 'ignore' ? 'ignore' : 'traite',
      decision,
      traite_par: user.id,
      traite_at: new Date().toISOString(),
      notes_admin: notesAdmin.trim() || null,
    })
    .eq('id', signalementId)

  if (error) {
    return { error: 'Erreur lors du traitement.' }
  }

  // Logger l'action admin
  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: `signalement_${decision}`,
    target_type: 'signalement',
    target_id: signalementId,
    details: { decision, notes_admin: notesAdmin || null },
  })

  revalidatePath('/admin/signalements')
  return {}
}
