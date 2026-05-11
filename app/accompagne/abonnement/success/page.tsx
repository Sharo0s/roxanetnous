import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AbonnementAccompagneSuccessPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') redirect('/')

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] flex items-center justify-center focus:outline-none px-4">
      <div className="relative z-10 max-w-md mx-auto text-center">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-3">Bienvenue</div>
        <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight mb-4">Abonnement activé</h1>
        <p className="text-gray-600 mb-8 leading-relaxed">
          Votre abonnement a été activé avec succès. Vous pouvez désormais rechercher des accompagnants et publier des annonces.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Link
            href="/recherche"
            className="inline-flex items-center px-6 py-3 bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft hover:text-white transition text-sm font-medium"
          >
            Rechercher un accompagnant
          </Link>
          <Link
            href="/accompagne/annonces/nouvelle"
            className="inline-flex items-center px-6 py-3 bg-white border border-[#e8dfd2] text-gray-900 rounded-full hover:border-kraft transition text-sm"
          >
            Publier une annonce
          </Link>
          <Link
            href="/accompagne/dashboard"
            className="inline-flex items-center px-6 py-3 bg-white border border-[#e8dfd2] text-gray-900 rounded-full hover:border-kraft transition text-sm"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </main>
  )
}
