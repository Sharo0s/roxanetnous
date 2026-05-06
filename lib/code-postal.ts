// Helpers code postal client-safe : aucune dependance Supabase / next/headers,
// importable depuis Client Components et Server Components.

export function extraireCodeDepartement(codePostal: string | null | undefined): string | null {
  if (!codePostal) return null
  const cp = codePostal.trim()
  if (cp.length < 2) return null
  return cp.slice(0, 2)
}
