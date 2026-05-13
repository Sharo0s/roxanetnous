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
    churnAnnulations: annulationsCeMois || 0,
    churnAbonnesDebutMois: abonnesDebutMois,
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
    if (u.role === 'accompagnant') entry.accompagnantes++
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

  const [{ data: messages }, { data: conversations }] = await Promise.all([
    supabase.from('messages').select('created_at').order('created_at', { ascending: true }),
    supabase.from('conversations').select('created_at').order('created_at', { ascending: true }),
  ])

  // Trouver la date la plus ancienne parmi toutes les sources
  const allDates = [
    ...(messages || []),
    ...(conversations || []),
  ].map(item => new Date(item.created_at))

  if (allDates.length === 0) return []

  const first = new Date(Math.min(...allDates.map(d => d.getTime())))
  const now = new Date()

  const moisMap = new Map<string, { messages: number; conversations: number }>()
  const d = new Date(first.getFullYear(), first.getMonth(), 1)
  while (d <= now) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    moisMap.set(key, { messages: 0, conversations: 0 })
    d.setMonth(d.getMonth() + 1)
  }

  function addToMonth(items: { created_at: string }[] | null, field: 'messages' | 'conversations') {
    for (const item of items || []) {
      const id = new Date(item.created_at)
      const key = `${id.getFullYear()}-${String(id.getMonth() + 1).padStart(2, '0')}`
      const entry = moisMap.get(key)
      if (entry) entry[field]++
    }
  }

  addToMonth(messages, 'messages')
  addToMonth(conversations, 'conversations')

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
  let essaiAccompagnantes = 0
  let essaiAccompagnes = 0

  for (const s of subs || []) {
    const role = roleMap.get(s.user_id) || 'accompagnante'
    const isAnnuel = s.plan_type === 'annual' || s.plan_type === 'annuel'
    const segmentKey = `${role}_${isAnnuel ? 'annuel' : 'mensuel'}` as keyof typeof segments

    if (segments[segmentKey]) {
      segments[segmentKey].count++
      segments[segmentKey].mrr += mrrFromPlanType(s.plan_type)
    }

    if (s.status === 'trialing') {
      essaiGratuit++
      if (role === 'accompagnant') essaiAccompagnantes++
      else essaiAccompagnes++
    } else {
      payants++
    }
  }

  return { segments, essaiGratuit, essaiAccompagnantes, essaiAccompagnes, payants }
}

export async function getMrrParSegmentParMois() {
  const supabase = await getAdmin()

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('plan_type, user_id, created_at, cancelled_at, status')
    .order('created_at', { ascending: true })

  if (!subs?.length) return []

  const { data: users } = await supabase
    .from('users')
    .select('id, role')
    .neq('role', 'admin')

  const roleMap = new Map<string, string>()
  for (const u of users || []) {
    roleMap.set(u.id, u.role)
  }

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

    const seg = {
      accompagnante_mensuel: { count: 0, mrr: 0 },
      accompagnante_annuel: { count: 0, mrr: 0 },
      accompagne_mensuel: { count: 0, mrr: 0 },
      accompagne_annuel: { count: 0, mrr: 0 },
    }

    for (const s of subs) {
      const createdAt = new Date(s.created_at)
      if (createdAt > finDuMois) continue
      if (s.cancelled_at) {
        const cancelledAt = new Date(s.cancelled_at)
        if (cancelledAt < debutDuMois) continue
      }

      const role = roleMap.get(s.user_id) || 'accompagnante'
      const isAnnuel = s.plan_type === 'annual' || s.plan_type === 'annuel'
      const key = `${role}_${isAnnuel ? 'annuel' : 'mensuel'}` as keyof typeof seg
      if (seg[key]) {
        seg[key].count++
        seg[key].mrr += mrrFromPlanType(s.plan_type)
      }
    }

    const total = seg.accompagnante_mensuel.mrr + seg.accompagnante_annuel.mrr + seg.accompagne_mensuel.mrr + seg.accompagne_annuel.mrr

    return { mois: m, ...seg, total }
  })
}

