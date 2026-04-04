import { createClient } from '@/lib/supabase/server'

async function getAdmin() {
  return createClient({ serviceRole: true })
}

// Prix mensuels
const PRIX_MENSUEL = 4.99
const PRIX_ANNUEL = 49.99

function mrrFromPlanType(planType: string | null): number {
  if (planType === 'annual' || planType === 'annuel') return PRIX_ANNUEL / 12
  return PRIX_MENSUEL
}

export async function getKpis() {
  const supabase = await getAdmin()

  // MRR
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('plan_type')
    .in('status', ['active', 'trialing'])

  const mrr = (subs || []).reduce((sum, s) => sum + mrrFromPlanType(s.plan_type), 0)

  // Actifs 30 jours
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const { count: actifs30j } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .gte('last_seen_at', thirtyDaysAgo.toISOString())
    .neq('role', 'admin')

  // Total users non-admin
  const { count: totalUsers } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .neq('role', 'admin')

  // Abonnes actifs (pour taux de conversion)
  const { count: abonnesActifs } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'trialing'])

  const tauxConversion = totalUsers ? ((abonnesActifs || 0) / totalUsers) * 100 : 0

  // Churn ce mois
  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)

  const { count: annulationsCeMois } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'cancelled')
    .gte('cancelled_at', firstOfMonth.toISOString())

  // Abonnes debut de mois = actifs maintenant + annulations ce mois
  const abonnesDebutMois = (abonnesActifs || 0) + (annulationsCeMois || 0)
  const churn = abonnesDebutMois > 0
    ? ((annulationsCeMois || 0) / abonnesDebutMois) * 100
    : 0

  return {
    mrr,
    actifs30j: actifs30j || 0,
    tauxConversion,
    churn,
    totalUsers: totalUsers || 0,
    abonnesActifs: abonnesActifs || 0,
  }
}

export async function getInscriptionsParMois() {
  const supabase = await getAdmin()

  const { data: users } = await supabase
    .from('users')
    .select('role, created_at')
    .neq('role', 'admin')
    .order('created_at', { ascending: true })

  if (!users?.length) return []

  // Determiner la plage : du premier utilisateur jusqu'a maintenant
  const first = new Date(users[0].created_at)
  const now = new Date()
  const moisMap = new Map<string, { accompagnantes: number; accompagnes: number }>()

  const d = new Date(first.getFullYear(), first.getMonth(), 1)
  while (d <= now) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    moisMap.set(key, { accompagnantes: 0, accompagnes: 0 })
    d.setMonth(d.getMonth() + 1)
  }

  for (const u of users) {
    const ud = new Date(u.created_at)
    const key = `${ud.getFullYear()}-${String(ud.getMonth() + 1).padStart(2, '0')}`
    const entry = moisMap.get(key)
    if (!entry) continue
    if (u.role === 'accompagnante') entry.accompagnantes++
    else if (u.role === 'accompagne') entry.accompagnes++
  }

  return Array.from(moisMap.entries()).map(([mois, data]) => ({
    mois,
    ...data,
    total: data.accompagnantes + data.accompagnes,
  }))
}

export async function getRepartitionRoles() {
  const supabase = await getAdmin()

  const { count: accompagnantes } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'accompagnante')

  const { count: accompagnes } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'accompagne')

  return {
    accompagnantes: accompagnantes || 0,
    accompagnes: accompagnes || 0,
    total: (accompagnantes || 0) + (accompagnes || 0),
  }
}

export async function getActiviteParMois() {
  const supabase = await getAdmin()

  const [{ data: messages }, { data: conversations }, { data: avis }] = await Promise.all([
    supabase.from('messages').select('created_at').order('created_at', { ascending: true }),
    supabase.from('conversations').select('created_at').order('created_at', { ascending: true }),
    supabase.from('avis').select('created_at').order('created_at', { ascending: true }),
  ])

  // Trouver la date la plus ancienne parmi toutes les sources
  const allDates = [
    ...(messages || []),
    ...(conversations || []),
    ...(avis || []),
  ].map(item => new Date(item.created_at))

  if (allDates.length === 0) return []

  const first = new Date(Math.min(...allDates.map(d => d.getTime())))
  const now = new Date()

  const moisMap = new Map<string, { messages: number; conversations: number; avis: number }>()
  const d = new Date(first.getFullYear(), first.getMonth(), 1)
  while (d <= now) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    moisMap.set(key, { messages: 0, conversations: 0, avis: 0 })
    d.setMonth(d.getMonth() + 1)
  }

  function addToMonth(items: { created_at: string }[] | null, field: 'messages' | 'conversations' | 'avis') {
    for (const item of items || []) {
      const id = new Date(item.created_at)
      const key = `${id.getFullYear()}-${String(id.getMonth() + 1).padStart(2, '0')}`
      const entry = moisMap.get(key)
      if (entry) entry[field]++
    }
  }

  addToMonth(messages, 'messages')
  addToMonth(conversations, 'conversations')
  addToMonth(avis, 'avis')

  return Array.from(moisMap.entries()).map(([mois, data]) => ({
    mois,
    ...data,
  }))
}

