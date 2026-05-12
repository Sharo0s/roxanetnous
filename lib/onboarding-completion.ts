// Detection des champs manquants pour un profil accompagnante en cours
// d'onboarding. Utilise par le mail de relance pour personnaliser le
// contenu ("Il vous reste a renseigner : votre ville, vos diplomes...").
//
// L'ordre de la liste suit l'ordre logique de l'onboarding (cf.
// /accompagnante/onboarding) : identite geographique d'abord, puis
// experience/competences, puis disponibilites/details.

type AccompagnanteProfileForCompletion = {
  ville: string | null
  code_postal: string | null
  experience: string | null
  specialites: string[] | null
  diplomes: string[] | null
  disponibilites: unknown
  rayon_km: number | null
  description: string | null
}

type MissingField = {
  key: string
  label: string
}

const FIELD_LABELS: Record<string, string> = {
  ville: 'votre ville',
  code_postal: 'votre code postal',
  experience: 'votre experience',
  specialites: 'vos specialites',
  diplomes: 'vos diplomes',
  disponibilites: 'vos disponibilites',
  rayon_km: 'votre rayon d\'intervention',
  description: 'votre description',
}

function isEmptyArray(v: string[] | null): boolean {
  return !v || v.length === 0
}

function isEmptyDisponibilites(v: unknown): boolean {
  if (!v || typeof v !== 'object') return true
  const obj = v as Record<string, unknown>
  if ('flexible' in obj && obj.flexible === true) return false
  const slots = Object.values(obj).filter((x) => Array.isArray(x) && x.length > 0)
  return slots.length === 0
}

export function getMissingOnboardingFields(
  profile: AccompagnanteProfileForCompletion
): MissingField[] {
  const missing: MissingField[] = []

  if (!profile.ville) missing.push({ key: 'ville', label: FIELD_LABELS.ville })
  if (!profile.code_postal) missing.push({ key: 'code_postal', label: FIELD_LABELS.code_postal })
  if (!profile.experience) missing.push({ key: 'experience', label: FIELD_LABELS.experience })
  if (isEmptyArray(profile.specialites)) missing.push({ key: 'specialites', label: FIELD_LABELS.specialites })
  if (isEmptyArray(profile.diplomes)) missing.push({ key: 'diplomes', label: FIELD_LABELS.diplomes })
  if (isEmptyDisponibilites(profile.disponibilites)) missing.push({ key: 'disponibilites', label: FIELD_LABELS.disponibilites })
  if (!profile.rayon_km) missing.push({ key: 'rayon_km', label: FIELD_LABELS.rayon_km })
  if (!profile.description) missing.push({ key: 'description', label: FIELD_LABELS.description })

  return missing
}
