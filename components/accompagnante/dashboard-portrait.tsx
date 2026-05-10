'use client'

import { useState, useRef } from 'react'
import { uploadAvatar } from '@/app/actions/profile'
import { useRouter } from 'next/navigation'

type Props = {
  currentUrl: string | null
  firstName: string
  lastName: string
}

export function DashboardPortrait({ currentUrl, firstName, lastName }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const initial = (firstName.charAt(0) || lastName.charAt(0) || 'A').toUpperCase()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadAvatar(formData)

    if (result.error) {
      setError(result.error)
      setPreview(currentUrl)
    } else {
      router.refresh()
    }

    setLoading(false)
    URL.revokeObjectURL(objectUrl)
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        aria-label="Modifier la photo de profil"
        className="relative w-[160px] h-[200px] md:w-[180px] md:h-[220px] rounded overflow-hidden flex-shrink-0 shadow-[0_14px_40px_-16px_rgba(0,0,0,0.22)] hover:shadow-[0_18px_44px_-14px_rgba(0,0,0,0.28)] transition group"
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundImage: 'linear-gradient(135deg, #F4C8A3 0%, #d3a387 100%)' }}
          >
            <span className="italic text-white/85" style={{ fontFamily: 'var(--font-heading)', fontSize: '5rem' }}>
              {initial}
            </span>
          </span>
        )}

        {/* Bouton edit toujours visible (petite pastille en bas a droite) */}
        <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/95 group-hover:bg-white flex items-center justify-center text-gray-700 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </span>

        {loading && (
          <span className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-kraft border-t-transparent rounded-full animate-spin" />
          </span>
        )}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
