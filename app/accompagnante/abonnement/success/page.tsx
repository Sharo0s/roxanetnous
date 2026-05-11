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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] flex items-center justify-center focus:outline-none px-4">
      <div className="relative z-10 max-w-md mx-auto text-center">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-3">Bienvenue</div>
        <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight mb-4">Abonnement activé</h1>
        {parrainageValidated ? (
          <p className="text-gray-600 mb-8 leading-relaxed">
            Votre abonnement est actif et votre profil vient d&apos;être validé automatiquement grâce au parrainage. Vous pouvez désormais publier des annonces.
          </p>
        ) : (
          <p className="text-gray-600 mb-8 leading-relaxed">
            Votre abonnement a été activé avec succès. Vous pouvez désormais publier des annonces.
          </p>
        )}
        <div className="flex flex-col gap-3 items-center">
          <Link
            href="/accompagnante/annonces"
            className="inline-flex items-center px-6 py-3 bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition text-sm font-medium"
          >
            Gérer mes annonces
          </Link>
          <Link
            href="/accompagnante/dashboard"
            className="inline-flex items-center px-6 py-3 bg-white border border-[#e8dfd2] text-gray-900 rounded-full hover:border-kraft transition text-sm"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </main>
  )
}
