import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendDisponibleReactivatedEmail } from '@/lib/emails'
import { notifyFavoriAccompagnes } from '@/lib/notify-favori-disponible'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = await createClient({ serviceRole: true })

  // Trouver les accompagnantes dont la date de retour est passee
  const { data: profiles } = await supabase
    .from('accompagnants_profiles')
    .select('user_id')
    .eq('disponible', false)
    .not('indisponible_jusqu_au', 'is', null)
    .lte('indisponible_jusqu_au', new Date().toISOString().split('T')[0])

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ success: true, reactivated: 0 })
  }

  const userIds = profiles.map((p) => p.user_id)

  // Reactiver les profils
  await supabase
    .from('accompagnants_profiles')
    .update({ disponible: true, indisponible_jusqu_au: null })
    .in('user_id', userIds)

  // Mettre a jour badges_cache
  await supabase
    .from('badges_cache')
    .update({ disponible: true, updated_at: new Date().toISOString() })
    .in('user_id', userIds)

  // Recuperer les infos des accompagnantes pour les mails
  const { data: users } = await supabase
    .from('users')
    .select('id, email, first_name')
    .in('id', userIds)

  for (const user of users || []) {
    // Mail a l'accompagnante
    await sendDisponibleReactivatedEmail({
      email: user.email,
      firstName: user.first_name || 'Bonjour',
      userId: user.id,
    })

    // Mail aux accompagnes qui l'ont en favori
    await notifyFavoriAccompagnes(user.id)
  }

  return NextResponse.json({ success: true, reactivated: userIds.length })
}
