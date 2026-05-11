'use client'

import { useState } from 'react'

const tabs = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'inscriptions', label: 'Inscriptions' },
  { id: 'revenus', label: 'Revenus' },
  { id: 'activite', label: 'Activité' },
] as const

type TabId = (typeof tabs)[number]['id']

export function DashboardTabs({ children }: {
  children: Record<TabId, React.ReactNode>
}) {
  const [active, setActive] = useState<TabId>('overview')

  return (
    <div>
      <div className="flex gap-2 mb-8 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`inline-flex items-center px-5 py-2 rounded-full text-sm transition ${
              active === tab.id
                ? 'bg-accent border border-accent text-black font-medium'
                : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
            }`}
            aria-current={active === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{children[active]}</div>
    </div>
  )
}
