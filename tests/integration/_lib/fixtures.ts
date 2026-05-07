import { randomUUID } from 'node:crypto'
import { getAdminClient } from './supabase-admin'

// Tracker des rows creees pendant les tests : `cleanupAllFixtures` itere et DELETE
// dans l'ordre FK-safe. Pattern AC5 + Risque #2 (defense en profondeur).
type TrackedRow = { table: string; id: string }
const tracker: TrackedRow[] = []

function track(table: string, id: string): void {
  tracker.push({ table, id })
}

export type TestRole = 'accompagnante' | 'accompagne' | 'admin'

export type TestUser = {
  id: string
  email: string
  password: string
  role: TestRole
}

// Cree un utilisateur via auth.admin + INSERT users. Email unique par UUID
// pour eviter toute collision cross-tests dans la meme suite.
export async function createTestUser(
  role: TestRole,
  opts?: { email?: string; password?: string },
): Promise<TestUser> {
  const supabase = getAdminClient()
  const email = opts?.email ?? `test-${role}-${randomUUID()}@test.local`
  const password = opts?.password ?? 'test-password-1234'

  // Le trigger handle_new_user (migration brownfield 20260404134919_rename_*)
  // INSERT automatiquement dans public.users + dans le profil correspondant au role
  // metadata. On passe le role via raw_user_meta_data pour que le trigger l'utilise
  // directement, puis on UPDATE pour les champs first_name/last_name (le trigger pose
  // une string vide par defaut, on enrichit ensuite).
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, first_name: 'Test', last_name: 'Fixture' },
  })
  if (authError || !authData.user) {
    throw new Error(`createTestUser auth.admin echec : ${authError?.message}`)
  }
  const userId = authData.user.id

  // Le role 'admin' n'est pas pris par le trigger (qui ne supporte que 'accompagnante'
  // / 'accompagne'), on UPDATE explicitement. Idem first_name/last_name dans tous les cas.
  const { error: updateError } = await supabase
    .from('users')
    .update({ role, first_name: 'Test', last_name: 'Fixture' })
    .eq('id', userId)
  if (updateError) {
    throw new Error(`createTestUser UPDATE users echec : ${updateError.message}`)
  }
  track('users', userId)
  return { id: userId, email, password, role }
}

export type TestSubscription = {
  id: string
  userId: string
  stripeSubscriptionId: string
  stripeCustomerId: string
}

export async function createTestSubscription(
  userId: string,
  opts?: { status?: string; expiresAt?: Date; stripeSubscriptionId?: string },
): Promise<TestSubscription> {
  const supabase = getAdminClient()
  const stripeSubscriptionId = opts?.stripeSubscriptionId ?? `sub_test_${randomUUID()}`
  const stripeCustomerId = `cus_test_${randomUUID()}`
  const expiresAt = opts?.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const status = opts?.status ?? 'active'

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      status,
      current_period_end: expiresAt.toISOString(),
      plan_type: 'mensuel',
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`createTestSubscription echec : ${error?.message}`)
  }
  track('subscriptions', data.id)
  return {
    id: data.id,
    userId,
    stripeSubscriptionId,
    stripeCustomerId,
  }
}

export type TestProfile = { id: string; userId: string }

// Le trigger handle_new_user cree deja un profile pour les roles 'accompagnante'
// et 'accompagne'. Ces helpers retournent le profile existant (UPDATE pour enrichir
// les champs metier) plutot que d'INSERT en doublon.
export async function createTestAccompagnanteProfile(
  userId: string,
  opts?: { adresse?: string },
): Promise<TestProfile> {
  const supabase = getAdminClient()
  const { data: existing } = await supabase
    .from('accompagnantes_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('accompagnantes_profiles')
      .update({ validation_status: 'valide', adresse: opts?.adresse ?? null })
      .eq('id', existing.id)
    track('accompagnantes_profiles', existing.id)
    return { id: existing.id, userId }
  }

  const { data, error } = await supabase
    .from('accompagnantes_profiles')
    .insert({
      user_id: userId,
      validation_status: 'valide',
      adresse: opts?.adresse ?? null,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`createTestAccompagnanteProfile echec : ${error?.message}`)
  }
  track('accompagnantes_profiles', data.id)
  return { id: data.id, userId }
}

