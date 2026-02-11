// Algorithme de matching intelligent
// Score sur 100 points base sur 5 criteres

type AuxiliaireProfile = {
  specialites: string[]
  ville: string
  code_postal: string
  experience: string
  diplome: string
  disponibilites: Record<string, string[]> | null
  rayon_km: number
}

type MatchCriteria = {
  specialites_recherchees: string[]
  ville: string
  code_postal?: string
  experience_min?: string
  diplome_requis?: string
  disponibilites?: Record<string, string[]>
}

const EXPERIENCE_ORDER = ['moins_3_ans', '3_10_ans', 'plus_10_ans']

export function calculateMatchScore(
  auxiliaire: AuxiliaireProfile,
  criteria: MatchCriteria
): { score: number; details: Record<string, number> } {
  const details: Record<string, number> = {}

  // 1. Specialites (40 points max)
  // Nombre de specialites recherchees que l'auxiliaire possede
  if (criteria.specialites_recherchees.length > 0) {
    const matched = criteria.specialites_recherchees.filter((s) =>
      auxiliaire.specialites.includes(s)
    ).length
    details.specialites = Math.round((matched / criteria.specialites_recherchees.length) * 40)
  } else {
    details.specialites = 40
  }

  // 2. Localisation (25 points max)
  // Meme ville = 25 points, meme departement = 15 points, sinon 0
  if (auxiliaire.ville.toLowerCase() === criteria.ville.toLowerCase()) {
    details.localisation = 25
  } else if (
    criteria.code_postal &&
    auxiliaire.code_postal &&
    auxiliaire.code_postal.substring(0, 2) === criteria.code_postal.substring(0, 2)
  ) {
    details.localisation = 15
  } else {
    details.localisation = 0
  }

  // 3. Experience (15 points max)
  if (criteria.experience_min) {
    const requiredIndex = EXPERIENCE_ORDER.indexOf(criteria.experience_min)
    const auxIndex = EXPERIENCE_ORDER.indexOf(auxiliaire.experience)
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
    details.diplome = auxiliaire.diplome === criteria.diplome_requis ? 10 : 3
  } else {
    details.diplome = 10
  }

  // 5. Disponibilites (10 points max)
  if (criteria.disponibilites && auxiliaire.disponibilites) {
    let totalSlots = 0
    let matchedSlots = 0

    for (const [jour, creneaux] of Object.entries(criteria.disponibilites)) {
      for (const creneau of creneaux) {
        totalSlots++
        if ((auxiliaire.disponibilites[jour] || []).includes(creneau)) {
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
