'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getOrCreateConversation } from '@/app/actions/messages'
import { Button } from '@/components/ui/button'

type Props = {
  accompagnanteProfileId: string
  subscribed?: boolean
}

export function ContactButton({ accompagnanteProfileId, subscribed = true }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const hintId = useId()

  async function handleContact() {
    setLoading(true)
    setError(null)

    const result = await getOrCreateConversation(accompagnanteProfileId)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.conversationId) {
      router.push(`/messages/${result.conversationId}`)
    }
  }

  if (!subscribed) {
    return (
      <div>
        <Button
          type="button"
          disabled
          aria-disabled="true"
          aria-describedby={hintId}
          className="w-full"
        >
          Envoyer un message
        </Button>
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
    <div>
      <Button
        onClick={handleContact}
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Chargement...' : 'Envoyer un message'}
      </Button>
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </div>
  )
}
