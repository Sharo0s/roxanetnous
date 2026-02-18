import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AbonnementSuccessPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'auxiliaire') redirect('/')

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-xl border p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Abonnement active</h1>
          <p className="text-gray-600 mb-6">
            Votre abonnement a ete active avec succes. Vous pouvez desormais publier des annonces.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/auxiliaire/annonces"
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
            >
              Gerer mes annonces
            </Link>
            <Link
              href="/auxiliaire/dashboard"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:border-black transition text-sm font-medium"
            >
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
