// Story 7.B.2 (F-Epic7-B2) : cron quotidien de purge `notifications_log` > 18 mois.
//
// Politique TTL retention contractualisee par F-Epic7-B1 (DECISIONS.md:859-913)
// et publiee dans politique-de-confidentialite/page.tsx:64-72
// ("Logs de notification email : 18 mois maximum, puis suppression definitive").
//
// La table accumule de la PII visiteurs (`email` souvent renseigne, `subject`
// parfois sensible cote contact form, `data jsonb` pouvant contenir le nom du
// departement). Aucun cron ne purge actuellement -> ce handler comble.
//
// Logique de purge (2 DELETE successifs, cf. AC3 + F-Epic7-B1 ligne 903-904) :
//   1) sent_at < cutoff (rows status='sent' historiquement).
//   2) sent_at IS NULL AND created_at < cutoff (rows pending|failed|error|lost|
//      retry-scheduled|retry-exhausted -- le partial UNIQUE INDEX
//      `notifications_log_unique_sent_by_hour` (status='sent', story 7.A.6)
//      n'empeche pas le DELETE).
//
// Justification calcul cutoff cote JS : `Date.now() - 18 * 30.44 * 24 * 3600 * 1000`
// (approx mois moyens 30.44j) plutot que Postgres `now() - interval '18 months'`
// (calendaire). Le client Supabase JS ne permet pas de chainer un timestamp
// SQL dans .lt() -- une RPC dediee serait l alternative (DDL + risque renamed
// param). L imprecision est negligeable (decalage max ~12h sur 18 mois,
// soit < 0.1% du TTL) pour un cron quotidien : si une row eligible est ratee
// d un jour, elle sera purgee le run suivant (idempotence par construction).
// Si une evolution metier exige la precision calendaire, basculer en RPC
// `supabase.rpc('purge_notifications_log_18m')` -- decision deferee, scope
// hors story 7.B.2.

import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 18 mois approx en millisecondes (mois moyen Gregorien 30.44j).
const PURGE_TTL_MS = 18 * 30.44 * 24 * 60 * 60 * 1000

// Seuil d alerte spike : 1000 rows purgees en 1 nuit = anomalie metier
// (heritage epic-7.md AC4 ligne 385). Documente en commentaire pour reviewer.
const PURGE_SPIKE_THRESHOLD = 1000

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const startedAt = Date.now()
  const cutoff = new Date(startedAt - PURGE_TTL_MS).toISOString()
  const supabase = await createClient({ serviceRole: true })

  // Etape 1 : rows avec sent_at non-null < cutoff (statuts 'sent' historiquement).
  const { data: deletedSent, error: errSent } = await supabase
    .from('notifications_log')
    .delete()
    .lt('sent_at', cutoff)
    .select('id')

  if (errSent) {
    Sentry.captureException(errSent, {
      tags: { flow: 'cron_purge_notifications', signal: 'delete_failed', severity: 'warning' },
      extra: { step: 'delete_sent_at', cutoff },
    })
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
  }

  // Etape 2 : rows avec sent_at IS NULL ET created_at < cutoff.
  // Couvre les statuts non-'sent' (pending|failed|error|lost|retry-scheduled|
  // retry-exhausted). Le partial UNIQUE INDEX `WHERE status='sent'` (7.A.6) ne
  // gene pas le DELETE ici.
  const { data: deletedAged, error: errAged } = await supabase
    .from('notifications_log')
    .delete()
    .is('sent_at', null)
    .lt('created_at', cutoff)
    .select('id')

  if (errAged) {
    Sentry.captureException(errAged, {
      tags: { flow: 'cron_purge_notifications', signal: 'delete_failed', severity: 'warning' },
      extra: { step: 'delete_created_at_null_sent_at', cutoff },
    })
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
  }

  const deletedSentCount = deletedSent?.length ?? 0
  const deletedAgedCount = deletedAged?.length ?? 0
  const purgedCount = deletedSentCount + deletedAgedCount
  const durationMs = Date.now() - startedAt

  // Breadcrumb info systematique (signal vital "le cron tourne"), meme sur no-op.
  Sentry.addBreadcrumb({
    category: 'cron',
    level: 'info',
    message: 'purge-notifications-done',
    data: { purgedCount, durationMs },
  })

  // Alerte spike : > 1000 rows en 1 nuit = anomalie a investiguer.
  if (purgedCount > PURGE_SPIKE_THRESHOLD) {
    Sentry.captureMessage('Pic anormal de purge notifications_log', {
      level: 'warning',
      tags: { flow: 'cron_purge_notifications', signal: 'purge-spike', severity: 'warning' },
      extra: { purgedCount, cutoff, threshold: PURGE_SPIKE_THRESHOLD },
    })
  }

  console.info(
    '[cron_purge_notifications] purgedCount=' + purgedCount + ' durationMs=' + durationMs,
  )

  return NextResponse.json({
    purgedCount,
    deletedSent: deletedSentCount,
    deletedAged: deletedAgedCount,
    cutoff,
  })
}
