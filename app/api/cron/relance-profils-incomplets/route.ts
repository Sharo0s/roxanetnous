// Cron quotidien : rappel email aux accompagnantes inscrites mais qui n'ont
// pas finalise leur onboarding (validation_status = 'a_completer').
//
// Cible :
//   - profils 'a_completer' AVEC ville IS NULL OU specialites IS NULL.
//     Cette condition exclut les profils retrogrades par la migration
//     20260510234500 (backfill : ils ont les champs partiels mais pas le
//     vrai signal "jamais soumis"). On veut viser ceux qui n'ont jamais
//     touche le formulaire onboarding.
//   - createdAt dans une fenetre 24h centree autour de J-2 (premier
//     rappel) ou J-7 (deuxieme rappel).
//   - users.rappels_optout = false (RGPD).
//   - aucun mail du meme type deja envoye (idempotence via
//     notifications_log). Pattern reutilise de expiration-reminder.
//
// Le mail est envoye en direct via Resend (sans queue durable), comme
// expiration-reminder. Un echec ne degrade que ce destinataire-la, l'audit
// reste en BDD (notifications_log status='error'). Le cron quotidien
// retentera demain si le destinataire est encore dans la fenetre, mais
// la deduplication notifications_log empechera un double-envoi en cas
// d'envoi reussi qui n'aurait pas log status='sent' (defense en profondeur).

import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { sendRelanceOnboardingEmail } from '@/lib/emails'
import { createOptoutToken } from '@/lib/optout-token'
import { getMissingOnboardingFields } from '@/lib/onboarding-completion'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

type ReminderStage = {
  notificationType: 'relance_onboarding_j2' | 'relance_onboarding_j7'
  // Centre de la fenetre, en jours avant maintenant
  daysAgo: number
}

const STAGES: ReminderStage[] = [
  { notificationType: 'relance_onboarding_j2', daysAgo: 2 },
  { notificationType: 'relance_onboarding_j7', daysAgo: 7 },
]

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const supabase = await createClient({ serviceRole: true })
  const now = Date.now()

  let totalSent = 0
  let totalSkipped = 0
  const stageReports: { stage: string; sent: number; skipped: number }[] = []

  for (const stage of STAGES) {
    const windowEnd = new Date(now - (stage.daysAgo - 0.5) * ONE_DAY_MS).toISOString()
    const windowStart = new Date(now - (stage.daysAgo + 0.5) * ONE_DAY_MS).toISOString()

    // Profils accompagnantes en a_completer, candidats relance.
    const { data: profiles, error } = await supabase
      .from('accompagnantes_profiles')
      .select(`
        id,
        ville,
        code_postal,
        experience,
        specialites,
        diplomes,
        disponibilites,
        rayon_km,
        description,
        user_id,
        users!user_id (id, email, first_name, rappels_optout, created_at)
      `)
      .eq('validation_status', 'a_completer')
      .or('ville.is.null,specialites.is.null')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)

    if (error) {
      Sentry.captureException(error, {
        tags: { flow: 'relance_onboarding_cron', stage: stage.notificationType },
      })
      stageReports.push({ stage: stage.notificationType, sent: 0, skipped: 0 })
      continue
    }

    let sent = 0
    let skipped = 0

    for (const profile of profiles || []) {
      try {
        const user = Array.isArray(profile.users) ? profile.users[0] : profile.users
        if (!user || !user.email || user.rappels_optout) {
          skipped++
          continue
        }

        // Idempotence : ne pas renvoyer si deja envoye (n'importe quand).
        const { data: existingLog } = await supabase
          .from('notifications_log')
          .select('id')
          .eq('user_id', profile.user_id)
          .eq('type', stage.notificationType)
          .eq('status', 'sent')
          .limit(1)

        if (existingLog && existingLog.length > 0) {
          skipped++
          continue
        }

        const missingFields = getMissingOnboardingFields({
          ville: profile.ville,
          code_postal: profile.code_postal,
          experience: profile.experience,
          specialites: profile.specialites,
          diplomes: profile.diplomes,
          disponibilites: profile.disponibilites,
          rayon_km: profile.rayon_km,
          description: profile.description,
        })

        const optoutToken = createOptoutToken({
          userId: profile.user_id,
          type: 'rappels_onboarding',
        })

        await sendRelanceOnboardingEmail({
          email: user.email,
          firstName: user.first_name || '',
          userId: profile.user_id,
          missingFields,
          optoutToken,
          notificationType: stage.notificationType,
        })

        sent++
      } catch (e) {
        Sentry.captureException(e, {
          tags: { flow: 'relance_onboarding_cron', stage: stage.notificationType },
        })
        skipped++
      }
    }

    stageReports.push({ stage: stage.notificationType, sent, skipped })
    totalSent += sent
    totalSkipped += skipped
  }

  return NextResponse.json({ sent: totalSent, skipped: totalSkipped, stages: stageReports })
}
