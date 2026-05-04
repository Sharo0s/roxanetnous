'use client'

import { useState } from 'react'
import { sendContactMessage } from '@/app/actions/contact'

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(formData: FormData) {
    setStatus('loading')
    setError('')
    const result = await sendContactMessage(formData)
    if (result.error) {
      setError(result.error)
      setStatus('error')
    } else {
      setStatus('success')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-white border rounded-xl p-6 text-center">
        <p className="font-semibold text-black mb-1">Message envoyé</p>
        <p className="text-sm text-black/50">Nous vous répondrons dans les meilleurs délais.</p>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4 text-left">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-firstname" className="block text-sm font-medium text-black mb-1">Prénom</label>
          <input
            id="contact-firstname"
            name="firstname"
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
            placeholder="Votre prénom"
          />
        </div>
        <div>
          <label htmlFor="contact-lastname" className="block text-sm font-medium text-black mb-1">Nom</label>
          <input
            id="contact-lastname"
            name="lastname"
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
            placeholder="Votre nom"
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-black mb-1">Email</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          className="w-full px-3 py-2 border border-gray-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
          placeholder="vous@exemple.com"
        />
      </div>
      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-black mb-1">Sujet</label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          maxLength={150}
          className="w-full px-3 py-2 border border-gray-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
          placeholder="Sujet de votre message"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-black mb-1">Message</label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={4}
          maxLength={2000}
          className="w-full px-3 py-2 border border-gray-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring resize-none"
          placeholder="Votre message..."
        />
      </div>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full px-4 py-2 rounded-lg text-sm font-medium text-black btn-hover disabled:opacity-50 bg-accent"
      >
        {status === 'loading' ? 'Envoi en cours...' : 'Envoyer'}
      </button>
    </form>
  )
}
