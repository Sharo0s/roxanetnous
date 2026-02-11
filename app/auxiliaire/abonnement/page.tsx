import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { LogoutButton } from '@/components/auth/logout-button'
import Link from 'next/link'
import { SubscriptionPageContent } from '@/components/abonnement/subscription-page-content'

export default async function AbonnementAuxiliairePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'auxiliaire') redirect('/')

  const subscription = await getSubscriptionStatus(user.id)

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/auxiliaire/dashboard" className="text-xl font-bold text-black">roxanetnous</Link>
          <div className="flex items-center gap-4">
            <Link href="/auxiliaire/dashboard" className="text-sm text-gray-600 hover:text-black">
              Tableau de bord
            </Link>
            <span className="text-sm text-gray-600">
              {userData.first_name} {userData.last_name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Mon abonnement</h2>
        <SubscriptionPageContent subscription={subscription} />
      </div>
    </main>
  )
}
