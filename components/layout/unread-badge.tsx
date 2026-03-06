'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Props = {
  userId: string
  initialCount: number
}

export function UnreadBadge({ userId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as any
          if (newMsg.sender_id !== userId) {
            setCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return (
    <Link href="/messages" className="relative text-sm text-gray-600 hover:text-black">
      Messages
      {count > 0 && (
        <span className="absolute -top-1.5 -right-3 w-4 h-4 rounded-full bg-accent text-black text-[10px] flex items-center justify-center font-medium">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
