'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function adminUpdateAnnonceStatus(
  annonceId: string,
  status: 'publiee' | 'suspendue' | 'archivee',
  type: 'auxiliaire' | 'beneficiaire'
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

  const table = type === 'auxiliaire' ? 'annonces_auxiliaires' : 'annonces_beneficiaires'

  const { error } = await supabaseAdmin
    .from(table)
    .update({ status })
    .eq('id', annonceId)

  if (error) {
    return { error: 'Erreur lors de la mise a jour.' }
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
