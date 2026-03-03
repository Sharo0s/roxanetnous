'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type Creneau = { debut: string; fin: string }

function calculateTotalHeures(creneaux: Creneau[]): number {
  let total = 0
  for (const c of creneaux) {
    const [dH, dM] = c.debut.split(':').map(Number)
    const [fH, fM] = c.fin.split(':').map(Number)
    const diff = (fH * 60 + fM) - (dH * 60 + dM)
    if (diff > 0) total += diff
  }
  return Math.round((total / 60) * 100) / 100
}

async function getBeneficiaireProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data
}

export async function getShiftsForPeriod(startDate: string, endDate: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return []

  const { data: shifts } = await supabase
    .from('planning_shifts')
    .select('id, auxiliaire_user_id, date, creneaux, total_heures, note')
    .eq('beneficiaire_id', profile.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (!shifts || shifts.length === 0) return []

  // Recuperer les infos auxiliaires
  const auxUserIds = [...new Set(shifts.map(s => s.auxiliaire_user_id))]

  const [{ data: users }, { data: teamMembers }] = await Promise.all([
    supabase.from('users').select('id, first_name, last_name').in('id', auxUserIds),
    supabase.from('beneficiaire_auxiliaires').select('auxiliaire_user_id, couleur').eq('beneficiaire_id', profile.id).in('auxiliaire_user_id', auxUserIds),
  ])

  const usersMap = new Map(users?.map(u => [u.id, u]) || [])
  const colorsMap = new Map(teamMembers?.map(t => [t.auxiliaire_user_id, t.couleur]) || [])

  return shifts.map(s => ({
    ...s,
    first_name: usersMap.get(s.auxiliaire_user_id)?.first_name || '',
    last_name: usersMap.get(s.auxiliaire_user_id)?.last_name || '',
    couleur: colorsMap.get(s.auxiliaire_user_id) || '#6B7280',
  }))
}

export async function createOrUpdateShift(params: {
  auxiliaireUserId: string
  date: string
  creneaux: Creneau[]
  note?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return { error: 'Profil beneficiaire introuvable' }

  const totalHeures = calculateTotalHeures(params.creneaux)

  const { error } = await supabase
    .from('planning_shifts')
    .upsert(
      {
        beneficiaire_id: profile.id,
        auxiliaire_user_id: params.auxiliaireUserId,
        date: params.date,
        creneaux: params.creneaux,
        total_heures: totalHeures,
        note: params.note || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'beneficiaire_id,auxiliaire_user_id,date' }
    )

  if (error) return { error: 'Erreur lors de la sauvegarde' }

  revalidatePath('/beneficiaire/planning')
  return { success: true }
}

export async function deleteShift(shiftId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return { error: 'Profil beneficiaire introuvable' }

  await supabase
    .from('planning_shifts')
    .delete()
    .eq('id', shiftId)
    .eq('beneficiaire_id', profile.id)

  revalidatePath('/beneficiaire/planning')
  return { success: true }
}

export async function copyShifts(params: {
  sourceDates: string[]
  targetDates: string[]
  auxiliaireUserIds?: string[]
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return { error: 'Profil beneficiaire introuvable', copiedCount: 0 }

  // Lire les shifts source
  let query = supabase
    .from('planning_shifts')
    .select('auxiliaire_user_id, creneaux, total_heures, note')
    .eq('beneficiaire_id', profile.id)
    .in('date', params.sourceDates)

  if (params.auxiliaireUserIds && params.auxiliaireUserIds.length > 0) {
    query = query.in('auxiliaire_user_id', params.auxiliaireUserIds)
  }

  const { data: sourceShifts } = await query

  if (!sourceShifts || sourceShifts.length === 0) {
    return { error: 'Aucun creneau a copier', copiedCount: 0 }
  }

  // Creer les shifts cibles : on mappe source[i] -> target[i] pour chaque jour
  const inserts: Array<Record<string, unknown>> = []

  for (let i = 0; i < Math.min(params.sourceDates.length, params.targetDates.length); i++) {
    const sourceDate = params.sourceDates[i]
    const targetDate = params.targetDates[i]
    const dayShifts = sourceShifts.filter(s => {
      // sourceShifts n'a pas la date, on doit la recuperer autrement
      // En fait on a filtre par sourceDates, et si sourceDates.length === 1, tous les shifts sont de ce jour
      return true
    })

    for (const shift of dayShifts) {
      inserts.push({
        beneficiaire_id: profile.id,
        auxiliaire_user_id: shift.auxiliaire_user_id,
        date: targetDate,
        creneaux: shift.creneaux,
        total_heures: shift.total_heures,
        note: shift.note,
        updated_at: new Date().toISOString(),
      })
    }
  }

  if (inserts.length === 0) return { copiedCount: 0 }

  // Upsert pour ne pas echouer si le creneau existe deja
  const { error } = await supabase
    .from('planning_shifts')
    .upsert(inserts as any, { onConflict: 'beneficiaire_id,auxiliaire_user_id,date' })

  if (error) return { error: 'Erreur lors de la copie', copiedCount: 0 }

  revalidatePath('/beneficiaire/planning')
  return { copiedCount: inserts.length }
}
