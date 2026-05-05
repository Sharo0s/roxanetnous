'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateConversationAsAccompagnante } from '@/app/actions/messages'

export function ContactAccompagneButton({ accompagneProfileId }: { accompagneProfileId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleContact() {
    setLoading(true)
    const result = await getOrCreateConversationAsAccompagnante(accompagneProfileId)

    if (result.conversationId) {
      router.push(`/messages/${result.conversationId}`)
    }
    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={handleContact}
      disabled={loading}
      className="mt-auto px-4 py-2 bg-accent text-black rounded-lg text-sm font-medium btn-hover transition disabled:opacity-50 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
    >
      {loading ? 'Chargement...' : 'Contacter'}
    </button>
  )
}
