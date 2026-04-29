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
        skipped++
        continue
      }

      // 2. Pré-check : la marraine doit avoir un code parrainages_codes existant.
      // On vérifie AVANT la transition statut pour éviter de figer 'confirme'
      // sur un parrainage qui ne pourra jamais incrémenter le compteur.
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

      if (!codeRow) {
        console.error('[cron_confirm_parrainages][missing_code]', { marraine_id: row.marraine_id, parrainage_id: row.id })
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

      // 4. Increment compteur via compare-and-swap sur la valeur lue : protège
      // contre les overlaps cron (relance Vercel pendant que le précédent run
      // tourne encore) qui pourraient produire un lost-update.
      const oldCompteur = codeRow.compteur_confirmes ?? 0
      const newCompteur = oldCompteur + 1

      const { data: incRows, error: incErr } = await supabase
        .from('parrainages_codes')
        .update({ compteur_confirmes: newCompteur })
        .eq('user_id', row.marraine_id)
        .eq('compteur_confirmes', oldCompteur)
        .select('user_id')

      if (incErr) {
        console.error('[cron_confirm_parrainages][increment_error]', { marraine_id: row.marraine_id, err: incErr })
        errors++
        continue
      }

      if (!incRows || incRows.length === 0) {
        // CAS échoué : le compteur a bougé entre la lecture et l'update.
        // On ne ré-essaie pas dans cette itération pour éviter une boucle ;
        // la transition 'confirme' du parrainage est déjà figée, le compteur
        // sera rattrapé manuellement ou par une procédure dédiée.
        console.warn('[cron_confirm_parrainages][counter_cas_miss]', {
          marraine_id: row.marraine_id,
          expected: oldCompteur,
          parrainage_id: row.id,
        })
        errors++
        continue
      }

      // 4. Trigger récompense si palier atteint
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
        // Cumul abandonné car il permettait d'empiler plusieurs coupons 100%
        // (ex. 5+5 parrainages = 12 mois free) et de re-envoyer des coupons
        // expirés. Un coupon admin pré-existant sera écrasé : l'admin peut
        // le ré-attribuer manuellement si nécessaire.
        await stripe.subscriptions.update(marraineSub.stripeSubscriptionId, {
          discounts: [{ coupon: coupon.id }],
        })

        const oldTotalRecompenses = codeRow.total_recompenses ?? 0
        const newTotalRecompenses = oldTotalRecompenses + 1

        // CAS sur compteur+total_recompenses pour la même raison qu'au step 4 :
        // protège contre une autre instance ayant déjà appliqué la récompense.
        const { data: rewardRows, error: rewardUpdErr } = await supabase
          .from('parrainages_codes')
          .update({
            compteur_confirmes: newCompteur - RECOMPENSE_PALIER,
            total_recompenses: newTotalRecompenses,
            derniere_recompense_at: new Date().toISOString(),
          })
          .eq('user_id', row.marraine_id)
          .eq('compteur_confirmes', newCompteur)
          .eq('total_recompenses', oldTotalRecompenses)
          .select('user_id')

        if (rewardUpdErr || !rewardRows || rewardRows.length === 0) {
          console.error('[cron_confirm_parrainages][reward_cas_miss]', {
            marraine_id: row.marraine_id,
            err: rewardUpdErr,
          })
          // Le coupon Stripe a été créé et appliqué : on log l'action
          // pour que l'incohérence soit visible côté admin.
        }

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
        console.error('[cron_confirm_parrainages][stripe_apply]', stripeErr)
        // On ne décrémente pas le compteur : la prochaine exécution retentera
        errors++
      }
    } catch (loopErr) {
      console.error('[cron_confirm_parrainages][loop_error]', { id: row.id, err: loopErr })
      errors++
    }
  }

  return NextResponse.json({ processed, confirmed, rewards, skipped, errors })
}
