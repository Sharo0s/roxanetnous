import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import { AdminNav } from '@/components/admin/admin-nav'
import { getAdminPendingCounts } from '@/lib/admin/pending-counts'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'admin') redirect('/')

  const pendingCounts = await getAdminPendingCounts(user.id)

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">

      {/* HEADER */}
      <header className="relative z-10 bg-[#faf7f2] border-b border-[#e8dfd2]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-lg font-bold text-black">roxanetnous</Link>
            <span className="inline-flex items-center text-[10px] uppercase tracking-[0.14em] font-medium text-kraft border border-[#e8dfd2] bg-white px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600 hidden sm:inline">
              {userData.first_name} {userData.last_name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* NAV (composant client pour gerer le state actif via usePathname) */}
      <AdminNav badges={pendingCounts} />

      <div className="relative z-10">{children}</div>
    </main>
  )
}
