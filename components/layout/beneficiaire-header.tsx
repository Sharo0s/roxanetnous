import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'
import { UnreadBadge } from '@/components/layout/unread-badge'

type Props = {
  userId: string
  unreadCount: number
  firstName: string
  lastName: string
  currentPage?: 'dashboard' | 'profil' | 'messages' | 'annonces' | 'matching' | 'abonnement' | 'other'
}

export function BeneficiaireHeader({
  userId,
  unreadCount,
  firstName,
  lastName,
  currentPage,
}: Props) {
  return (
    <header className="bg-white border-b">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/beneficiaire/dashboard" className="text-xl font-bold text-black">
          roxanetnous
        </Link>
        <div className="flex items-center gap-4">
          {currentPage !== 'messages' && (
            <UnreadBadge userId={userId} initialCount={unreadCount} />
          )}
          {currentPage !== 'dashboard' && (
            <Link href="/beneficiaire/dashboard" className="text-sm text-gray-600 hover:text-black">
              Mon espace
            </Link>
          )}
          {currentPage !== 'profil' && (
            <Link href="/beneficiaire/profil" className="text-sm text-gray-600 hover:text-black">
              Mon profil
            </Link>
          )}
          <span className="text-sm text-gray-600">
            {firstName} {lastName}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
