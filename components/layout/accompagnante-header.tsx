'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'

type Props = {
  userId: string
  unreadCount: number
  firstName: string
  lastName: string
  currentPage?: 'dashboard' | 'profil' | 'messages' | 'annonces' | 'abonnement' | 'other'
}

export function AccompagnanteHeader({
  userId,
  unreadCount,
  firstName,
  lastName,
  currentPage,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-white border-b border-accent relative z-10">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/accompagnante/dashboard" className="text-xl font-bold text-black">
          roxanetnous
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-4">
          {currentPage !== 'dashboard' && (
            <Link href="/accompagnante/dashboard" className="text-sm text-gray-600 hover:text-black">
              Mon espace
            </Link>
          )}
          <span className="text-sm text-gray-600">
            {firstName} {lastName}
          </span>
          <LogoutButton />
        </div>

        {/* Burger mobile */}
        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
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
        <div className="md:hidden border-t border-accent px-4 py-3 flex flex-col gap-3">
          <span className="text-sm font-medium text-black">
            {firstName} {lastName}
          </span>
          {currentPage !== 'dashboard' && (
            <Link href="/accompagnante/dashboard" className="text-sm text-gray-600 hover:text-black" onClick={() => setMenuOpen(false)}>
              Mon espace
            </Link>
          )}
          <LogoutButton />
        </div>
      )}
    </header>
  )
}
