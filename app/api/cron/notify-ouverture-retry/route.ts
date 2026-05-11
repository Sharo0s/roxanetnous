// Safety net partiel post-migration story 4.3 (queue durable Vercel Workflow
// DevKit). Code review 2026-05-08 P13 : portee du safety net clarifiee.
//
// Ce cron ramasse :
//   (a) les inscriptions tardives apres ouverture dpt (race avec admin trigger),
//   (b) les echecs admin trigger AVANT le compare-and-swap notified_at
//       (queryErr Supabase, dpt non trouve, etc.).
//
// Ce cron NE ramasse PAS :
//   (c) les pannes runtime Workflow apres le swap (job accepte par start()
//       puis perdu par crash runtime). Ces cas sont detectes uniquement via
//       le tag Sentry signal:queue-retry-exhausted cote workflow function.
//
// La decision suppression cron J+30 (Subtask 8.2) repose sur la combinaison :
//   - zero alerte signal:queue-cron-fallback-active (avant-swap, ce cron),
//   - zero alerte signal:queue-retry-exhausted persistante (post-swap, Sentry).
//
// Voir story 4.3 AC9, D6.

import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueOuvertureNotificationEmail } from '@/lib/emails'
import { NOTIFY_OUVERTURE_BATCH_LIMIT } from '@/lib/notify-ouverture'

type LigneAvecDpt = {
  id: string
  email: string
  code_departement: string
  created_at: string
  departements_ouverts: { nom: string; ouvert: boolean } | { nom: string; ouvert: boolean }[] | null
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = await createClient({ serviceRole: true })

  // SELECT lignes non notifiees pour des dpt deja ouverts.
  // Le JOIN garantit qu'on ne notifie pas un dpt qui n'a jamais ete ouvert.
  // Story 4.3 : on inclut created_at pour detecter le backlog persistant >24h
  // (alerte queue-cron-fallback-active).
  const { data: lignes, error: queryErr } = await supabase
    .from('notifications_ouverture')
    .select('id, email, code_departement, created_at, departements_ouverts!inner(nom, ouvert)')
    .is('notified_at', null)
    .eq('departements_ouverts.ouvert', true)
    .limit(NOTIFY_OUVERTURE_BATCH_LIMIT)

  if (queryErr) {
    console.error('[cron_notify_ouverture_retry][query_error]', queryErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  // Code review patch #5 + story 4.3 AC10 : bascule warn -> Sentry pour
  // observabilite (signal:queue-batch-saturation alerte un afflux anormal).
  if (lignes && lignes.length === NOTIFY_OUVERTURE_BATCH_LIMIT) {
    Sentry.captureMessage('Batch notifications ouverture sature (cron retry)', {
      level: 'warning',
      tags: { flow: 'email', signal: 'queue-batch-saturation', severity: 'warning' },
      extra: {
        limit: NOTIFY_OUVERTURE_BATCH_LIMIT,
        processed: lignes.length,
        info: 'backlog persistant possible, surplus repris demain',
      },
    })
  }

  // Story 4.3 AC9 : alerte si lignes detectees AVEC created_at > 24h.
  // Signal d'un dysfonctionnement queue (l'admin trigger initial n'a pas
  // reussi a queue, ou la queue a perdu le job). Permet de detecter les
  // pannes silencieuses pendant la fenetre safety net 30 jours.
  //
  // P8 : count(*) separe sur la meme clause WHERE pour reporter la taille
  // reelle du backlog (le `lignes` est cappee a BATCH_LIMIT=200, donc un
  // backlog de 5k+ lignes serait sous-estime).
  const aged24hThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: aged24hTotal } = await supabase
    .from('notifications_ouverture')
    .select('id, departements_ouverts!inner(ouvert)', { count: 'exact', head: true })
    .is('notified_at', null)
    .eq('departements_ouverts.ouvert', true)
    .lt('created_at', aged24hThreshold)

  const aged24hInBatch = (lignes ?? []).filter((row) => {
    const createdAt = (row as { created_at?: string }).created_at
    if (!createdAt) return false
    return new Date(createdAt).getTime() < Date.now() - 24 * 60 * 60 * 1000
  }).length
  if ((aged24hTotal ?? aged24hInBatch) > 0) {
    Sentry.captureMessage('Backlog notifications ouverture persistant >24h', {
      level: 'warning',
      tags: { flow: 'email', signal: 'queue-cron-fallback-active', severity: 'warning' },
      extra: {
        aged24hTotal: aged24hTotal ?? null,
        aged24hInBatch,
        totalBatch: lignes?.length ?? 0,
      },
    })
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const row of (lignes ?? []) as LigneAvecDpt[]) {
    processed++

    // Code review patch #10 : re-verification JS du filtre ouvert=true.
    // PostgREST !inner avec .eq('embed.col', val) n'est pas garanti cote BDD
    // selon version Supabase JS. Defense en profondeur.
    const dpt = Array.isArray(row.departements_ouverts)
      ? row.departements_ouverts[0]
      : row.departements_ouverts
    if (!dpt || dpt.ouvert !== true) {
      skipped++
      continue
    }

    // Code review patch #21 : nom obligatoire (FK orpheline ou lignes
    // corrompues retomberaient sur "nom = code" UX degradee).
    if (!dpt.nom) {
      console.error('[cron_notify_ouverture_retry][dpt_nom_invalide]', { id: row.id, code: row.code_departement })
      errors++
      continue
    }

    const { data: swapped, error: swapErr } = await supabase
      .from('notifications_ouverture')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('notified_at', null)
      .select('id')

    if (swapErr) {
      console.error('[cron_notify_ouverture_retry][swap_error]', { id: row.id, err: swapErr })
      errors++
      continue
    }
    if (!swapped || swapped.length === 0) {
      skipped++
      continue
    }

    // Story 4.3 : enqueue durable Workflow DevKit. Le cron devient symetrique
    // de l'admin trigger (lib/notify-ouverture.ts) et du fallback synchrone
    // (AC8) reste encapsule dans enqueue*Email.
    try {
      await enqueueOuvertureNotificationEmail({
        email: row.email,
        codeDepartement: row.code_departement,
        nomDepartement: dpt.nom,
      })
      sent++
    } catch (sendErr) {
      console.error('[cron_notify_ouverture_retry][send_error]', { id: row.id, code: row.code_departement, err: sendErr })
      errors++
    }
  }

  console.info('[cron_notify_ouverture_retry] processed=' + processed + ' sent=' + sent + ' skipped=' + skipped + ' errors=' + errors)
  return NextResponse.json({ processed, sent, skipped, errors })
}
