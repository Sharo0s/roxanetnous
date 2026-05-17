import { randomInt } from 'node:crypto'
import { after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { sendParrainageBienvenueAccompagne } from '@/lib/emails'

// Alphabet 31 chars sans 0/O/1/I/L (lisibilité). Doit rester en sync avec
// app/actions/parrainage.ts (CODE_ALPHABET).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

export function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET.charAt(randomInt(0, CODE_ALPHABET.length))
  }
  return out
}

export type GenerateCodeResult =
  | { code: string; created: boolean }
  | { error: string }

// Variante système : bypass le check d'authz, le système agit pour le compte
// de l'utilisateur courant après vérification (ex: webhook Stripe, validation admin).
// Module non-'use server' pour éviter d'exposer une Server Action publique sans authz.
//
// L1 (code review 2026-04-29) : retourne `created: true` si un nouveau code
// a été généré, `created: false` si un code existait déjà. L'appelant peut
// ainsi conditionner l'envoi de l'email "bienvenue marraine" pour ne pas
// spammer un utilisateur revalidé.
export async function generateCodeForUserSystem(userId: string): Promise<GenerateCodeResult> {
  if (!userId) return { error: 'userId manquant.' }
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: existing } = await supabaseAdmin
    .from('parrainages_codes')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing?.code) return { code: existing.code, created: false }

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode()
    const { error } = await supabaseAdmin
      .from('parrainages_codes')
      .insert({
        user_id: userId,
        code,
        compteur_confirmes: 0,
        total_recompenses: 0,
      })
    if (!error) return { code, created: true }
    if ((error as { code?: string }).code !== '23505') {
      return { error: 'Erreur lors de la création du code de parrainage.' }
    }
    const { data: nowExisting } = await supabaseAdmin
      .from('parrainages_codes')
      .select('code')
      .eq('user_id', userId)
      .maybeSingle()
    if (nowExisting?.code) return { code: nowExisting.code, created: false }
  }
  return { error: 'Impossible de générer un code unique après plusieurs tentatives.' }
}

// Story 8.A.1 : genese du code parrainage pour un accompagne a la 1ere
// transition d'abonnement vers status='active' ou 'trialing'. Symetrique
// du path accompagnant (validateAccompagnante dans app/actions/admin.ts)
// mais declenchee par le webhook Stripe (pas par une validation admin)
// car l'accompagne se valide via paiement direct, sans OCR ni visio.
//
// 3 couches imbriquees d'idempotence :
//  1) Stripe stripe_events_processed.event_id (webhook)
//  2) generateCodeForUserSystem.maybeSingle() sur parrainages_codes.user_id
//  3) logNotification partial UNIQUE INDEX notifications_log_unique_sent_by_hour
//
// Le filtre `role === 'accompagne'` strict evite toute collision avec
// validateAccompagnante (accompagnants). Cf. Epic 8 stories 8.A.1 et 8.B.1.
export async function triggerAccompagneCodeGenesisIfEligible(params: {
  userId: string
  status: string
}): Promise<{ codeCreated: boolean; code?: string } | null> {
  if (params.status !== 'active' && params.status !== 'trialing') return null
  if (!params.userId) return null

  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('role, email, first_name')
    .eq('id', params.userId)
    .maybeSingle()

  if (userErr || !userRow) {
    Sentry.captureException(userErr ?? new Error('user_not_found'), {
      tags: { flow: 'parrainage', signal: 'genese-accompagne-failed', severity: 'warning' },
      extra: { userId: params.userId, status: params.status, step: 'user_lookup' },
    })
    return null
  }

  if (userRow.role !== 'accompagne') return null

  const codeResult = await generateCodeForUserSystem(params.userId)
  if (!('code' in codeResult)) {
    Sentry.captureException(new Error(codeResult.error), {
      tags: { flow: 'parrainage', signal: 'genese-accompagne-failed', severity: 'warning' },
      extra: { userId: params.userId, status: params.status, step: 'generate_code' },
    })
    return null
  }

  if (codeResult.created) {
    if (!userRow.email) {
      Sentry.captureException(new Error('accompagne_no_email'), {
        tags: { flow: 'parrainage', signal: 'genese-accompagne-email-skipped', severity: 'warning' },
        extra: { userId: params.userId, status: params.status },
      })
    } else {
      after(async () => {
        try {
          await sendParrainageBienvenueAccompagne({
            email: userRow.email,
            firstName: userRow.first_name || '',
            code: codeResult.code,
            userId: params.userId,
          })
        } catch (e) {
          Sentry.captureException(e, {
            tags: { flow: 'parrainage', signal: 'genese-accompagne-email-failed', severity: 'warning' },
            extra: { userId: params.userId },
          })
        }
      })
    }
  }

  return { codeCreated: codeResult.created, code: codeResult.code }
}
