'use client'

import { useState } from 'react'
import { exportUserData } from '@/app/actions/rgpd'

export function ExportDataButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const data = await exportUserData()
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mes-donnees-roxanetnous-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-4 py-2 border border-gray-400 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm disabled:opacity-50"
    >
      {loading ? 'Export en cours...' : 'Exporter mes données'}
    </button>
  )
}
