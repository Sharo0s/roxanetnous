import { createClient } from '@/lib/supabase/server'

export type BadgeData = {
  annonce_active: boolean
  anciennete: string | null
}

export async function calculateAndUpdateBadges(userId: string): Promise<void> {
  const supabase = await createClient({ serviceRole: true })

  // Verifier annonce active
  const { data: profile } = await supabase
    .from('auxiliaires_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('validation_status', 'valide')
    .single()

  let annonceActive = false
  if (profile) {
    const { count } = await supabase
      .from('annonces_auxiliaires')
      .select('id', { count: 'exact', head: true })
      .eq('auxiliaire_id', profile.id)
      .eq('status', 'publiee')

    annonceActive = (count || 0) > 0
  }

  // Calculer anciennete depuis first_subscription_date
  let anciennete: string | null = null
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('first_subscription_date')
    .eq('user_id', userId)
    .not('first_subscription_date', 'is', null)
    .order('first_subscription_date', { ascending: true })
    .limit(1)
    .single()

  if (sub?.first_subscription_date) {
    const firstDate = new Date(sub.first_subscription_date)
    const now = new Date()
    const years = (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

    if (years >= 5) {
      anciennete = '5_ans'
    } else if (years >= 3) {
      anciennete = '3_ans'
    } else if (years >= 1) {
      anciennete = '1_an'
    }
  }

  // Upsert dans badges_cache
  await supabase
    .from('badges_cache')
    .upsert(
      {
        user_id: userId,
        annonce_active: annonceActive,
        anciennete,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
}

export async function calculateAllBadges(): Promise<{ processed: number }> {
  const supabase = await createClient({ serviceRole: true })

  // Tous les auxiliaires valides
  const { data: profiles } = await supabase
    .from('auxiliaires_profiles')
    .select('user_id')
    .eq('validation_status', 'valide')

  if (!profiles || profiles.length === 0) return { processed: 0 }

  for (const p of profiles) {
    await calculateAndUpdateBadges(p.user_id!)
  }

  return { processed: profiles.length }
}

export async function getBadges(
  userIds: string[]
): Promise<Record<string, BadgeData>> {
  if (userIds.length === 0) return {}

  const supabase = await createClient({ serviceRole: true })

  const { data } = await supabase
    .from('badges_cache')
    .select('user_id, annonce_active, anciennete')
    .in('user_id', userIds)

  const result: Record<string, BadgeData> = {}
  for (const row of data || []) {
    result[row.user_id] = {
      annonce_active: row.annonce_active ?? false,
      anciennete: row.anciennete,
    }
  }

  return result
}
