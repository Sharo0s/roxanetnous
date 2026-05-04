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
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft flex items-center justify-center focus:outline-none">
      <div className="relative z-10 max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-xl border p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Abonnement activé</h1>
          <p className="text-gray-600 mb-6">
            Votre abonnement a été activé avec succès. Vous pouvez désormais rechercher des accompagnantes et publier des annonces.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/accompagne/annonces/nouvelle"
              className="px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Publier votre première annonce
            </Link>
            <Link
              href="/accompagne/dashboard"
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
