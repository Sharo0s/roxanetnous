import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSubscriptionStatus, getPaymentMethod, getInvoices, getSubscriptionAmount } from '@/lib/subscription-helpers'
import { SubscriptionPageContent } from '@/components/abonnement/subscription-page-content'
import { AccompagneDashboardHeader } from '@/components/layout/accompagne-dashboard-header'
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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <AccompagneDashboardHeader
        firstName={userData.first_name}
        lastName={userData.last_name}
        unreadCount={unreadCount}
        currentPage="abonnement"
      />

      <div className="max-w-2xl mx-auto px-4 py-10 md:py-14 relative z-10">

        <header className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Votre espace</div>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Mon abonnement</h1>
          <p className="mt-3 text-sm text-gray-600">
            {subscription.active
              ? 'Gérez votre formule et vos paiements.'
              : 'Choisissez la formule qui vous correspond.'}
          </p>
        </header>

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
