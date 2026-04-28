import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
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

  return (
    <main className="min-h-screen kraft bg-kraft">
      <header className="relative z-10 bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-xl font-bold text-black">roxanetnous</Link>
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {userData.first_name} {userData.last_name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <nav className="relative z-10 bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { href: '/admin', label: 'Tableau de bord' },
            { href: '/admin/utilisateurs', label: 'Utilisateurs' },
            { href: '/admin/annonces', label: 'Annonces' },
            { href: '/admin/messages', label: 'Messages' },
            { href: '/admin/signalements', label: 'Signalements' },
            { href: '/admin/parrainages', label: 'Parrainages' },
            { href: '/admin/historique', label: 'Historique' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2.5 text-sm text-gray-600 hover:text-black whitespace-nowrap border-b-2 border-transparent hover:border-accent transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="relative z-10">{children}</div>
    </main>
  )
}
