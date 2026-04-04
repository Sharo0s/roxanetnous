import { createClient } from '@/lib/supabase/server'
import { calculateMatchScore } from '@/lib/matching'
import { sendMatchingNotificationEmail } from '@/lib/emails'

const MAX_NOTIFICATIONS = 20
const MINIMUM_SCORE = 50

export async function notifyMatchingUsers(params: {
  annonceType: 'accompagnante' | 'accompagne'
  annonceId: string
}): Promise<void> {
  const supabase = await createClient({ serviceRole: true })

  if (params.annonceType === 'accompagne') {
    // Nouvelle annonce accompagne -> notifier les accompagnantes correspondants
    const { data: annonce } = await supabase
      .from('annonces_accompagnes')
      .select('id, titre, specialites_recherchees, ville, code_postal, latitude, longitude, diplome_requis, experience_min, disponibilites, accompagne_id')
      .eq('id', params.annonceId)
      .single()

    if (!annonce) return

    const criteria = {
      specialites_recherchees: annonce.specialites_recherchees as string[],
      ville: annonce.ville,
      code_postal: annonce.code_postal || undefined,
      experience_min: annonce.experience_min || undefined,
      diplome_requis: annonce.diplome_requis || undefined,
      disponibilites: (annonce.disponibilites as Record<string, string[]>) || undefined,
      latitude: annonce.latitude ? Number(annonce.latitude) : undefined,
      longitude: annonce.longitude ? Number(annonce.longitude) : undefined,
    }

    // Recuperer les accompagnantes valides avec abonnement actif
    const { data: auxProfiles } = await supabase
      .from('accompagnantes_profiles')
      .select('user_id, specialites, ville, code_postal, experience, diplomes, disponibilites, rayon_km, latitude, longitude')
      .eq('validation_status', 'valide')

    if (!auxProfiles || auxProfiles.length === 0) return

    // Filtrer les accompagnantes avec abonnement actif
    const userIds = auxProfiles.map((p) => p.user_id).filter(Boolean)
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select('user_id')
      .in('user_id', userIds as string[])
      .in('status', ['active', 'trialing'])

    const activeUserIds = new Set((activeSubs || []).map((s) => s.user_id))

    // Calculer les scores et filtrer
    const matches = auxProfiles
      .filter((p) => activeUserIds.has(p.user_id!))
      .map((p) => {
        const { score } = calculateMatchScore(
          {
            specialites: p.specialites || [],
            ville: p.ville || '',
            code_postal: p.code_postal || '',
            experience: p.experience,
            diplomes: p.diplomes,
            disponibilites: p.disponibilites as Record<string, string[]>,
            rayon_km: p.rayon_km || 10,
            latitude: p.latitude ? Number(p.latitude) : undefined,
            longitude: p.longitude ? Number(p.longitude) : undefined,
          },
          criteria
        )
        return { userId: p.user_id!, score }
      })
      .filter((m) => m.score >= MINIMUM_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_NOTIFICATIONS)

    // Envoyer les emails
    for (const match of matches) {
      const { data: userData } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('id', match.userId)
        .single()

      if (userData?.email) {
        await sendMatchingNotificationEmail({
          email: userData.email,
          firstName: userData.first_name || '',
          type: 'nouvelle_annonce_accompagne',
          annonceTitle: annonce.titre,
          annonceId: annonce.id,
          score: match.score,
          userId: match.userId,
        })
      }
    }
  } else {
    // Nouvelle annonce accompagnante -> notifier les accompagnes qui ont des annonces correspondantes
    const { data: auxAnnonce } = await supabase
      .from('annonces_accompagnantes')
      .select(`
        id, titre, ville, code_postal, rayon_km, disponibilites,
        accompagnantes_profiles:accompagnante_id!inner (
          user_id, specialites, ville, code_postal, experience, diplomes,
          disponibilites, rayon_km, latitude, longitude
        )
      `)
      .eq('id', params.annonceId)
      .single()

    if (!auxAnnonce) return

    const auxProfile = auxAnnonce.accompagnantes_profiles as any

    // Recuperer les annonces accompagnes publiees
    const { data: benAnnonces } = await supabase
      .from('annonces_accompagnes')
      .select('id, titre, specialites_recherchees, ville, code_postal, latitude, longitude, diplome_requis, experience_min, disponibilites, accompagne_id')
      .eq('status', 'publiee')

    if (!benAnnonces || benAnnonces.length === 0) return

    const auxProfileData = {
      specialites: auxProfile.specialites || [],
      ville: auxProfile.ville || auxAnnonce.ville || '',
      code_postal: auxProfile.code_postal || auxAnnonce.code_postal || '',
      experience: auxProfile.experience,
      diplomes: auxProfile.diplomes || [],
      disponibilites: (auxAnnonce.disponibilites || auxProfile.disponibilites) as Record<string, string[]>,
      rayon_km: auxAnnonce.rayon_km || auxProfile.rayon_km || 10,
      latitude: auxProfile.latitude ? Number(auxProfile.latitude) : undefined,
      longitude: auxProfile.longitude ? Number(auxProfile.longitude) : undefined,
    }

    // Calculer les scores pour chaque annonce accompagne
    const matches = benAnnonces
      .map((ann) => {
        const criteria = {
          specialites_recherchees: ann.specialites_recherchees as string[],
          ville: ann.ville,
          code_postal: ann.code_postal || undefined,
          experience_min: ann.experience_min || undefined,
          diplome_requis: ann.diplome_requis || undefined,
          disponibilites: (ann.disponibilites as Record<string, string[]>) || undefined,
          latitude: ann.latitude ? Number(ann.latitude) : undefined,
          longitude: ann.longitude ? Number(ann.longitude) : undefined,
        }
        const { score } = calculateMatchScore(auxProfileData, criteria)
        return { annonceId: ann.id, accompagneId: ann.accompagne_id, titre: ann.titre, score }
      })
      .filter((m) => m.score >= MINIMUM_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_NOTIFICATIONS)

    // Recuperer les user_id des accompagnes
    const accompagneIds = [...new Set(matches.map((m) => m.accompagneId))]
    const { data: benProfiles } = await supabase
      .from('accompagnes_profiles')
      .select('id, user_id')
      .in('id', accompagneIds)

    const benUserMap = new Map((benProfiles || []).map((p) => [p.id, p.user_id]))

    for (const match of matches) {
      const userId = benUserMap.get(match.accompagneId)
      if (!userId) continue

      const { data: userData } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('id', userId)
        .single()

      if (userData?.email) {
        await sendMatchingNotificationEmail({
          email: userData.email,
          firstName: userData.first_name || '',
          type: 'nouveau_profil_accompagnante',
          annonceTitle: auxAnnonce.titre,
          annonceId: auxAnnonce.id,
          score: match.score,
          userId,
        })
      }
    }
  }
}
