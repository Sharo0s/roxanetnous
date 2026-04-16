'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function masquerAvis(avisId: string): Promise<{ error?: string }> {
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

  const { error } = await supabaseAdmin
    .from('avis')
    .update({ masque: true })
    .eq('id', avisId)

  if (error) {
    return { error: 'Erreur lors du masquage.' }
  }

  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: 'avis_masque',
    target_type: 'avis',
    target_id: avisId,
    details: {},
  })

  revalidatePath('/admin/avis')
  return {}
}

export async function demasquerAvis(avisId: string): Promise<{ error?: string }> {
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

  const { error } = await supabaseAdmin
    .from('avis')
    .update({ masque: false, signale: false })
    .eq('id', avisId)

  if (error) {
    return { error: 'Erreur.' }
  }

  revalidatePath('/admin/avis')
  return {}
}
