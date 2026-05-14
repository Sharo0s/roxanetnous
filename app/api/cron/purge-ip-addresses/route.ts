// Story 7.B.3 (F-Epic7-B1) : cron quotidien d anonymisation des IP visiteur
// stockees dans `parrainages.ip_inscription` (> 2 ans) et
// `notifications_ouverture.ip_inscription` (> 6 mois).
//
// Politique TTL retention contractualisee par F-Epic7-B1 (DECISIONS.md:859-913)
// et publiee dans politique-de-confidentialite/page.tsx (alignee par 7.B.1
// commit 3c94ae3). Cette story execute la decision en mode anonymisation
// in-place : UPDATE SET ip_inscription = NULL. Les autres colonnes
// (marraine_id, stripe_fingerprint, code cote parrainages ; email,
// code_departement cote notifications_ouverture) sont preservees pour l audit
// anti-fraude et le flux de notification d ouverture du departement.
//
// Logique d anonymisation (2 UPDATE successifs, cf. F-Epic7-B1 lignes 904-906) :
//   1) parrainages : ip_inscription anonymise si created_at < now - 2 ans.
//   2) notifications_ouverture : ip_inscription anonymise si created_at < now - 6 mois.
//
// Idempotence par construction : le filtre WHERE
//   `created_at < cutoff AND ip_inscription IS NOT NULL`
// rend chaque run idempotent. Une row anonymisee au run N est exclue au run N+1
// (ip_inscription IS NULL). Le filtre `.not('ip_inscription', 'is', null)` est
// indispensable : sans lui, les rows deja anonymisees seraient re-UPDATE
// (NULL -> NULL), gonflant artificiellement les counts et cassant l idempotence
// observable.
//
// Justification calcul cutoff cote JS : `Date.now() - N * ms_per_unit`
// (approx 30.44j/mois et 365.25j/an) plutot que Postgres `now() - interval`
// (calendaire). Le client Supabase JS ne permet pas de chainer un timestamp
// SQL dans .lt() -- une RPC dediee serait l alternative (DDL + risque renamed
// param, decision deferee comme 7.B.2 AC3). L imprecision est negligeable :
// ~12h sur 6 mois = 0.27%, ~6h sur 2 ans = 0.03%. Pour un cron quotidien, une
// row eligible ratee d un jour est anonymisee au run suivant.
//
// Hors-scope : pas de DELETE physique, pas d endpoint admin delete-pii (decision
// F-Epic7-B1 : non avant 5 demandes/an), pas de modification des helpers
// app/actions/parrainage.ts et app/actions/notifications-ouverture.ts (les
// INSERT IP applicatifs restent intacts), pas de migration BDD (les colonnes
// ip_inscription sont deja NULLABLE).

import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// TTL approx en millisecondes (annee solaire 365.25j ; mois moyen Gregorien
// 30.44j).
const PARRAINAGES_TTL_MS = 2 * 365.25 * 24 * 60 * 60 * 1000
const NOTIFICATIONS_OUVERTURE_TTL_MS = 6 * 30.44 * 24 * 60 * 60 * 1000

// Seuil d alerte spike : 100 IPs anonymisees en 1 nuit = anomalie (volumetrie
// attendue : quelques rows/mois). Seuil plus bas que purge-notifications (1000)
// car ces 2 tables IP sont 10x moins denses.
const PURGE_SPIKE_THRESHOLD = 100

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const startedAt = Date.now()
  const cutoffParrainages = new Date(startedAt - PARRAINAGES_TTL_MS).toISOString()
  const cutoffWaitlist = new Date(startedAt - NOTIFICATIONS_OUVERTURE_TTL_MS).toISOString()
  const supabase = await createClient({ serviceRole: true })

  // Etape 1 : parrainages.ip_inscription anonymisable > 2 ans. Le filtre
  // .not('ip_inscription', 'is', null) preserve l idempotence (cf. en-tete).
  const { data: anonParrainages, error: errParr } = await supabase
    .from('parrainages')
    .update({ ip_inscription: null })
    .lt('created_at', cutoffParrainages)
    .not('ip_inscription', 'is', null)
    .select('id')

  if (errParr) {
    Sentry.captureException(errParr, {
      tags: { flow: 'cron_purge_ip_addresses', signal: 'update_failed', severity: 'warning' },
      extra: { step: 'update_parrainages', cutoff: cutoffParrainages },
    })
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
  }

  // Etape 2 : notifications_ouverture.ip_inscription anonymisable > 6 mois.
  const { data: anonWaitlist, error: errWait } = await supabase
    .from('notifications_ouverture')
    .update({ ip_inscription: null })
    .lt('created_at', cutoffWaitlist)
    .not('ip_inscription', 'is', null)
    .select('id')

  if (errWait) {
    Sentry.captureException(errWait, {
      tags: { flow: 'cron_purge_ip_addresses', signal: 'update_failed', severity: 'warning' },
      extra: { step: 'update_notifications_ouverture', cutoff: cutoffWaitlist },
    })
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
  }

  const anonymizedParrainages = anonParrainages?.length ?? 0
  const anonymizedWaitlist = anonWaitlist?.length ?? 0
  const anonymizedTotal = anonymizedParrainages + anonymizedWaitlist
  const durationMs = Date.now() - startedAt

  // Breadcrumb info systematique (signal vital "le cron tourne"), meme sur no-op.
  Sentry.addBreadcrumb({
    category: 'cron',
    level: 'info',
    message: 'purge-ip-addresses-done',
    data: { anonymizedParrainages, anonymizedWaitlist, anonymizedTotal, durationMs },
  })

  // Alerte spike : > 100 IPs anonymisees en 1 nuit = anomalie a investiguer.
  if (anonymizedTotal > PURGE_SPIKE_THRESHOLD) {
    Sentry.captureMessage('Pic anormal d anonymisation IP', {
      level: 'warning',
      tags: { flow: 'cron_purge_ip_addresses', signal: 'purge-spike', severity: 'warning' },
      extra: {
        anonymizedParrainages,
        anonymizedWaitlist,
        anonymizedTotal,
        cutoffParrainages,
        cutoffWaitlist,
        threshold: PURGE_SPIKE_THRESHOLD,
      },
    })
  }

  console.info(
    '[cron_purge_ip_addresses] anonymizedParrainages=' +
      anonymizedParrainages +
      ' anonymizedWaitlist=' +
      anonymizedWaitlist +
      ' durationMs=' +
      durationMs,
  )

  return NextResponse.json({
    anonymizedTotal,
    anonymizedParrainages,
    anonymizedWaitlist,
    cutoffParrainages,
    cutoffWaitlist,
  })
}
