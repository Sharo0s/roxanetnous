'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function adminUpdateAnnonceStatus(
  annonceId: string,
  status: 'publiee' | 'suspendue' | 'archivee',
  type: 'accompagnante' | 'accompagne'
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: adminData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Accès non autorisé.' }
  }

  const supabaseAdmin = await createClient({ serviceRole: true })

  const table = type === 'accompagnante' ? 'annonces_accompagnants' : 'annonces_accompagnes'

  const { error } = await supabaseAdmin
    .from(table)
    .update({ status })
    .eq('id', annonceId)

  if (error) {
    return { error: 'Erreur lors de la mise à jour.' }
  }

  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: `annonce_${status}`,
    target_type: `annonce_${type}`,
    target_id: annonceId,
    details: { status },
  })

  revalidatePath('/admin/annonces')
  return {}
}