export async function getChurn() {
  const supabase = await getAdmin()

  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)

  // Annulations ce mois avec user_id pour le detail par role
  const { data: annulationsData } = await supabase
    .from('subscriptions')
    .select('user_id, plan_type')
    .eq('status', 'cancelled')
    .gte('cancelled_at', firstOfMonth.toISOString())

  const annulationsCeMois = annulationsData?.length || 0

  // Recuperer les roles des utilisateurs annules
  const annulUserIds = (annulationsData || []).map(a => a.user_id)
  let annulAccompagnantes = 0
  let annulAccompagnes = 0
  let annulMensuel = 0
  let annulAnnuel = 0

  if (annulUserIds.length > 0) {
    const { data: annulUsers } = await supabase
      .from('users')
      .select('id, role')
      .in('id', annulUserIds)

    const roleMap = new Map<string, string>()
    for (const u of annulUsers || []) {
      roleMap.set(u.id, u.role)
    }

    for (const a of annulationsData || []) {
      const role = roleMap.get(a.user_id)
      if (role === 'accompagnant') annulAccompagnantes++
      else annulAccompagnes++
      if (a.plan_type === 'annuel' || a.plan_type === 'annual') annulAnnuel++
      else annulMensuel++
    }
  }

  const { count: abonnesActifs } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'trialing'])

  const abonnesDebutMois = (abonnesActifs || 0) + annulationsCeMois
  const taux = abonnesDebutMois > 0
    ? (annulationsCeMois / abonnesDebutMois) * 100
    : 0

  return {
    taux,
    annulations: annulationsCeMois,
    abonnesDebutMois,
    annulAccompagnantes,
    annulAccompagnes,
    annulMensuel,
    annulAnnuel,
  }
}

export async function getWaitlistStats() {
  const supabase = await getAdmin()

  const { count: total } = await supabase
    .from('notifications_ouverture')
    .select('id', { count: 'exact', head: true })
    .is('notified_at', null)

  const { data: rows } = await supabase
    .from('notifications_ouverture')
    .select('code_departement')
    .is('notified_at', null)

  const counts = new Map<string, number>()
  for (const r of rows || []) {
    const code = r.code_departement
    if (!code) continue
    counts.set(code, (counts.get(code) || 0) + 1)
  }
  const top3 = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, count]) => ({ code, count }))

  return { total: total || 0, top3 }
}

export async function getParrainagesStats() {
  const supabase = await getAdmin()

  const [confirme, enCours, flag, blacklist] = await Promise.all([
    supabase
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'confirme'),
    supabase
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .in('statut', ['inscrite', 'abonnee']),
    supabase
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .not('flag_suspicion', 'is', null)
      .not('statut', 'in', '(bloque,fraude)'),
    supabase
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .in('statut', ['bloque', 'fraude']),
  ])

  return {
    aboutis: confirme.count || 0,
    enCours: enCours.count || 0,
    flagActifs: flag.count || 0,
    blacklist: blacklist.count || 0,
  }
}

export async function getActiviteMois() {
  const supabase = await getAdmin()

  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)

  const [{ count: messages }, { count: conversations }] = await Promise.all([
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', firstOfMonth.toISOString()),
    supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', firstOfMonth.toISOString()),
  ])

  return {
    messages: messages || 0,
    conversations: conversations || 0,
  }
}

export async function getDerniereActionAdmin() {
  const supabase = await getAdmin()

  const { data } = await supabase
    .from('admin_actions_log')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at ?? null
}

export async function getDernieresAnnulations() {
  const supabase = await getAdmin()

  // Annulations effectives (cancelled) + annulations prevues (active avec cancel_at)
  const { data: cancelled } = await supabase
    .from('subscriptions')
    .select('cancelled_at, cancel_at, plan_type, user_id, cancel_feedback, cancel_comment, status')
    .eq('status', 'cancelled')
    .not('cancelled_at', 'is', null)
    .order('cancelled_at', { ascending: false })
    .limit(20)

  const { data: pending } = await supabase
    .from('subscriptions')
    .select('cancelled_at, cancel_at, plan_type, user_id, cancel_feedback, cancel_comment, status')
    .not('cancel_at', 'is', null)
    .neq('status', 'cancelled')
    .order('cancel_at', { ascending: false })
    .limit(20)

  const annulations = [
    ...(pending || []).map(a => ({ ...a, _sortDate: a.cancel_at })),
    ...(cancelled || []).map(a => ({ ...a, _sortDate: a.cancelled_at })),
  ].sort((a, b) => new Date(b._sortDate!).getTime() - new Date(a._sortDate!).getTime()).slice(0, 20)

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
      date: a.cancelled_at || a.cancel_at,
      nom: user ? `${user.first_name} ${user.last_name}` : 'Inconnu',
      email: user?.email || '',
      role: user?.role || '',
      plan: a.plan_type || 'mensuel',
      feedback: a.cancel_feedback || null,
      comment: a.cancel_comment || null,
      pending: a.status !== 'cancelled',
    }
  })
}
