import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@supabase/ssr'
import {
  sendSubscriptionConfirmEmail,
  sendSubscriptionCancelEmail,
  sendPlanChangeEmail,
  sendRenewalReminderEmail,
  sendAdminParrainageFlag,
  sendParrainageVerificationEmail,
} from '@/lib/emails'
import { revokeFilleuleValidationFromWebhook } from '@/app/actions/parrainage'
import { normalizeAddress } from '@/lib/parrainage-detection'
import { triggerAccompagneCodeGenesisIfEligible } from '@/lib/parrainage-codes'
import type Stripe from 'stripe'

function getSupabaseAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}

// Aligné sur normalizeCode dans app/actions/parrainage.ts : la metadata Stripe
// peut contenir des espaces/casse différentes si elle a été éditée à la main.
function normalizeParrainageCode(input: string): string {
  return (input || '').toUpperCase().replace(/[\s-]/g, '')
}

// Story 2.3 AC3 : second passage de détection après capture du fingerprint.
// Recherche `meme_carte` (BLOCAGE) et `meme_adresse` (FLAG). Concaténation CSV
// avec un éventuel flag `meme_ip` déjà posé au signup.
async function detectBlacklistAtWebhook(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  parrainage: {
    id: string
    marraine_id: string
    filleule_id: string | null
    stripe_fingerprint: string | null
    flag_suspicion: string | null
  },
): Promise<void> {
  try {
    if (!parrainage.filleule_id) return

    // 1) Détection meme_adresse (FLAG).
    // Le filleul est toujours accompagnant (guard createParrainageRelation).
    // Le parrain peut être accompagnant (accompagnants_profiles) ou accompagné
    // (accompagnes_profiles) — on lit les deux tables et on prend la première non-null.
    const [
      { data: marraineAccProfile },
      { data: marraineAceProfile },
      { data: filleuleProfile },
    ] = await Promise.all([
      supabase
        .from('accompagnants_profiles')
        .select('adresse')
        .eq('user_id', parrainage.marraine_id)
        .maybeSingle(),
      supabase
        .from('accompagnes_profiles')
        .select('adresse')
        .eq('user_id', parrainage.marraine_id)
        .maybeSingle(),
      supabase
        .from('accompagnants_profiles')
        .select('adresse')
        .eq('user_id', parrainage.filleule_id)
        .maybeSingle(),
    ])

    const marraineAddr = normalizeAddress(
      (marraineAccProfile?.adresse as string) || (marraineAceProfile?.adresse as string) || '',
    )
    const filleuleAddr = normalizeAddress((filleuleProfile?.adresse as string) || '')
    const adresseMatch =
      marraineAddr.length > 0 && filleuleAddr.length > 0 && marraineAddr === filleuleAddr

    // 2) Détection meme_carte (BLOCAGE) via stripe_fingerprint
    let carteMatch = false
    if (parrainage.stripe_fingerprint) {
      // Recherche dans parrainages : la marraine a-t-elle ce fingerprint
      // (en tant que filleule d'une ancienne row, ou via une autre filleule à elle).
      // Deux requêtes séparées pour éviter l'interpolation de l'UUID dans .or()
      // (anti-pattern PostgREST si une valeur non-validée se retrouve dans la chaîne).
      const [{ data: matchAsMarraine }, { data: matchAsFilleule }] = await Promise.all([
        supabase
          .from('parrainages')
          .select('id')
          .eq('stripe_fingerprint', parrainage.stripe_fingerprint)
          .neq('id', parrainage.id)
          .eq('marraine_id', parrainage.marraine_id)
          .limit(1),
        supabase
          .from('parrainages')
          .select('id')
          .eq('stripe_fingerprint', parrainage.stripe_fingerprint)
          .neq('id', parrainage.id)
          .eq('filleule_id', parrainage.marraine_id)
          .limit(1),
      ])
      if (
        (matchAsMarraine && matchAsMarraine.length > 0) ||
        (matchAsFilleule && matchAsFilleule.length > 0)
      ) {
        carteMatch = true
      }

      // Fallback : si pas de match en BDD, on consulte l'API Stripe pour les
      // cartes attachées au customer de la marraine.
      if (!carteMatch) {
        const { data: marraineSub } = await supabase
          .from('subscriptions')
          .select('stripe_customer_id')
          .eq('user_id', parrainage.marraine_id)
          .maybeSingle()
        const customerId = (marraineSub?.stripe_customer_id as string) || null
        if (customerId) {
          try {
            // P8 (code review 2026-05-04) : limit=100 (max Stripe) pour
            // couvrir les marraines avec plusieurs cartes attachées. Le
            // fallback charges historiques (ligne ~129) couvre déjà le cas
            // où une carte aurait été détachée, mais autant maximiser la
            // détection ici aussi.
            const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 100 })
            for (const pm of pms.data) {
              if (pm.card?.fingerprint === parrainage.stripe_fingerprint) {
                carteMatch = true
                break
              }
            }
          } catch (err) {
            console.error('[parrainage_blacklist][webhook][stripe_lookup]', err)
            Sentry.captureException(err, {
              tags: { flow: 'webhook-stripe', signal: 'pm-list-failed', severity: 'warning' },
              extra: { parrainageId: parrainage.id, customerId },
            })
          }

          // M10 (code review 2026-04-29) : fallback supplémentaire sur les
          // charges historiques. paymentMethods.list ne retourne que les PM
          // ATTACHES au customer ; une fraudeuse peut avoir détaché sa carte
          // entre son inscription et celle de la filleule. Les charges
          // gardent une trace immuable.
          if (!carteMatch) {
            try {
              const charges = await stripe.charges.list({ customer: customerId, limit: 100 })
              for (const charge of charges.data) {
                const pmDetails = (charge.payment_method_details as { card?: { fingerprint?: string } } | null)
                if (pmDetails?.card?.fingerprint === parrainage.stripe_fingerprint) {
                  carteMatch = true
                  break
                }
              }
            } catch (err) {
              console.error('[parrainage_blacklist][webhook][charges_lookup]', err)
              Sentry.captureException(err, {
                tags: { flow: 'webhook-stripe', signal: 'charges-list-failed', severity: 'warning' },
                extra: { parrainageId: parrainage.id, customerId },
              })
            }
          }
        }
      }
    }

    if (!carteMatch && !adresseMatch) return

    // Charger les noms pour l'email admin
    const [{ data: marraineUser }, { data: filleuleUser }] = await Promise.all([
      supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', parrainage.marraine_id)
        .maybeSingle(),
      supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', parrainage.filleule_id)
        .maybeSingle(),
    ])
    const marraineName =
      `${marraineUser?.first_name || ''} ${marraineUser?.last_name || ''}`.trim() || 'Parrain'
    const filleuleName =
      `${filleuleUser?.first_name || ''} ${filleuleUser?.last_name || ''}`.trim() || 'Filleul'

    // P12 (code review 2026-05-04) : si meme_carte ET meme_adresse, on pose
    // d'abord le flag adresse (traçabilité historique) AVANT de bloquer sur
    // carte. Sinon le `return` après blocage carte ferait perdre le signal
    // adresse, masquant un pattern fraude double.
    if (carteMatch && adresseMatch) {
      const { error: mergeErr } = await supabase
        .rpc('merge_parrainage_flag_suspicion', {
          p_parrainage_id: parrainage.id,
          p_flag: 'meme_adresse',
        })
      if (mergeErr) {
        console.error('[parrainage_blacklist][webhook][merge_adresse_avant_carte]', mergeErr)
        Sentry.captureException(mergeErr, {
          tags: { flow: 'webhook-stripe', signal: 'merge-adresse-avant-carte', severity: 'critical' },
          extra: { parrainageId: parrainage.id },
        })
      }
    }

    if (carteMatch) {
      // Compare-and-swap : ne déclencher email/log que si on est le premier à passer la
      // row en bloque (idempotence en cas de redelivery webhook ou race avec admin).
      const { data: updatedRows, error: updateErr } = await supabase
        .from('parrainages')
        .update({ statut: 'bloque', blocage_raison: 'meme_carte' })
        .eq('id', parrainage.id)
        .in('statut', ['inscrite', 'abonnee'])
        .is('blocage_raison', null)
        .select('id')
      if (updateErr) {
        console.error('[parrainage_blacklist][webhook][update_carte]', updateErr)
        Sentry.captureException(updateErr, {
          tags: { flow: 'webhook-stripe', signal: 'update-bloque-carte', severity: 'critical' },
          extra: { parrainageId: parrainage.id, raison: 'meme_carte' },
        })
        return
      }
      if (!updatedRows || updatedRows.length === 0) return

      await revokeFilleuleValidationFromWebhook(parrainage.filleule_id, 'webhook_meme_carte', {
        parrainageId: parrainage.id,
        marraineId: parrainage.marraine_id,
        internalSecret: process.env.PARRAINAGE_INTERNAL_SECRET,
      })

      const { error: logErr } = await supabase.from('admin_actions_log').insert({
        admin_id: null,
        action_type: 'parrainage_bloque',
        target_type: 'parrainage',
        target_id: parrainage.id,
        details: {
          marraine_id: parrainage.marraine_id,
          filleule_id: parrainage.filleule_id,
          raison: 'meme_carte',
          flag_adresse_pose: adresseMatch,
        },
      })
      if (logErr) {
        console.error('[parrainage_blacklist][webhook][log_carte]', logErr)
        Sentry.captureException(logErr, {
          tags: { flow: 'webhook-stripe', signal: 'log-bloque-carte', severity: 'critical' },
          extra: { parrainageId: parrainage.id, raison: 'meme_carte' },
        })
      }

      try {
        await sendAdminParrainageFlag({
          marraineName,
          filleuleName,
          type: 'meme_carte',
          parrainageId: parrainage.id,
        })
      } catch (err) {
        console.error('[parrainage_blacklist][webhook][email]', err)
        Sentry.captureException(err, {
          tags: { flow: 'webhook-stripe', signal: 'email-flag-carte', severity: 'warning' },
          extra: { parrainageId: parrainage.id, type: 'meme_carte' },
        })
      }
      return
    }

    if (adresseMatch) {
      // M4 : RPC atomique côté Postgres. Évite la perte de flags concurrents
      // que le précédent compare-and-swap manquait silencieusement.
      // was_added=true uniquement si le flag n'était pas déjà présent ->
      // sert de garde anti-double-email/log sur redelivery.
      const { data: mergeResult, error: mergeErr } = await supabase
        .rpc('merge_parrainage_flag_suspicion', {
          p_parrainage_id: parrainage.id,
          p_flag: 'meme_adresse',
        })
        .select('was_added')
        .maybeSingle()

      if (mergeErr) {
        console.error('[parrainage_blacklist][webhook][merge_adresse]', mergeErr)
        Sentry.captureException(mergeErr, {
          tags: { flow: 'webhook-stripe', signal: 'merge-adresse', severity: 'critical' },
          extra: { parrainageId: parrainage.id },
        })
        return
      }
      if (!mergeResult || !mergeResult.was_added) return

      const { error: logErr } = await supabase.from('admin_actions_log').insert({
        admin_id: null,
        action_type: 'parrainage_flag',
        target_type: 'parrainage',
        target_id: parrainage.id,
        details: {
          marraine_id: parrainage.marraine_id,
          filleule_id: parrainage.filleule_id,
          flag: 'meme_adresse',
        },
      })
      if (logErr) {
        console.error('[parrainage_blacklist][webhook][log_adresse]', logErr)
        Sentry.captureException(logErr, {
          tags: { flow: 'webhook-stripe', signal: 'log-flag-adresse', severity: 'critical' },
          extra: { parrainageId: parrainage.id, flag: 'meme_adresse' },
        })
      }

      try {
        await sendAdminParrainageFlag({
          marraineName,
          filleuleName,
          type: 'meme_adresse',
          parrainageId: parrainage.id,
        })
      } catch (err) {
        console.error('[parrainage_blacklist][webhook][email]', err)
        Sentry.captureException(err, {
          tags: { flow: 'webhook-stripe', signal: 'email-flag-adresse', severity: 'warning' },
          extra: { parrainageId: parrainage.id, type: 'meme_adresse' },
        })
      }
    }
  } catch (err) {
    console.error('[parrainage_blacklist][webhook]', err)
    Sentry.captureException(err, {
      tags: { flow: 'webhook-stripe', signal: 'detect-blacklist-crashed', severity: 'critical' },
      extra: { parrainageId: parrainage.id },
    })
  }
}

