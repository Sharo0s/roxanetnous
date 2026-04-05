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
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition btn-hover ${
              active === tab.id
                ? 'bg-accent text-black'
                : 'bg-white border border-gray-300 text-gray-700 hover:border-accent'
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
