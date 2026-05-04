import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSubscriptionStatus, getPaymentMethod, getInvoices, getSubscriptionAmount } from '@/lib/subscription-helpers'
import { SubscriptionPageContent } from '@/components/abonnement/subscription-page-content'
import { AccompagneHeader } from '@/components/layout/accompagne-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function AbonnementAccompagnePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') redirect('/')

  const [subscription, unreadCount] = await Promise.all([
    getSubscriptionStatus(user.id),
    getUnreadCount(user.id),
  ])

  // Fetch Stripe data in parallel (only if subscription has relevant IDs)
  let paymentMethod = null
  let invoices: Awaited<ReturnType<typeof getInvoices>> = []
  let amount = null

  if (subscription.stripeCustomerId || subscription.stripePriceId) {
    const results = await Promise.allSettled([
      subscription.stripeCustomerId ? getPaymentMethod(subscription.stripeCustomerId, subscription.stripeSubscriptionId) : Promise.resolve(null),
      subscription.stripeCustomerId ? getInvoices(subscription.stripeCustomerId) : Promise.resolve([]),
      subscription.stripePriceId ? getSubscriptionAmount(subscription.stripePriceId) : Promise.resolve(null),
    ])

    paymentMethod = results[0].status === 'fulfilled' ? results[0].value : null
    invoices = results[1].status === 'fulfilled' ? results[1].value : []
    amount = results[2].status === 'fulfilled' ? results[2].value : null
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
      <AccompagneHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="abonnement"
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Mon abonnement</h2>
        <SubscriptionPageContent
          subscription={subscription}
          paymentMethod={paymentMethod}
          invoices={invoices}
          role="accompagne"
          amount={amount}
          searchParams={params}
        />
      </div>
    </main>
  )
}