async function captureParrainageFingerprint(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  subscription: Stripe.Subscription,
): Promise<void> {
  try {
    const rawCode = subscription.metadata?.parrainage_code
    const userId = subscription.metadata?.user_id
    if (!rawCode || !userId) return

    const parrainageCode = normalizeParrainageCode(rawCode)
    if (!parrainageCode) return

    // Élargi à 'abonnee' pour gérer la race confirmParrainageOnSuccess (success page)
    // qui peut transitionner inscrite -> abonnee avant l'arrivée du webhook.
    const { data: existingParrainage } = await supabase
      .from('parrainages')
      .select('id, stripe_fingerprint')
      .eq('code', parrainageCode)
      .eq('filleule_id', userId)
      .in('statut', ['inscrite', 'abonnee'])
      .maybeSingle()

    if (!existingParrainage || existingParrainage.stripe_fingerprint != null) return

    const defaultPm = subscription.default_payment_method
    const pmId = typeof defaultPm === 'string' ? defaultPm : defaultPm?.id ?? null
    if (!pmId) return

    let fingerprint: string | null = null
    try {
      const pm = await stripe.paymentMethods.retrieve(pmId)
      fingerprint = pm.card?.fingerprint ?? null
    } catch (pmErr) {
      // Distinguer un échec API Stripe (PM supprimé, perm refusée) d'un autre
      // bug local : log dédié pour faciliter le diagnostic en prod.
      console.error('[parrainage_fingerprint][subscription_updated][pm_retrieve]', { pmId, err: pmErr })
      Sentry.captureException(pmErr, {
        tags: { flow: 'webhook-stripe', signal: 'pm-retrieve-failed', severity: 'warning' },
        extra: { parrainageId: existingParrainage.id, pmId },
      })
      return
    }
    if (!fingerprint) {
      // M6/M7 : flag d'audit pour permettre une revue admin manuelle.
      await supabase.rpc('merge_parrainage_flag_suspicion', {
        p_parrainage_id: existingParrainage.id,
        p_flag: 'fingerprint_indisponible',
      })
      return
    }

    await supabase
      .from('parrainages')
      .update({ stripe_fingerprint: fingerprint })
      .eq('code', parrainageCode)
      .eq('filleule_id', userId)
      .in('statut', ['inscrite', 'abonnee'])
      .is('stripe_fingerprint', null)

    // Story 2.3 AC3 : déclencher le second passage de détection si le parrainage
    // est encore inscrit et sans blocage.
    const { data: refreshedParrainage } = await supabase
      .from('parrainages')
      .select('id, marraine_id, filleule_id, stripe_fingerprint, flag_suspicion, statut, blocage_raison')
      .eq('id', existingParrainage.id)
      .maybeSingle()
    if (
      refreshedParrainage &&
      (refreshedParrainage.statut === 'inscrite' || refreshedParrainage.statut === 'abonnee') &&
      !refreshedParrainage.blocage_raison
    ) {
      await detectBlacklistAtWebhook(supabase, {
        id: refreshedParrainage.id,
        marraine_id: refreshedParrainage.marraine_id,
        filleule_id: refreshedParrainage.filleule_id,
        stripe_fingerprint: refreshedParrainage.stripe_fingerprint,
        flag_suspicion: refreshedParrainage.flag_suspicion,
      })
    }
  } catch (err) {
    // best-effort, ne doit jamais bloquer le flow webhook
    console.error('[parrainage_fingerprint][subscription_updated]', err)
    Sentry.captureException(err, {
      tags: { flow: 'webhook-stripe', signal: 'fingerprint-capture-crashed', severity: 'warning' },
      extra: { subscriptionId: subscription.id },
    })
  }
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0]
  return {
    currentPeriodStart: item ? new Date(item.current_period_start * 1000).toISOString() : null,
    currentPeriodEnd: item ? new Date(item.current_period_end * 1000).toISOString() : null,
  }
}

