'use client'

import { logout } from '@/app/actions/auth'

export function LogoutButton() {
  return (
    <button
      onClick={() => {
        try {
          sessionStorage.removeItem('rxn-me-v1')
        } catch {
          // sessionStorage indisponible — pas bloquant.
        }
        logout()
      }}
      className="text-sm text-gray-500 hover:text-gray-700 transition"
    >
      Déconnexion
    </button>
  )
}
