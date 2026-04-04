'use client'

import { useState } from 'react'

const tabs = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'inscriptions', label: 'Inscriptions' },
  { id: 'revenus', label: 'Revenus' },
  { id: 'activite', label: 'Activite' },
] as const

type TabId = (typeof tabs)[number]['id']

export function DashboardTabs({ children }: {
  children: Record<TabId, React.ReactNode>
}) {
  const [active, setActive] = useState<TabId>('overview')

  return (
    <div>
      <div className="flex gap-1 border-b mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              active === tab.id
                ? 'border-accent text-black'
                : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{children[active]}</div>
    </div>
  )
}
