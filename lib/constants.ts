export const DIPLOMES = [
  { value: 'aide_medico_psychologique', label: 'Aide medico-psychologique' },
  { value: 'aide_soignante', label: 'Aide-soignante' },
  { value: 'assistant_soin_gerontologie', label: 'Assistant de soin en gerontologie' },
  { value: 'assistant_vie_familles', label: 'Assistant de vie aux familles' },
  { value: 'auxiliaire_gerontologie', label: 'Auxiliaire en gerontologie' },
  { value: 'bac_pro_assp', label: 'BAC PRO ASSP' },
  { value: 'deaes', label: 'DEAES (Accompagnant Educatif et Social)' },
  { value: 'de_auxiliaire_vie', label: "Diplome d'Etat Auxiliaire de Vie" },
  { value: 'autre', label: 'Autre diplome' },
  { value: 'sans_diplome', label: 'Sans diplome' },
] as const

export const EXPERIENCE_LEVELS = [
  { value: 'moins_3_ans', label: 'Moins de 3 ans' },
  { value: '3_10_ans', label: 'Entre 3 et 10 ans' },
  { value: 'plus_10_ans', label: 'Plus de 10 ans' },
] as const

export const SPECIALITES = [
  { value: 'aide_toilette', label: 'Aide a la toilette' },
  { value: 'aide_habillage', label: 'Aide a l\'habillage' },
  { value: 'aide_repas', label: 'Preparation et aide aux repas' },
  { value: 'aide_deplacement', label: 'Aide aux deplacements' },
  { value: 'accompagnement_courses', label: 'Accompagnement courses' },
  { value: 'accompagnement_sorties', label: 'Accompagnement sorties et promenades' },
  { value: 'entretien_logement', label: 'Entretien du logement' },
  { value: 'garde_nuit', label: 'Garde de nuit' },
  { value: 'stimulation_cognitive', label: 'Stimulation cognitive' },
  { value: 'soutien_psychologique', label: 'Soutien psychologique' },
  { value: 'aide_administrative', label: 'Aide administrative' },
  { value: 'accompagnement_medical', label: 'Accompagnement rendez-vous medicaux' },
  { value: 'aide_transfert', label: 'Aide aux transferts (lit, fauteuil)' },
  { value: 'soins_confort', label: 'Soins de confort et bien-etre' },
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
  { value: 'apres_midi', label: 'Apres-midi' },
  { value: 'soir', label: 'Soir' },
  { value: 'nuit', label: 'Nuit' },
] as const
