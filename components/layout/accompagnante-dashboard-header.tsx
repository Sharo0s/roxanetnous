'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'

type Props = {
  firstName: string
  lastName: string
  unreadCount: number
  currentPage?: 'dashboard' | 'annonces' | 'demandes' | 'messages' | 'profil' | 'parrainage' | 'abonnement' | 'other'
}

type LinkDef = {
  href: string
  label: string
  key: NonNullable<Props['currentPage']>
  badge?: boolean
}

const links: LinkDef[] = [
  { href: '/accompagnant/dashboard', label: 'Accueil', key: 'dashboard' },
  { href: '/accompagnant/annonces', label: 'Annonces', key: 'annonces' },
  { href: '/recherche/demandes', label: 'Demandes', key: 'demandes' },
  { href: '/messages', label: 'Messages', key: 'messages', badge: true },
  { href: '/accompagnant/profil', label: 'Profil', key: 'profil' },
]

export function AccompagnanteDashboardHeader({ firstName, lastName, unreadCount, currentPage = 'dashboard' }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-[#faf7f2] border-b border-[#e8dfd2] relative z-10">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        <Link href="/accompagnant/dashboard" className="text-lg font-bold text-black">
          roxanetnous
        </Link>

        {/* Desktop */}
        <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-7 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative transition ${
                link.key === currentPage ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-current={link.key === currentPage ? 'page' : undefined}
            >
              <span className="inline-flex items-center gap-1.5">
                {link.label}
                {link.badge && unreadCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-kraft text-white text-[10px] font-medium"
                    aria-label={`${unreadCount} non lus`}
                  >
                    {unreadCount}
                  </span>
                )}
              </span>
              {link.key === currentPage && (
                <span className="absolute left-0 right-0 -bottom-1 h-px bg-kraft" aria-hidden="true" />
              )}
            </Link>
          ))}
        </nav>

        {/* Burger mobile */}
        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="dashboard-mobile-menu"
          aria-haspopup="true"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <nav
          id="dashboard-mobile-menu"
          aria-label="Navigation principale mobile"
          className="md:hidden border-t border-[#e8dfd2] px-4 py-3 flex flex-col gap-3 text-sm"
        >
          <span className="font-medium text-black">
            {firstName} {lastName}
          </span>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${link.key === currentPage ? 'text-gray-900' : 'text-gray-600'} hover:text-black inline-flex items-center gap-2`}
              onClick={() => setMenuOpen(false)}
              aria-current={link.key === currentPage ? 'page' : undefined}
            >
              {link.label}
              {link.badge && unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-kraft text-white text-[10px] font-medium">
                  {unreadCount}
                </span>
              )}
            </Link>
          ))}
          <div className="pt-2 border-t border-[#e8dfd2]">
            <LogoutButton />
          </div>
        </nav>
      )}
    </header>
  )
}
