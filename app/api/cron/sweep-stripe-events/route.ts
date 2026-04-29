import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// L7 (code review 2026-04-29) : sweep de stripe_events_processed.
// Stripe rejoue les events pendant ~24h max après leur émission. Garder
// les rows plus de 7 jours n'apporte aucune valeur d'idempotence et fait
// croître la table indéfiniment. Cron quotidien qui purge tout ce qui
// dépasse 7 jours.
const RETENTION_DAYS = 7

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = await createClient({ serviceRole: true })

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error, count } = await supabase
    .from('stripe_events_processed')
    .delete({ count: 'exact' })
    .lt('processed_at', cutoff)

  if (error) {
    console.error('[cron_sweep_stripe_events]', error)
    return NextResponse.json({ error: 'sweep_failed' }, { status: 500 })
  }

  return NextResponse.json({ deleted: count ?? 0, cutoff })
}
