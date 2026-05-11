'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs' },
  { href: '/admin/annonces', label: 'Annonces' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/signalements', label: 'Signalements' },
  { href: '/admin/parrainages', label: 'Parrainages' },
  { href: '/admin/departements', label: 'Couverture' },
  { href: '/admin/inscrits-hors-zone', label: 'Hors zone' },
  { href: '/admin/statistiques', label: 'Statistiques' },
  { href: '/admin/historique', label: 'Historique' },
]

function isActive(currentPath: string, href: string): boolean {
  if (href === '/admin') return currentPath === '/admin'
  return currentPath === href || currentPath.startsWith(href + '/')
}

export function AdminNav() {
  const pathname = usePathname() || ''
  return (
    <nav aria-label="Navigation admin" className="relative z-10 bg-[#faf7f2] border-b border-[#e8dfd2]">
      <div className="max-w-6xl mx-auto px-4 md:px-6 flex gap-5 md:gap-6 overflow-x-auto overflow-y-hidden text-sm">
        {LINKS.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative py-3 whitespace-nowrap transition ${
                active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
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
