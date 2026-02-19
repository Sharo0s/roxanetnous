'use client'

import { useEffect } from 'react'
import { updateLastSeen } from '@/app/actions/profile'

const THROTTLE_KEY = 'last_seen_updated'
const THROTTLE_MS = 10 * 60 * 1000 // 10 minutes

export function LastSeenTracker() {
  useEffect(() => {
    const last = sessionStorage.getItem(THROTTLE_KEY)
    if (last && Date.now() - Number(last) < THROTTLE_MS) return

    sessionStorage.setItem(THROTTLE_KEY, String(Date.now()))
    updateLastSeen()
  }, [])

  return null
}
