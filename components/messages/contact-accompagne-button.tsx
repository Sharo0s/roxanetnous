'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getOrCreateConversationAsAccompagnante } from '@/app/actions/messages'

type Props = {
  accompagneProfileId: string
  subscribed?: boolean
}

export function ContactAccompagneButton({ accompagneProfileId, subscribed = true }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const hintId = useId()

  async function handleContact() {
    setLoading(true)
    setError(null)
    const result = await getOrCreateConversationAsAccompagnante(accompagneProfileId)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.conversationId) {
      router.push(`/messages/${result.conversationId}`)
    }
    setLoading(false)
  }

  if (!subscribed) {
    return (
      <div className="mt-auto">
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-describedby={hintId}
          className="px-4 py-2 bg-accent text-black rounded-lg text-sm font-medium transition disabled:opacity-50 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
        >
          Contacter
        </button>
        <p id={hintId} className="text-xs text-muted-foreground mt-2">
          Abonnement requis pour contacter.{' '}
          <Link href="/abonnement?from=contact" className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded">
            S&apos;abonner
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="mt-auto">
      <button
        type="button"
        onClick={handleContact}
        disabled={loading}
        className="px-4 py-2 bg-accent text-black rounded-lg text-sm font-medium btn-hover transition disabled:opacity-50 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
      >
        {loading ? 'Chargement...' : 'Contacter'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700 mt-2">{error}</p>
      )}
    </div>
  )
}
