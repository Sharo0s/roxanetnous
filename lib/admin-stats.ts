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

  const douzesMoisAgo = new Date()
  douzesMoisAgo.setMonth(douzesMoisAgo.getMonth() - 11)
  douzesMoisAgo.setDate(1)
  douzesMoisAgo.setHours(0, 0, 0, 0)

  const { data: users } = await supabase
    .from('users')
    .select('role, created_at')
    .gte('created_at', douzesMoisAgo.toISOString())
    .neq('role', 'admin')

  // Grouper par mois
  const moisMap = new Map<string, { auxiliaires: number; beneficiaires: number }>()

  // Initialiser les 12 mois
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    moisMap.set(key, { auxiliaires: 0, beneficiaires: 0 })
  }

  for (const u of users || []) {
    const d = new Date(u.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = moisMap.get(key)
    if (!entry) continue
    if (u.role === 'auxiliaire') entry.auxiliaires++
    else if (u.role === 'beneficiaire') entry.beneficiaires++
  }

  return Array.from(moisMap.entries()).map(([mois, data]) => ({
    mois,
    ...data,
    total: data.auxiliaires + data.beneficiaires,
  }))
}

export async function getRepartitionRoles() {
  const supabase = await getAdmin()

  const { count: auxiliaires } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'auxiliaire')

  const { count: beneficiaires } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'beneficiaire')

  return {
    auxiliaires: auxiliaires || 0,
    beneficiaires: beneficiaires || 0,
    total: (auxiliaires || 0) + (beneficiaires || 0),
  }
}

export async function getActiviteParMois() {
  const supabase = await getAdmin()

  const sixMoisAgo = new Date()
  sixMoisAgo.setMonth(sixMoisAgo.getMonth() - 5)
  sixMoisAgo.setDate(1)
  sixMoisAgo.setHours(0, 0, 0, 0)
  const since = sixMoisAgo.toISOString()

  const [{ data: messages }, { data: conversations }, { data: avis }] = await Promise.all([
    supabase.from('messages').select('created_at').gte('created_at', since),
    supabase.from('conversations').select('created_at').gte('created_at', since),
    supabase.from('avis').select('created_at').gte('created_at', since),
  ])

  // Initialiser les 6 mois
  const moisMap = new Map<string, { messages: number; conversations: number; avis: number }>()
  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    moisMap.set(key, { messages: 0, conversations: 0, avis: 0 })
  }

  function addToMonth(items: { created_at: string }[] | null, field: 'messages' | 'conversations' | 'avis') {
    for (const item of items || []) {
      const d = new Date(item.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

  // Segments: auxiliaire_mensuel, auxiliaire_annuel, beneficiaire_mensuel, beneficiaire_annuel
  const segments = {
    auxiliaire_mensuel: { count: 0, mrr: 0 },
    auxiliaire_annuel: { count: 0, mrr: 0 },
    beneficiaire_mensuel: { count: 0, mrr: 0 },
    beneficiaire_annuel: { count: 0, mrr: 0 },
  }

  // Essai vs payants
  let essaiGratuit = 0
  let payants = 0

  for (const s of subs || []) {
    const role = roleMap.get(s.user_id) || 'auxiliaire'
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
