import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { getSubscriptionStatus, hasActiveSubscription } from '@/lib/subscription-helpers'
import { sendParrainageRecompense } from '@/lib/emails'

const BATCH_LIMIT = 200
const RECOMPENSE_PALIER = 5

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = await createClient({ serviceRole: true })

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: parrainages, error: queryErr } = await supabase
    .from('parrainages')
    .select('id, marraine_id, filleule_id, filleule_abonnee_at')
    .eq('statut', 'abonnee')
    .lte('filleule_abonnee_at', cutoff)
    .limit(BATCH_LIMIT)

  if (queryErr) {
    console.error('[cron_confirm_parrainages][query_error]', queryErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let processed = 0
  let confirmed = 0
  let rewards = 0
  let skipped = 0
  let errors = 0

  if (!parrainages || parrainages.length === 0) {
    return NextResponse.json({ processed, confirmed, rewards, skipped, errors })
  }

  for (const row of parrainages) {
    processed++

    try {
      // 1. Vérifier que la filleule a toujours un abonnement Stripe actif
      const filleuleActive = await hasActiveSubscription(row.filleule_id)
      if (!filleuleActive) {
        // H6 (code review 2026-04-29) : la filleule a annulé entre J+0 et J+30.
        // On transitionne le parrainage vers 'expire' au lieu de juste skip,
        // sinon la row reste éternellement en 'abonnee' et sature le batch
        // chaque jour. 'expire' n'est pas dans l'index unique partiel, donc
        // libère l'unicité (la filleule pourrait re-souscrire avec un autre
        // code plus tard).
        const { error: expireErr } = await supabase
          .from('parrainages')
          .update({ statut: 'expire', expire_at: new Date().toISOString() })
          .eq('id', row.id)
          .eq('statut', 'abonnee')
        if (expireErr) {
          console.error('[cron_confirm_parrainages][expire_error]', { id: row.id, err: expireErr })
          errors++
          continue
        }
        skipped++
        continue
      }

      // 2. Pré-check : la marraine doit avoir un code parrainages_codes existant.
      const { data: codeRow, error: codeReadErr } = await supabase
        .from('parrainages_codes')
        .select('compteur_confirmes, total_recompenses, code')
        .eq('user_id', row.marraine_id)
        .maybeSingle()

      if (codeReadErr) {
        console.error('[cron_confirm_parrainages][code_read_error]', { marraine_id: row.marraine_id, err: codeReadErr })
        errors++
        continue
      }

      // H9 (code review 2026-04-29) : conformer à la spec 2.4 AC1.3 — si pas
      // de code parrainages_codes pour la marraine (cas atypique, marraine
      // pré-feature non backfillée ou supprimée), on confirme quand même le
      // parrainage et on skip seulement le compteur. Sinon, le parrainage
      // reste en 'abonnee' indéfiniment et est re-traité chaque jour.
      if (!codeRow) {
        console.error('[cron_confirm_parrainages][missing_code]', { marraine_id: row.marraine_id, parrainage_id: row.id })
        const { data: confirmedNoCount, error: noCountErr } = await supabase
          .from('parrainages')
          .update({ statut: 'confirme', confirme_at: new Date().toISOString() })
          .eq('id', row.id)
          .eq('statut', 'abonnee')
          .select('id')
        if (noCountErr) {
          console.error('[cron_confirm_parrainages][confirm_no_count_error]', { id: row.id, err: noCountErr })
        } else if (confirmedNoCount && confirmedNoCount.length === 1) {
          confirmed++
        }
        errors++
        continue
      }

      // 3. Compare-and-swap idempotent : abonnee -> confirme
      const { data: swapped, error: swapErr } = await supabase
        .from('parrainages')
        .update({ statut: 'confirme', confirme_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('statut', 'abonnee')
        .select('id')

      if (swapErr) {
        console.error('[cron_confirm_parrainages][swap_error]', { id: row.id, err: swapErr })
        errors++
        continue
      }

      if (!swapped || swapped.length === 0) {
        // Concurrent ou rejeu : déjà confirmé
        skipped++
        continue
      }

      confirmed++

      // 4. Increment compteur via RPC atomique Postgres (C2/H7 code review
      // 2026-04-29). Remplace l'ancien CAS read-then-write qui pouvait
      // perdre des incréments en cas d'overlap cron : UPDATE x = x + 1
      // RETURNING est garanti atomique par Postgres.
      const { data: newCompteur, error: incErr } = await supabase
        .rpc('parrainage_increment_compteur', { p_marraine_id: row.marraine_id })

      if (incErr || newCompteur == null) {
        console.error('[cron_confirm_parrainages][increment_error]', {
          marraine_id: row.marraine_id,
          err: incErr,
        })
        errors++
        continue
      }

      // 5. Trigger récompense si palier atteint
      if (newCompteur < RECOMPENSE_PALIER) continue

      // Pré-check abonnement marraine
      const marraineSub = await getSubscriptionStatus(row.marraine_id)
      if (!marraineSub.active || !marraineSub.stripeSubscriptionId) {
        console.warn('[cron_confirm_parrainages][marraine_no_active_sub]', { marraine_id: row.marraine_id })
        continue
      }

      // D4 (code review 2026-04-29) : skipper si la marraine est en trial ;
      // sinon le coupon 6 mois s'applique en plus du trial gratuit (over-spec).
      // Le cron repasse chaque jour, la récompense sera traitée au premier
      // passage en 'active'.
      if (marraineSub.status === 'trialing') {
        console.info('[cron_confirm_parrainages][skip_trialing]', { marraine_id: row.marraine_id })
        continue
      }

      // M1 : skipper si la marraine a déjà demandé l'annulation à la fin de
      // période. Un coupon attaché à un sub qui se ferme dans N jours est
      // gaspillé, et l'email "6 mois offerts" mentirait.
      if (marraineSub.cancelAt) {
        console.info('[cron_confirm_parrainages][skip_cancel_at_period_end]', { marraine_id: row.marraine_id })
        continue
      }

      // M3 : re-vérifier que le statut de validation de la marraine est
      // toujours 'valide' (peut avoir été révoqué par l'admin entre J+0 et J+30).
      const { data: marraineProfile } = await supabase
        .from('accompagnantes_profiles')
        .select('validation_status')
        .eq('user_id', row.marraine_id)
        .single()
      if (marraineProfile?.validation_status !== 'valide') {
        console.warn('[cron_confirm_parrainages][marraine_not_valid]', {
          marraine_id: row.marraine_id,
          validation_status: marraineProfile?.validation_status ?? null,
        })
        continue
      }

      // Charger l'email de la marraine pour le coupon name + l'email
      const { data: marraineUser } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('id', row.marraine_id)
        .single()

      if (!marraineUser?.email) {
        console.error('[cron_confirm_parrainages][marraine_no_email]', { marraine_id: row.marraine_id })
        errors++
        continue
      }

      // C2/H7 (code review 2026-04-29) : claim atomique du palier AVANT
      // toute interaction Stripe. Si deux runs cron concurrents passent
      // ici avec compteur >= 5, un seul réussira le claim ; l'autre se
      // verra retourner claimed=false et passera son tour. Plus de risque
      // de coupon créé sans tracking BDD ou de double-application.
      const { data: claimRows, error: claimErr } = await supabase
        .rpc('parrainage_claim_recompense', {
          p_marraine_id: row.marraine_id,
          p_palier: RECOMPENSE_PALIER,
        })

      if (claimErr) {
        console.error('[cron_confirm_parrainages][claim_error]', { marraine_id: row.marraine_id, err: claimErr })
        errors++
        continue
      }

      const claimResult = Array.isArray(claimRows) ? claimRows[0] : claimRows
      if (!claimResult?.claimed) {
        // Un autre run a déjà claim ce palier (overlap cron rare). Le
        // compteur est dans un état cohérent (decrémenté de RECOMPENSE_PALIER
        // par l'autre run). On skip cette itération sans error pour ne pas
        // alerter à tort.
        console.info('[cron_confirm_parrainages][claim_already_consumed]', { marraine_id: row.marraine_id })
        continue
      }

      const newTotalRecompenses = claimResult.total_recompenses

      try {
        // L5 : libellé conforme spec 2.4 AC2.
        // L6 : marraine.id.slice(0,8) au lieu d'email tronqué pour éviter les
        // collisions (deux emails longs partageant le même préfixe).
        const couponName = `Recompense parrainage - ${row.marraine_id.slice(0, 8)}`
        const coupon = await stripe.coupons.create({
          percent_off: 100,
          duration: 'repeating',
          duration_in_months: 6,
          name: couponName,
          metadata: { user_id: row.marraine_id, type: 'parrainage_recompense' },
        })

        // D3 (code review 2026-04-29) : Dev Notes 2.4 ratifient le remplacement
        // (Stripe écrase l'array discounts complet sur subscriptions.update).
        await stripe.subscriptions.update(marraineSub.stripeSubscriptionId, {
          discounts: [{ coupon: coupon.id }],
        })

        await supabase.from('admin_actions_log').insert({
          admin_id: null,
          action_type: 'parrainage_recompense_appliquee',
          target_type: 'subscription',
          target_id: row.marraine_id,
          details: {
            coupon_id: coupon.id,
            marraine_id: row.marraine_id,
            total_recompenses: newTotalRecompenses,
          },
        })

        await sendParrainageRecompense({
          email: marraineUser.email,
          firstName: marraineUser.first_name || '',
          totalRecompenses: newTotalRecompenses,
          userId: row.marraine_id,
        })

        rewards++
      } catch (stripeErr) {
        // C2/H7 : Stripe a échoué APRÈS le claim BDD. On rollback le claim
        // via une RPC inverse : compteur += palier, total -= 1. Le palier
        // sera re-tenté au prochain cron une fois Stripe dispo.
        console.error('[cron_confirm_parrainages][stripe_apply]', stripeErr)
        const { error: rollbackErr } = await supabase
          .rpc('parrainage_rollback_recompense', {
            p_marraine_id: row.marraine_id,
            p_palier: RECOMPENSE_PALIER,
            p_expected_total: newTotalRecompenses,
          })
        if (rollbackErr) {
          console.error('[cron_confirm_parrainages][rollback_failed]', {
            marraine_id: row.marraine_id,
            err: rollbackErr,
          })
        }
        errors++
      }
    } catch (loopErr) {
      console.error('[cron_confirm_parrainages][loop_error]', { id: row.id, err: loopErr })
      errors++
    }
  }

  return NextResponse.json({ processed, confirmed, rewards, skipped, errors })
}
