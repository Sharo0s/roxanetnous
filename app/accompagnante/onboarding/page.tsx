import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingClient } from '@/components/accompagnante/onboarding-client'
import { getCodesDepartementsOuverts } from '@/lib/departements'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: filleuleRow } = await supabaseAdmin
    .from('users')
    .select('parrainee_par')
    .eq('id', user.id)
    .maybeSingle()

  const marraineId = filleuleRow?.parrainee_par || null

  let marraineFirstName: string | null = null
  if (marraineId) {
    const { data: marraine } = await supabaseAdmin
      .from('users')
      .select('first_name')
      .eq('id', marraineId)
      .maybeSingle()
    marraineFirstName = marraine?.first_name || null
  }

  const departementsOuverts = await getCodesDepartementsOuverts()

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[#faf7f2] focus:outline-none"
    >
      <h1 className="sr-only">Onboarding accompagnante</h1>
      <OnboardingClient
        parrainage={{
          isFilleule: !!marraineId,
          marraineFirstName,
        }}
        departementsOuverts={departementsOuverts}
        userEmail={user.email ?? ''}
      />
    </main>
  )
}
