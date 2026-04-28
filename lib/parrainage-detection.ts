// Story 2.3 : utilitaires purs pour la détection blacklist parrainage.
// Importable depuis server actions, route handlers et tests sans 'use server'.

export function normalizeEmail(input: string): string {
  return (input || '').trim().toLowerCase()
}

// Normalisation MVP : pas de gestion accents/géocodage/abréviations.
// Faux positifs/négatifs assumés (revue admin via flag de suspicion).
export function normalizeAddress(input: string): string {
  return (input || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function mergeFlagSuspicion(existing: string | null, addition: string): string {
  const flags = (existing || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
  if (!flags.includes(addition)) flags.push(addition)
  return flags.join(',')
}
