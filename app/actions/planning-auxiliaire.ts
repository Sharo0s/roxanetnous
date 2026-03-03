'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAuxiliaireShifts(startDate: string, endDate: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: shifts } = await supabase
    .from('planning_shifts')
    .select('id, beneficiaire_id, date, creneaux, total_heures, note')
    .eq('auxiliaire_user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (!shifts || shifts.length === 0) return []

  // Recuperer les noms des beneficiaires + couleurs
  const benefIds = [...new Set(shifts.map(s => s.beneficiaire_id))]

  const { data: profiles } = await supabase
    .from('beneficiaires_profiles')
    .select('id, user_id')
    .in('id', benefIds)

  if (!profiles || profiles.length === 0) return shifts.map(s => ({ ...s, beneficiaire_name: '', couleur: '#6B7280' }))

  const userIds = profiles.map(p => p.user_id)
  const profileToUser = new Map(profiles.map(p => [p.id, p.user_id]))

  const [{ data: users }, { data: teamData }] = await Promise.all([
    supabase.from('users').select('id, first_name, last_name').in('id', userIds),
    supabase.from('beneficiaire_auxiliaires').select('beneficiaire_id, couleur').eq('auxiliaire_user_id', user.id).in('beneficiaire_id', benefIds),
  ])

  const usersMap = new Map(users?.map(u => [u.id, u]) || [])
  const colorsMap = new Map(teamData?.map(t => [t.beneficiaire_id, t.couleur]) || [])

  return shifts.map(s => {
    const userId = profileToUser.get(s.beneficiaire_id)
    const u = userId ? usersMap.get(userId) : null
    return {
      ...s,
      beneficiaire_name: u ? `${u.first_name} ${u.last_name}` : '',
      couleur: colorsMap.get(s.beneficiaire_id) || '#6B7280',
    }
  })
}

export async function getAuxiliaireDocuments() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: assignments } = await supabase
    .from('planning_document_assignments')
    .select('document_id')
    .eq('auxiliaire_user_id', user.id)

  if (!assignments || assignments.length === 0) return []

  const docIds = assignments.map(a => a.document_id)

  const { data: docs } = await supabase
    .from('planning_documents')
    .select('id, beneficiaire_id, nom_fichier, file_path, file_size, mime_type, created_at')
    .in('id', docIds)
    .order('created_at', { ascending: false })

  if (!docs || docs.length === 0) return []

  // Check reads
  const { data: reads } = await supabase
    .from('planning_document_reads')
    .select('document_id')
    .eq('user_id', user.id)
    .in('document_id', docIds)

  const readSet = new Set(reads?.map(r => r.document_id) || [])

  // Beneficiaire names
  const benefIds = [...new Set(docs.map(d => d.beneficiaire_id))]
  const { data: profiles } = await supabase
    .from('beneficiaires_profiles')
    .select('id, user_id')
    .in('id', benefIds)

  const profileUserIds = profiles?.map(p => p.user_id) || []
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .in('id', profileUserIds)

  const profileToUser = new Map(profiles?.map(p => [p.id, p.user_id]) || [])
  const usersMap = new Map(users?.map(u => [u.id, u]) || [])

  return docs.map(d => {
    const userId = profileToUser.get(d.beneficiaire_id)
    const u = userId ? usersMap.get(userId) : null
    return {
      ...d,
      beneficiaire_name: u ? `${u.first_name} ${u.last_name}` : '',
      is_read: readSet.has(d.id),
    }
  })
}

export async function isAuxiliaireInAnyTeam(): Promise<boolean> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('beneficiaire_auxiliaires')
    .select('id')
    .eq('auxiliaire_user_id', user.id)
    .limit(1)

  return (data?.length || 0) > 0
}