function derivePlanType(priceId: string): 'mensuel' | 'annuel' {
  const annualPrices = [
    process.env.STRIPE_PRICE_AUXILIAIRE_ANNUEL,
    process.env.STRIPE_PRICE_BENEFICIAIRE_ANNUEL,
    process.env.STRIPE_PRICE_ACCOMPAGNANTE_ANNUEL,
    process.env.STRIPE_PRICE_ACCOMPAGNE_ANNUEL,
  ].filter(Boolean)
  const monthlyPrices = [
    process.env.STRIPE_PRICE_AUXILIAIRE_MENSUEL,
    process.env.STRIPE_PRICE_BENEFICIAIRE_MENSUEL,
    process.env.STRIPE_PRICE_ACCOMPAGNANTE_MENSUEL,
    process.env.STRIPE_PRICE_ACCOMPAGNE_MENSUEL,
  ].filter(Boolean)
  if (annualPrices.includes(priceId)) return 'annuel'
  if (monthlyPrices.includes(priceId)) return 'mensuel'
  // Fallback : si le prix ne correspond a aucune env var connue, defaut mensuel
  return 'mensuel'
}

async function hasRecentNotification(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  type: string,
  hoursAgo: number = 24,
): Promise<boolean> {
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('notifications_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('sent_at', since)
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // P12 : idempotence par event.id. Stripe peut rejouer (timeout, retry 24h).
  // INSERT ON CONFLICT DO NOTHING : si la row existe déjà, l'event a été
  // consommé -> on renvoie 200 sans re-traitement (pas de double email,
  // pas de double upsert subscription, pas de re-capture fingerprint).
  const { data: insertedEvent, error: eventInsertErr } = await supabase
    .from('stripe_events_processed')
    .insert({ event_id: event.id, event_type: event.type })
    .select('event_id')
    .maybeSingle()

  if (eventInsertErr && (eventInsertErr as { code?: string }).code !== '23505') {
    console.error('[stripe_webhook][event_insert]', eventInsertErr)
    Sentry.captureException(eventInsertErr, {
      tags: { flow: 'webhook-stripe', signal: 'event-insert-failed', severity: 'critical' },
      extra: { eventId: event.id, eventType: event.type },
    })
    // Si la table elle-même est inaccessible, on bloque pour ne pas
    // perdre l'event ; Stripe rejouera et on aura une nouvelle chance.
    return NextResponse.json({ error: 'idempotency_storage_unavailable' }, { status: 500 })
  }

  if (!insertedEvent) {
    // Déjà traité (conflit 23505 ou row préexistante) : ack et stop.
    return NextResponse.json({ received: true, duplicate: true })
  }

  // C1 (code review 2026-04-29) : la row stripe_events_processed marque
  // notre claim sur l'event. Si le handler crash après l'insert, on
  // compense en supprimant le row pour que Stripe puisse rejouer (sinon
  // l'event est définitivement perdu : Stripe verra un "duplicate" et
  // n'appellera plus jamais).
  try {
    switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.mode !== 'subscription' || !session.subscription || !session.customer) {
        break
      }

      const userId = session.metadata?.user_id
      if (!userId) break

      const subscriptionResponse = await stripe.subscriptions.retrieve(session.subscription as string)
      const period = getSubscriptionPeriod(subscriptionResponse)
      await supabase.from('subscriptions').upsert(
        {
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionResponse.id,
          stripe_price_id: subscriptionResponse.items.data[0]?.price.id || null,
          status: 'active',
          plan_type: session.metadata?.plan || 'mensuel',
          current_period_start: period.currentPeriodStart,
          current_period_end: period.currentPeriodEnd,
          first_subscription_date: new Date().toISOString(),
          cancel_at: null,
          cancelled_at: null,
          cancel_feedback: null,
          cancel_comment: null,
        },
        { onConflict: 'user_id' }
      )

      // Story 8.A.1 : genese du code parrainage accompagne a la 1ere activation
      // d'abonnement. Defensif en interne (filtre role + idempotence), pas de
      // try/catch supplementaire ici (catch global C1 du webhook + Sentry interne).
      await triggerAccompagneCodeGenesisIfEligible({ userId, status: subscriptionResponse.status })

      const rawParrainageCode = session.metadata?.parrainage_code
      const parrainageCode = rawParrainageCode ? normalizeParrainageCode(rawParrainageCode) : null
      if (parrainageCode && userId) {
        try {
          // Court-circuit : si le fingerprint est déjà capturé pour ce parrainage,
          // ne pas refaire d'appel Stripe (économise les appels API en cas de redelivery).
          // Élargi à 'abonnee' pour gérer la race où confirmParrainageOnSuccess
          // (success page) transitionne avant l'arrivée du webhook : aligné sur
          // captureParrainageFingerprint plus haut.
          const { data: existingParrainage } = await supabase
            .from('parrainages')
            .select('id, stripe_fingerprint')
            .eq('code', parrainageCode)
            .eq('filleule_id', userId)
            .in('statut', ['inscrite', 'abonnee'])
            .maybeSingle()

          if (existingParrainage && existingParrainage.stripe_fingerprint == null) {
            // Trial 30j : default_payment_method peut être null au moment du webhook.
            // Fallback sur session.setup_intent.payment_method (présent en mode trial via SetupIntent).
            const defaultPm = subscriptionResponse.default_payment_method
            let pmId: string | null =
              typeof defaultPm === 'string' ? defaultPm : defaultPm?.id ?? null

            if (!pmId && session.setup_intent) {
              const setupIntentId =
                typeof session.setup_intent === 'string'
                  ? session.setup_intent
                  : session.setup_intent.id
              const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
              const siPm = setupIntent.payment_method
              pmId = typeof siPm === 'string' ? siPm : siPm?.id ?? null
            }

            let fingerprint: string | null = null
            if (pmId) {
              const pm = await stripe.paymentMethods.retrieve(pmId)
              fingerprint = pm.card?.fingerprint ?? null
            }

            // WHERE stripe_fingerprint IS NULL : préserve le fingerprint d'inscription
            // contre tout rejeu/changement de carte ultérieur (sémantique anti-fraude).
            if (fingerprint) {
              await supabase
                .from('parrainages')
                .update({ stripe_fingerprint: fingerprint })
                .eq('code', parrainageCode)
                .eq('filleule_id', userId)
                .in('statut', ['inscrite', 'abonnee'])
                .is('stripe_fingerprint', null)
            } else {
              // M6/M7 : malgré la restriction payment_method_types=['card'],
              // un PM peut ne pas exposer card.fingerprint (cas rares : tokenisation
              // wallet, scheme exotique). On flag pour audit admin manuel.
              await supabase.rpc('merge_parrainage_flag_suspicion', {
                p_parrainage_id: existingParrainage.id,
                p_flag: 'fingerprint_indisponible',
              })
            }

            // Story 2.3 AC3 : second passage de détection après capture du fingerprint.
            const { data: refreshedParrainage } = await supabase
              .from('parrainages')
              .select(
                'id, marraine_id, filleule_id, stripe_fingerprint, flag_suspicion, statut, blocage_raison',
              )
              .eq('id', existingParrainage.id)
              .maybeSingle()
            if (
              refreshedParrainage &&
              (refreshedParrainage.statut === 'inscrite' || refreshedParrainage.statut === 'abonnee') &&
              !refreshedParrainage.blocage_raison
            ) {
              await detectBlacklistAtWebhook(supabase, {
                id: refreshedParrainage.id,
                marraine_id: refreshedParrainage.marraine_id,
                filleule_id: refreshedParrainage.filleule_id,
                stripe_fingerprint: refreshedParrainage.stripe_fingerprint,
                flag_suspicion: refreshedParrainage.flag_suspicion,
              })
            }
          }
        } catch (err) {
          // capture fingerprint best-effort, ne doit jamais bloquer le flow webhook principal
          console.error('[parrainage_fingerprint][checkout]', err)
          Sentry.captureException(err, {
            tags: { flow: 'webhook-stripe', signal: 'checkout-fingerprint-crashed', severity: 'warning' },
            extra: { eventId: event.id, userId },
          })
        }
      }

      // Send confirmation email — variante "verification" si le parrainage
      // de cette filleule a ete bloque par la detection anti-fraude juste
      // avant. Sinon, email standard "abonnement actif".
      const { data: userData } = await supabase
        .from('users')
        .select('email, first_name, role')
        .eq('id', userId)
        .single()

      if (userData) {
        // On verifie l'existence d'un parrainage bloque (statut='bloque')
        // pour cet utilisateur avec ce code, dans la fenetre courante.
        let parrainageWasBlocked = false
        if (parrainageCode) {
          const { data: blockedParrainage } = await supabase
            .from('parrainages')
            .select('id')
            .eq('code', parrainageCode)
            .eq('filleule_id', userId)
            .eq('statut', 'bloque')
            .maybeSingle()
          parrainageWasBlocked = !!blockedParrainage
        }

        if (parrainageWasBlocked) {
          await sendParrainageVerificationEmail({
            email: userData.email,
            firstName: userData.first_name || '',
            userId,
          })
        } else {
          await sendSubscriptionConfirmEmail({
            email: userData.email,
            firstName: userData.first_name || '',
            role: userData.role as 'accompagnant' | 'accompagne',
            userId,
          })
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription

      const { data: existing } = await supabase
        .from('subscriptions')
        .select('user_id, stripe_price_id, plan_type')
        .eq('stripe_subscription_id', subscription.id)
        .single()

      if (!existing) break

      const period = getSubscriptionPeriod(subscription)
      const newPriceId = subscription.items.data[0]?.price.id || null
      const newPlanType = newPriceId ? derivePlanType(newPriceId) : existing.plan_type

      // cancellation_details n'est pas typee dans stripe v22.1.1 mais existe au runtime
      // (Stripe API 2024-04-10+). Cast localise vers un shape minimal.
      const cancellation = (subscription as unknown as { cancellation_details?: { reason?: string | null; comment?: string | null; feedback?: string | null } }).cancellation_details
      const updateData: Record<string, unknown> = {
        status: subscription.status === 'active' ? 'active' : subscription.status === 'past_due' ? 'past_due' : subscription.status === 'canceled' ? 'cancelled' : subscription.status,
        current_period_start: period.currentPeriodStart,
        current_period_end: period.currentPeriodEnd,
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        stripe_price_id: newPriceId,
        plan_type: newPlanType,
        cancel_feedback: cancellation?.feedback || null,
        cancel_comment: cancellation?.comment || null,
        updated_at: new Date().toISOString(),
      }

      await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('stripe_subscription_id', subscription.id)

      // Story 8.A.1 : genese du code parrainage accompagne a la 1ere transition
      // status='active'|'trialing'. Idempotent au niveau applicatif (filtre
      // role + maybeSingle sur parrainages_codes), tout rejeu ou re-activation
      // retourne created:false sans renvoyer d'email.
      await triggerAccompagneCodeGenesisIfEligible({
        userId: existing.user_id,
        status: typeof updateData.status === 'string' ? updateData.status : '',
      })

      // Rattrapage capture fingerprint parrainage : en mode trial, le PM peut
      // n'être attaché qu'après checkout.session.completed (via SetupIntent).
      // On retente la capture à chaque update tant que stripe_fingerprint est NULL.
      await captureParrainageFingerprint(supabase, subscription)

      // Detect plan change and send email
      if (newPriceId && existing.stripe_price_id && newPriceId !== existing.stripe_price_id) {
        const oldPlanType = existing.plan_type || 'mensuel'
        const alreadySent = await hasRecentNotification(supabase, existing.user_id, 'plan_change')
        if (!alreadySent) {
          const { data: userData } = await supabase
            .from('users')
            .select('email, first_name, role')
            .eq('id', existing.user_id)
            .single()

          if (userData) {
            await sendPlanChangeEmail({
              email: userData.email,
              firstName: userData.first_name || '',
              oldPlan: oldPlanType,
              newPlan: newPlanType,
              role: userData.role as 'accompagnant' | 'accompagne',
              userId: existing.user_id,
            })
          }
        }
      }

      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      const { data: existing } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

      if (!existing) break
      const deletedUserId = existing.user_id

      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)

      // Send cancellation email
      if (deletedUserId) {
        const { data: userData } = await supabase
          .from('users')
          .select('email, first_name, role')
          .eq('id', deletedUserId)
          .single()

        if (userData) {
          await sendSubscriptionCancelEmail({
            email: userData.email,
            firstName: userData.first_name || '',
            role: userData.role as 'accompagnant' | 'accompagne',
            userId: deletedUserId,
          })
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice

      // invoice.parent shape variable selon Stripe API version. Cast localise vers shape minimal.
      const invoiceParent = invoice.parent as unknown as { subscription_details?: { subscription?: string | { id: string } } } | null
      const subscriptionId = invoiceParent?.subscription_details?.subscription
      if (!subscriptionId) break

      const subId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id

      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subId)

      break
    }

    case 'invoice.upcoming': {
      const invoice = event.data.object as Stripe.Invoice

      const customerId = typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id

      if (!customerId) break

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id, stripe_price_id')
        .eq('stripe_customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!sub) break

      const { data: userData } = await supabase
        .from('users')
        .select('email, first_name, role')
        .eq('id', sub.user_id)
        .single()

      if (!userData) break

      const alreadySent = await hasRecentNotification(supabase, sub.user_id, 'renewal_reminder')
      if (!alreadySent) {
        const amount = (invoice.amount_due ?? 0) / 100
        const periodEnd = invoice.period_end
          ? new Date(invoice.period_end * 1000).toISOString()
          : new Date().toISOString()

        await sendRenewalReminderEmail({
          email: userData.email,
          firstName: userData.first_name || '',
          renewalDate: periodEnd,
          amount,
          role: userData.role as 'accompagnant' | 'accompagne',
          userId: sub.user_id,
        })
      }

      break
    }
  }
  } catch (handlerErr) {
    // C1 : un handler a crash après le claim idempotence. On supprime le
    // row pour que Stripe puisse rejouer (sinon l'event est consommé sans
    // jamais avoir été traité — perte définitive).
    console.error('[stripe_webhook][handler_crashed]', {
      event_id: event.id,
      event_type: event.type,
      error: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
    })
    Sentry.captureException(handlerErr, {
      tags: { flow: 'webhook-stripe', signal: 'handler-crashed', severity: 'critical' },
      extra: { eventId: event.id, eventType: event.type },
    })
    const { error: rollbackErr } = await supabase
      .from('stripe_events_processed')
      .delete()
      .eq('event_id', event.id)
    if (rollbackErr) {
      // Si le rollback du claim échoue, on log et on retourne 500 pour que
      // Stripe rejoue. Risque de double-traitement seulement si le handler
      // s'est partiellement exécuté ET que le rollback échoue : acceptable
      // (les handlers individuels sont déjà idempotents : upsert, RPC, CAS).
      console.error('[stripe_webhook][rollback_failed]', rollbackErr)
      Sentry.captureException(rollbackErr, {
        tags: { flow: 'webhook-stripe', signal: 'rollback-failed', severity: 'critical' },
        extra: { eventId: event.id, eventType: event.type },
      })
    }
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