export async function createTestAccompagneProfile(userId: string): Promise<TestProfile> {
  const supabase = getAdminClient()
  const { data: existing } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    track('accompagnes_profiles', existing.id)
    return { id: existing.id, userId }
  }

  const { data, error } = await supabase
    .from('accompagnes_profiles')
    .insert({ user_id: userId })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`createTestAccompagneProfile echec : ${error?.message}`)
  }
  track('accompagnes_profiles', data.id)
  return { id: data.id, userId }
}

export type TestConversation = { id: string }

export async function createTestConversation(
  accompagnanteProfileId: string,
  accompagneProfileId: string,
  opts?: { adminUserId?: string | null },
): Promise<TestConversation> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      accompagnante_id: accompagnanteProfileId,
      accompagne_id: accompagneProfileId,
      admin_id: opts?.adminUserId ?? null,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`createTestConversation echec : ${error?.message}`)
  }
  track('conversations', data.id)
  return { id: data.id }
}

export type TestMessage = { id: string }

export async function createTestMessage(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<TestMessage> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`createTestMessage echec : ${error?.message}`)
  }
  track('messages', data.id)
  return { id: data.id }
}

export type TestParrainage = { id: string }

export async function createTestParrainage(
  marraineUserId: string,
  filleuleUserId: string | null,
  opts?: {
    code?: string
    statut?: 'inscrite' | 'abonnee' | 'bloque'
    fingerprint?: string | null
  },
): Promise<TestParrainage> {
  const supabase = getAdminClient()
  const code = opts?.code ?? `PARR${randomUUID().slice(0, 8).toUpperCase()}`
  const { data, error } = await supabase
    .from('parrainages')
    .insert({
      marraine_id: marraineUserId,
      filleule_id: filleuleUserId,
      code,
      statut: opts?.statut ?? 'inscrite',
      stripe_fingerprint: opts?.fingerprint ?? null,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`createTestParrainage echec : ${error?.message}`)
  }
  track('parrainages', data.id)
  return { id: data.id }
}

// Tracker un row stripe_events_processed pour cleanup post-test (T1, T3, T4 inserent une row).
export function trackStripeEvent(eventId: string): void {
  track('stripe_events_processed', eventId)
}

// Tracker un row admin_actions_log (insere par detectBlacklistAtWebhook, T2).
export function trackAdminActionLog(id: string): void {
  track('admin_actions_log', id)
}

// Cleanup global : DELETE en ordre FK-safe. Appele en afterAll global.
// Defense en profondeur : iteration du tracker + balayage final email LIKE 'test-%@test.local'.
export async function cleanupAllFixtures(): Promise<void> {
  const supabase = getAdminClient()

  // Ordre FK-safe : enfants d'abord, parents ensuite.
  // Couple (table, primary key column) car certaines tables ont une PK non-id (stripe_events_processed.event_id).
  const fkSafeOrder: Array<{ table: string; pk: string }> = [
    { table: 'messages', pk: 'id' },
    { table: 'conversations', pk: 'id' },
    { table: 'parrainages', pk: 'id' },
    { table: 'subscriptions', pk: 'id' },
    { table: 'admin_actions_log', pk: 'id' },
    { table: 'stripe_events_processed', pk: 'event_id' },
    { table: 'notifications_log', pk: 'id' },
    { table: 'accompagnantes_profiles', pk: 'id' },
    { table: 'accompagnes_profiles', pk: 'id' },
    { table: 'users', pk: 'id' },
  ]

  for (const { table, pk } of fkSafeOrder) {
    const ids = tracker.filter((row) => row.table === table).map((row) => row.id)
    if (ids.length === 0) continue
    await supabase.from(table).delete().in(pk, ids)
  }

  // Balayage final auth.users pour les comptes test- crees (cleanup robust si table users
  // a ete supprimee mais auth.users orphelin).
  // Wrap dans try/catch : si un user est deja supprime par cascade ou si l'API
  // throw (network, 500), on continue le cleanup pour les autres
  // (review code 2026-05-09 H7).
  const authUserIds = tracker.filter((row) => row.table === 'users').map((row) => row.id)
  for (const id of authUserIds) {
    try {
      await supabase.auth.admin.deleteUser(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('not found') && !message.includes('User not found')) {
        console.warn(`[cleanupAllFixtures] auth.admin.deleteUser ${id} : ${message}`)
      }
    }
  }

  tracker.length = 0
}
