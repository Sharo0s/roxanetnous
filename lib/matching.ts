// Algorithme de matching intelligent
// Score sur 100 points base sur 5 criteres

import { haversineDistance } from '@/lib/geocoding'

// Typage aligne sur la BDD prod 2026-05-13 (audit story 6.C.1) :
// les colonnes accompagnants_profiles.* sont quasi toutes nullable (text,
// arrays, jsonb). Le matching doit donc tolerer les valeurs absentes
// plutot que de planter ou penaliser.
export type ExperienceLevel = 'moins_3_ans' | '3_10_ans' | 'plus_10_ans'

type AccompagnantProfile = {
  specialites: string[] | null
  ville: string | null
  code_postal: string | null
  experience: ExperienceLevel | string | null
  diplomes: string[] | null
  disponibilites: Record<string, string[]> | null
  rayon_km: number | null
  latitude?: number | null
  longitude?: number | null
}

type MatchCriteria = {
  specialites_recherchees: string[]
  ville: string
  code_postal?: string | null
  experience_min?: ExperienceLevel | string | null
  diplome_requis?: string | null
  disponibilites?: Record<string, string[]>
  latitude?: number | null
  longitude?: number | null
}

const EXPERIENCE_ORDER: readonly ExperienceLevel[] = ['moins_3_ans', '3_10_ans', 'plus_10_ans']

export function calculateMatchScore(
  accompagnant: AccompagnantProfile,
  criteria: MatchCriteria
): { score: number; details: Record<string, number> } {
  const details: Record<string, number> = {}

  // 1. Specialites (40 points max)
  // Nombre de specialites recherchees que l'accompagnant possede
  if (criteria.specialites_recherchees.length > 0) {
    const auxSpecialites = accompagnant.specialites ?? []
    const matched = criteria.specialites_recherchees.filter((s) =>
      auxSpecialites.includes(s)
    ).length
    details.specialites = Math.round((matched / criteria.specialites_recherchees.length) * 40)
  } else {
    details.specialites = 40
  }

  // 2. Localisation (25 points max)
  // Si lat/lng disponibles : scoring Haversine, sinon fallback ville/departement
  if (
    accompagnant.latitude != null &&
    accompagnant.longitude != null &&
    criteria.latitude != null &&
    criteria.longitude != null
  ) {
    const distance = haversineDistance(
      accompagnant.latitude,
      accompagnant.longitude,
      criteria.latitude,
      criteria.longitude
    )
    const rayon = accompagnant.rayon_km || 10

    if (distance <= rayon / 2) {
      details.localisation = 25
    } else if (distance <= rayon) {
      details.localisation = 20
    } else if (distance <= rayon * 1.5) {
      details.localisation = 10
    } else {
      details.localisation = 0
    }
  } else if (
    accompagnant.ville &&
    criteria.ville &&
    accompagnant.ville.toLowerCase() === criteria.ville.toLowerCase()
  ) {
    details.localisation = 25
  } else if (
    criteria.code_postal &&
    accompagnant.code_postal &&
    accompagnant.code_postal.substring(0, 2) === criteria.code_postal.substring(0, 2)
  ) {
    details.localisation = 15
  } else {
    details.localisation = 0
  }

  // 3. Experience (15 points max)
  // Si la donnee est absente d'un cote ou l'autre (criteria.experience_min absent
  // OU accompagnant.experience null), on attribue le score max : symetrie avec
  // l'absence de contrainte, ne pas penaliser une donnee manquante.
  if (criteria.experience_min && accompagnant.experience) {
    const requiredIndex = EXPERIENCE_ORDER.indexOf(criteria.experience_min as ExperienceLevel)
    const auxIndex = EXPERIENCE_ORDER.indexOf(accompagnant.experience as ExperienceLevel)
    if (auxIndex >= requiredIndex) {
      details.experience = 15
    } else if (auxIndex === requiredIndex - 1) {
      details.experience = 8
    } else {
      details.experience = 0
    }
  } else {
    details.experience = 15
  }

  // 4. Diplome (10 points max)
  if (criteria.diplome_requis) {
    details.diplome = (accompagnant.diplomes ?? []).includes(criteria.diplome_requis) ? 10 : 3
  } else {
    details.diplome = 10
  }

  // 5. Disponibilites (10 points max)
  if (criteria.disponibilites && accompagnant.disponibilites) {
    let totalSlots = 0
    let matchedSlots = 0

    for (const [jour, creneaux] of Object.entries(criteria.disponibilites)) {
      for (const creneau of creneaux) {
        totalSlots++
        if ((accompagnant.disponibilites[jour] || []).includes(creneau)) {
          matchedSlots++
        }
      }
    }

    details.disponibilites = totalSlots > 0
      ? Math.round((matchedSlots / totalSlots) * 10)
      : 10
  } else {
    details.disponibilites = 10
  }

  const score = Object.values(details).reduce((sum, v) => sum + v, 0)

  return { score, details }
}
