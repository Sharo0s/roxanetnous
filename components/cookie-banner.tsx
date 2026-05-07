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
          Ce site utilise uniquement un cookie d&apos;authentification Supabase, strictement
          nécessaire au fonctionnement du service lorsque vous êtes connecté. Une préférence
          locale est également stockée dans votre navigateur (localStorage) pour ne pas
          réafficher cette information à chaque visite. Aucun cookie publicitaire, analytique
          ou de suivi tiers n&apos;est utilisé.
        </p>
        <button
          onClick={handleAccept}
          className="px-4 py-2 bg-accent text-black rounded-lg text-sm btn-hover transition whitespace-nowrap"
        >
          Compris
        </button>
      </div>
    </div>
  )
}
