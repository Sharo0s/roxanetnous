'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type MeState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; dashboard: string }

const CACHE_KEY = 'rxn-me-v1'

function readCache(): MeState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MeState
    if (parsed.status === 'authenticated' && typeof parsed.dashboard === 'string') return parsed
    if (parsed.status === 'anonymous') return parsed
    return null
  } catch {
    return null
  }
}

function writeCache(state: MeState) {
  if (typeof window === 'undefined') return
  try {
    if (state.status === 'loading') return
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage indisponible (mode privé strict, quota) — on ignore.
  }
}

// Plusieurs instances du composant sur la même page partagent un fetch unique.
let inflight: Promise<MeState> | null = null
function fetchMe(): Promise<MeState> {
  if (inflight) return inflight
  inflight = fetch('/api/me', { credentials: 'include', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { authenticated?: boolean; dashboard?: string } | null): MeState =>
      data && data.authenticated && typeof data.dashboard === 'string'
        ? { status: 'authenticated', dashboard: data.dashboard }
        : { status: 'anonymous' },
    )
    .catch((): MeState => ({ status: 'anonymous' }))
  return inflight
}

export function HeaderAuthLink({ className }: { className: string }) {
  const [state, setState] = useState<MeState>(() => readCache() ?? { status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchMe().then((next) => {
      if (cancelled) return
      setState(next)
      writeCache(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const href = state.status === 'authenticated' ? state.dashboard : '/login'
  const label = state.status === 'authenticated' ? 'Mon espace' : 'Connexion'

  return (
    <Link href={href} className={className} prefetch={false}>
      {label}
    </Link>
  )
}
