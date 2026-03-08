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
