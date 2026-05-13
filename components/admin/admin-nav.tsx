'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type AdminNavBadges = {
  utilisateurs?: number
  signalements?: number
  parrainages?: number
  messages?: number
}

type LinkDef = {
  href: string
  label: string
  badgeKey?: keyof AdminNavBadges
}

const LINKS: LinkDef[] = [
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', badgeKey: 'utilisateurs' },
  { href: '/admin/annonces', label: 'Annonces' },
  { href: '/admin/messages', label: 'Messages', badgeKey: 'messages' },
  { href: '/admin/signalements', label: 'Signalements', badgeKey: 'signalements' },
  { href: '/admin/parrainages', label: 'Parrainages', badgeKey: 'parrainages' },
  { href: '/admin/departements', label: 'Couverture' },
  { href: '/admin/inscrits-hors-zone', label: 'Hors zone' },
  { href: '/admin/statistiques', label: 'Statistiques' },
  { href: '/admin/historique', label: 'Historique' },
]

function isActive(currentPath: string, href: string): boolean {
  if (href === '/admin') return currentPath === '/admin'
  return currentPath === href || currentPath.startsWith(href + '/')
}

function formatBadge(count: number): string {
  return count > 9 ? '9+' : String(count)
}

function ariaForBadge(label: string, count: number): string {
  return `${count} ${label.toLowerCase()} en attente`
}

export function AdminNav({ badges }: { badges?: AdminNavBadges }) {
  const pathname = usePathname() || ''
  return (
    <nav aria-label="Navigation admin" className="relative z-10 bg-[#faf7f2] border-b border-[#e8dfd2]">
      <div className="max-w-6xl mx-auto px-4 md:px-6 flex gap-5 md:gap-6 overflow-x-auto overflow-y-hidden text-sm">
        {LINKS.map((item) => {
          const active = isActive(pathname, item.href)
          const rawCount = item.badgeKey ? badges?.[item.badgeKey] ?? 0 : 0
          const showBadge = rawCount > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative py-3 whitespace-nowrap transition inline-flex items-center gap-1.5 ${
                active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span>{item.label}</span>
              {showBadge && (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-none tabular-nums"
                  aria-label={ariaForBadge(item.label, rawCount)}
                >
                  {formatBadge(rawCount)}
                </span>
              )}
              {active && (
                <span className="absolute left-0 right-0 -bottom-px h-px bg-kraft" aria-hidden="true" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
