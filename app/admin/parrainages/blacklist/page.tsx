import { redirect } from 'next/navigation'

// Page conservée comme redirect pour les anciens emails admin qui ont été envoyés avec
// le lien /admin/parrainages/blacklist?id=xxx avant la fusion des deux pages (2026-05-11).
// La nouvelle page unifiée accueille le paramètre `id` et l'utilise pour highlighter la
// ligne correspondante dans la vue "bloques".
export default async function AdminParrainagesBlacklistRedirect({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const params = await searchParams
  const qs = new URLSearchParams({ vue: 'bloques' })
  if (params.id) qs.set('id', params.id)
  redirect(`/admin/parrainages?${qs.toString()}`)
}
