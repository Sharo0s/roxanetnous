export const DIPLOMES = [
  { value: 'aide_medico_psychologique', label: 'Aide médico-psychologique' },
  { value: 'aide_soignante', label: 'Aide-soignant' },
  { value: 'assistant_soin_gerontologie', label: 'Assistant de soin en gérontologie' },
  { value: 'assistant_vie_familles', label: 'Assistant de vie aux familles' },
  { value: 'accompagnante_gerontologie', label: 'Accompagnant en gérontologie' },
  { value: 'bac_pro_assp', label: 'BAC PRO ASSP' },
  { value: 'deaes', label: 'DEAES (Accompagnant Éducatif et Social)' },
  { value: 'de_accompagnante_vie', label: "Diplôme d'État Accompagnant de Vie" },
  { value: 'autre', label: 'Autre diplôme' },
  { value: 'sans_diplome', label: 'Sans diplôme' },
] as const

export const EXPERIENCE_LEVELS = [
  { value: 'moins_3_ans', label: 'Moins de 3 ans d\'expérience' },
  { value: '3_10_ans', label: 'Entre 3 et 10 ans d\'expérience' },
  { value: 'plus_10_ans', label: 'Plus de 10 ans d\'expérience' },
] as const

// Mappe les valeurs historiques (seeds antérieurs, variantes orthographiques)
// vers les valeurs canoniques de EXPERIENCE_LEVELS. Voir nettoyage BDD 2026-05-11.
const EXPERIENCE_ALIASES: Record<string, typeof EXPERIENCE_LEVELS[number]['value']> = {
  '3_a_5_ans': '3_10_ans',
  '5_a_10_ans': '3_10_ans',
  '3-5_ans': '3_10_ans',
  'moins_de_3_ans': 'moins_3_ans',
  'plus_de_10_ans': 'plus_10_ans',
}

export function formatExperienceLabel(value: string | null | undefined): string {
  if (!value) return '—'
  const canonical = EXPERIENCE_ALIASES[value] ?? value
  return EXPERIENCE_LEVELS.find((e) => e.value === canonical)?.label ?? '—'
}

export const SPECIALITES = [
  { value: 'aide_toilette', label: 'Aide à la toilette' },
  { value: 'aide_habillage', label: 'Aide à l\'habillage' },
  { value: 'aide_repas', label: 'Préparation et aide aux repas' },
  { value: 'aide_deplacement', label: 'Aide aux déplacements' },
  { value: 'accompagnement_courses', label: 'Accompagnement courses' },
  { value: 'accompagnement_sorties', label: 'Accompagnement sorties et promenades' },
  { value: 'entretien_logement', label: 'Entretien du logement' },
  { value: 'garde_nuit', label: 'Garde de nuit' },
  { value: 'stimulation_cognitive', label: 'Stimulation cognitive' },
  { value: 'soutien_psychologique', label: 'Soutien psychologique' },
  { value: 'aide_administrative', label: 'Aide administrative' },
  { value: 'accompagnement_medical', label: 'Accompagnement rendez-vous médicaux' },
  { value: 'aide_transfert', label: 'Aide aux transferts (lit, fauteuil)' },
  { value: 'soins_confort', label: 'Soins de confort et bien-être' },
] as const

export const JOURS_SEMAINE = [
  { value: 'lundi', label: 'Lundi' },
  { value: 'mardi', label: 'Mardi' },
  { value: 'mercredi', label: 'Mercredi' },
  { value: 'jeudi', label: 'Jeudi' },
  { value: 'vendredi', label: 'Vendredi' },
  { value: 'samedi', label: 'Samedi' },
  { value: 'dimanche', label: 'Dimanche' },
] as const

export const CRENEAUX = [
  { value: 'matin', label: 'Matin' },
  { value: 'apres_midi', label: 'Après-midi' },
  { value: 'soir', label: 'Soir' },
  { value: 'nuit', label: 'Nuit' },
] as const
