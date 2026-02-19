'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateConversationAsAuxiliaire } from '@/app/actions/messages'

export function ContactBeneficiaireButton({ beneficiaireProfileId }: { beneficiaireProfileId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleContact() {
    setLoading(true)
    const result = await getOrCreateConversationAsAuxiliaire(beneficiaireProfileId)

    if (result.conversationId) {
      router.push(`/messages/${result.conversationId}`)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleContact}
      disabled={loading}
      className="mt-auto px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 w-full"
    >
      {loading ? 'Chargement...' : 'Contacter'}
    </button>
  )
}
