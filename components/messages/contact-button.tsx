'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateConversation } from '@/app/actions/messages'
import { Button } from '@/components/ui/button'

type Props = {
  accompagnanteProfileId: string
}

export function ContactButton({ accompagnanteProfileId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
