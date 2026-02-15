'use client'

import { useState, useEffect } from 'react'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem('cookies-accepted')
    if (!accepted) {
      setVisible(true)
    }
  }, [])

  function handleAccept() {
    localStorage.setItem('cookies-accepted', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
      <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-700">
          Ce site utilise uniquement des cookies essentiels au fonctionnement du service
          (authentification, preferences). Aucun cookie publicitaire ou de suivi n&apos;est utilise.
        </p>
        <button
          onClick={handleAccept}
          className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 transition whitespace-nowrap"
        >
          Compris
        </button>
      </div>
    </div>
  )
}
