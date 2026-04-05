import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendExpirationReminderEmail } from '@/lib/emails'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const supabase = await createClient({ serviceRole: true })

  // Trouver les abonnements avec cancel_at dans les 3 prochains jours
  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('user_id, cancel_at')
    .eq('status', 'active')
    .not('cancel_at', 'is', null)
    .lte('cancel_at', threeDaysFromNow.toISOString())
    .gte('cancel_at', now.toISOString())

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 })
  }

  let sent = 0
  let skipped = 0

  // Deduplication : verifier notifications des 7 derniers jours
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  for (const sub of subscriptions) {
    try {
      // Check deduplication
      const { data: recentNotif } = await supabase
        .from('notifications_log')
        .select('id')
        .eq('user_id', sub.user_id)
        .eq('type', 'expiration_reminder')
        .gte('sent_at', sevenDaysAgo)
        .limit(1)

      if (recentNotif && recentNotif.length > 0) {
        skipped++
        continue
      }

      // Recuperer les infos utilisateur
      const { data: userData } = await supabase
        .from('users')
        .select('email, first_name, role')
        .eq('id', sub.user_id)
        .single()

      if (!userData) {
        skipped++
        continue
      }

      await sendExpirationReminderEmail({
        email: userData.email,
        firstName: userData.first_name || '',
        expirationDate: sub.cancel_at!,
        role: userData.role as 'accompagnante' | 'accompagne',
        userId: sub.user_id,
      })

      sent++
    } catch {
      skipped++
    }
  }

  return NextResponse.json({ sent, skipped })
}
