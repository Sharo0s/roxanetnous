'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  autoriserException,
  confirmerFraude,
  ignorerFlag,
} from '@/app/actions/admin-parrainages'
import { Button } from '@/components/ui/button'

type Mode = 'idle' | 'autoriser' | 'fraude'

type Props = {
  parrainageId: string
  hasFlag: boolean
  isBlocked: boolean
}

export function ParrainageBlacklistActions({ parrainageId, hasFlag, isBlocked }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('idle')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const result =
      mode === 'autoriser'
        ? await autoriserException(parrainageId, notes)
        : await confirmerFraude(parrainageId, notes)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setMode('idle')
    setNotes('')
    setLoading(false)
    router.refresh()
  }

  async function handleIgnore() {
    setLoading(true)
    setError(null)
    const result = await ignorerFlag(parrainageId)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setLoading(false)
    router.refresh()
  }

  if (mode !== 'idle') {
    return (
      <div className="min-w-[240px]">
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <p className="text-xs font-medium text-gray-700 mb-1">
          {mode === 'autoriser' ? 'Notes (exception autorisée)' : 'Notes (fraude confirmée)'}
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none mb-2"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? '...' : 'Confirmer'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('idle')} disabled={loading}>
            Annuler
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 min-w-[160px]">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {(isBlocked || hasFlag) && (
        <Button size="sm" variant="outline" onClick={() => setMode('autoriser')}>
          Autoriser exception
        </Button>
      )}
      {(isBlocked || hasFlag) && (
        <Button size="sm" variant="outline" onClick={() => setMode('fraude')}>
          Confirmer fraude
        </Button>
      )}
      {hasFlag && !isBlocked && (
        <Button size="sm" variant="ghost" onClick={handleIgnore} disabled={loading}>
          {loading ? '...' : 'Ignorer flag'}
        </Button>
      )}
    </div>
  )
}
