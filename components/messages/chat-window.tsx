'use client'

import { useState, useEffect, useRef, useId } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '@/app/actions/messages'

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

type OptimisticMessage = Message & { optimistic?: boolean }

type Props = {
  conversationId: string
  currentUserId: string
  initialMessages: Message[]
  otherUserName: string
  // Story 3.6 : defense en profondeur paywall (D1 + AC10/AC11)
  subscribed?: boolean
  conversationHasAdmin?: boolean
}

export function ChatWindow({
  conversationId,
  currentUserId,
  initialMessages,
  otherUserName,
  subscribed = true,
  conversationHasAdmin = false,
}: Props) {
  const canSend = subscribed || conversationHasAdmin
  const paywallHintId = useId()
  const [messages, setMessages] = useState<OptimisticMessage[]>(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const textareaId = useId()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Abonnement realtime
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            // Si un message optimiste de meme expediteur et meme contenu existe,
            // le remplacer par la version server (evite une double-insertion donc
            // une double annonce aria-live entre l'optimistic et la confirmation).
            const optimisticIdx = prev.findIndex(
              (m) => m.optimistic && m.sender_id === newMsg.sender_id && m.content === newMsg.content
            )
            if (optimisticIdx !== -1) {
              const next = [...prev]
              next[optimisticIdx] = newMsg
              return next
            }
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  async function handleSend() {
    if (!newMessage.trim() || sending) return

    setSending(true)
    setSendError(null)
    const content = newMessage.trim()
    setNewMessage('')

    const optimisticMsg: OptimisticMessage = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
      optimistic: true,
    }
    setMessages((prev) => [...prev, optimisticMsg])

    const result = await sendMessage(conversationId, content)
    if (result.error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      // Story 3.6 patch F2 : propager le libelle paywall (AC11) au lieu d'un message generique trompeur.
      setSendError(result.error || "Echec de l'envoi du message. Veuillez reessayer.")
      setNewMessage(content)
    }

    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full relative z-10">
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label={`Messages avec ${otherUserName}`}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WAI-ARIA log scrollable : tabIndex=0 requis pour PageUp/PageDown clavier (AC6 story 2.6.2)
        tabIndex={0}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded"
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-12">
            Commencez la conversation avec {otherUserName}.
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId
            return (
              <div
                key={msg.id}
                data-optimistic={msg.optimistic ? 'true' : undefined}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? 'bg-accent text-black rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className="text-xs mt-1 text-black">
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-0 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {sendError && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
              {sendError}
            </p>
          )}
          {!canSend && (
            <p
              id={paywallHintId}
              role="status"
              className="text-sm text-muted-foreground bg-white border border-gray-200 rounded-lg px-3 py-2 mb-2"
            >
              Abonnement requis pour répondre.{' '}
              <Link
                href="/abonnement?from=message"
                className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded"
              >
                S&apos;abonner
              </Link>
            </p>
          )}
          <div className="flex items-end gap-2 bg-white rounded-2xl border-2 border-gray-200 hover:border-accent focus-within:border-accent shadow-sm px-3 py-2 transition">
            {/* eslint-disable-next-line jsx-a11y/label-has-for -- regle depreciee, htmlFor seul est le pattern moderne (WAI-ARIA + eslint-plugin-jsx-a11y label-has-associated-control) */}
            <label htmlFor={textareaId} className="sr-only">
              Ecrivez votre message a {otherUserName}
            </label>
            <textarea
              id={textareaId}
              ref={inputRef}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                if (inputRef.current) {
                  inputRef.current.style.height = 'auto'
                  inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Écrivez votre message..."
              rows={1}
              disabled={!canSend}
              aria-disabled={!canSend ? 'true' : undefined}
              aria-describedby={!canSend ? paywallHintId : undefined}
              className="flex-1 bg-transparent px-2 py-2 text-sm focus:outline-none resize-none max-h-[120px] placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '36px' }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || !newMessage.trim() || sending}
              aria-disabled={!canSend ? 'true' : undefined}
              aria-describedby={!canSend ? paywallHintId : undefined}
              aria-label="Envoyer le message"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-accent text-black flex items-center justify-center btn-hover transition disabled:opacity-30 disabled:cursor-not-allowed mb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
