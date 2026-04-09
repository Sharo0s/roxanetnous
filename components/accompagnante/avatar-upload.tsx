'use client'

import { useState, useRef } from 'react'
import { uploadAvatar } from '@/app/actions/profile'
import { useRouter } from 'next/navigation'

type Props = {
  currentUrl: string | null
  firstName: string
  lastName: string
  size?: 'sm' | 'lg'
}

export function AvatarUpload({ currentUrl, firstName, lastName, size = 'lg' }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

  const sizeClasses = size === 'lg'
    ? 'w-24 h-24 text-2xl border-[3px]'
    : 'w-14 h-14 text-base border-2'

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
        className={`relative ${sizeClasses} rounded-full overflow-hidden border-gray-300 hover:border-accent transition group flex-shrink-0`}
      >
        {preview ? (
          <img
            src={preview}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 font-semibold">
            {initials}
          </span>
        )}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </span>
        {loading && (
          <span className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
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