export async function getRevenusParMois() {
  const supabase = await getAdmin()

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('plan_type, created_at, cancelled_at, status')
    .order('created_at', { ascending: true })

  if (!subs?.length) return []

  // Plage : du premier abonnement jusqu'a maintenant
  const first = new Date(subs[0].created_at)
  const now = new Date()
  const mois: string[] = []
  const d = new Date(first.getFullYear(), first.getMonth(), 1)
  while (d <= now) {
    mois.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() + 1)
  }

  return mois.map((m) => {
    const [year, month] = m.split('-').map(Number)
    const finDuMois = new Date(year, month, 0, 23, 59, 59)
    const debutDuMois = new Date(year, month - 1, 1)

    let abonnes = 0
    let mrr = 0

    for (const s of subs) {
      const createdAt = new Date(s.created_at)
      if (createdAt > finDuMois) continue
      if (s.cancelled_at) {
        const cancelledAt = new Date(s.cancelled_at)
        if (cancelledAt < debutDuMois) continue
      }
      abonnes++
      mrr += mrrFromPlanType(s.plan_type)
    }

    return { mois: m, abonnes, mrr }
  })
}

export async function getMrrDetail() {
  const supabase = await getAdmin()

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('plan_type, user_id, status')
    .in('status', ['active', 'trialing'])

  const { data: users } = await supabase
    .from('users')
    .select('id, role')
    .neq('role', 'admin')

  const roleMap = new Map<string, string>()
  for (const u of users || []) {
    roleMap.set(u.id, u.role)
  }

  // Segments: accompagnante_mensuel, accompagnante_annuel, accompagne_mensuel, accompagne_annuel
  const segments = {
    accompagnante_mensuel: { count: 0, mrr: 0 },
    accompagnante_annuel: { count: 0, mrr: 0 },
    accompagne_mensuel: { count: 0, mrr: 0 },
    accompagne_annuel: { count: 0, mrr: 0 },
  }

  // Essai vs payants
  let essaiGratuit = 0
  let payants = 0

  for (const s of subs || []) {
    const role = roleMap.get(s.user_id) || 'accompagnante'
    const isAnnuel = s.plan_type === 'annual' || s.plan_type === 'annuel'
    const segmentKey = `${role}_${isAnnuel ? 'annuel' : 'mensuel'}` as keyof typeof segments

    if (segments[segmentKey]) {
      segments[segmentKey].count++
      segments[segmentKey].mrr += mrrFromPlanType(s.plan_type)
    }

    if (s.status === 'trialing') essaiGratuit++
    else payants++
  }

  return { segments, essaiGratuit, payants }
}

export async function getChurn() {
  const supabase = await getAdmin()

  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)

  const { count: annulationsCeMois } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'cancelled')
    .gte('cancelled_at', firstOfMonth.toISOString())

  const { count: abonnesActifs } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'trialing'])

  const abonnesDebutMois = (abonnesActifs || 0) + (annulationsCeMois || 0)
  const taux = abonnesDebutMois > 0
    ? ((annulationsCeMois || 0) / abonnesDebutMois) * 100
    : 0

  return {
    taux,
    annulations: annulationsCeMois || 0,
    abonnesDebutMois,
  }
}

export async function getDernieresAnnulations() {
  const supabase = await getAdmin()

  const { data: annulations } = await supabase
    .from('subscriptions')
    .select('cancelled_at, plan_type, user_id')
    .eq('status', 'cancelled')
    .not('cancelled_at', 'is', null)
    .order('cancelled_at', { ascending: false })
    .limit(20)

  if (!annulations?.length) return []

  const userIds = annulations.map(a => a.user_id)
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, role')
    .in('id', userIds)

  const userMap = new Map(
    (users || []).map(u => [u.id, u])
  )

  return annulations.map(a => {
    const user = userMap.get(a.user_id)
    return {
      date: a.cancelled_at,
      nom: user ? `${user.first_name} ${user.last_name}` : 'Inconnu',
      email: user?.email || '',
      role: user?.role || '',
      plan: a.plan_type || 'mensuel',
    }
  })
}
