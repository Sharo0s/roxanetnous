import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { confirmParrainageOnSuccess } from '@/app/actions/parrainage'

type Props = {
  searchParams: Promise<{ session_id?: string | string[] }>
}

export default async function AbonnementSuccessPage({ searchParams }: Props) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  // FR45/AC9 : si l'utilisatrice a ete parrainee, on declenche la validation
  // automatique a l'arrivee sur la page de succes Stripe.
  const sp = await searchParams
  const rawSessionId = Array.isArray(sp?.session_id) ? sp.session_id[0] : sp?.session_id
  let parrainageValidated = false
  if (rawSessionId) {
    try {
      const result = await confirmParrainageOnSuccess(rawSessionId)
      parrainageValidated = result.ok && !result.alreadyDone
    } catch (err) {
      // Le webhook Stripe (Story B) prendra le relais si nécessaire,
      // mais on log explicitement l'erreur pour diagnostic en prod.
      console.error('[abonnement_success][confirm_parrainage]', {
        userId: user.id,
        sessionId: rawSessionId,
        err,
      })
    }
  }

  return (
    <main className="min-h-screen kraft bg-kraft flex items-center justify-center">
      <div className="relative z-10 max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-xl border p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Abonnement activé</h1>
          {parrainageValidated ? (
            <p className="text-gray-600 mb-6">
              Votre abonnement est actif et votre profil vient d&apos;être validé automatiquement grâce au parrainage. Vous pouvez désormais publier des annonces.
            </p>
          ) : (
            <p className="text-gray-600 mb-6">
              Votre abonnement a été activé avec succès. Vous pouvez désormais publier des annonces.
            </p>
          )}
          <div className="flex flex-col gap-3">
            <Link
              href="/accompagnante/annonces"
              className="px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Gérer mes annonces
            </Link>
            <Link
              href="/accompagnante/dashboard"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:border-accent transition text-sm font-medium"
            >
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
