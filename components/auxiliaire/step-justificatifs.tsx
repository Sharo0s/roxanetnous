'use client'

import { useState, useRef } from 'react'

type Props = {
  onUpload: (file: File, type: 'identite' | 'diplome') => Promise<boolean>
}

export function StepJustificatifs({ onUpload }: Props) {
  const [identiteFile, setIdentiteFile] = useState<string | null>(null)
  const [diplomeFile, setDiplomeFile] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const identiteRef = useRef<HTMLInputElement>(null)
  const diplomeRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File, type: 'identite' | 'diplome') {
    setUploading(type)
    const success = await onUpload(file, type)
    if (success) {
      if (type === 'identite') setIdentiteFile(file.name)
      else setDiplomeFile(file.name)
    }
    setUploading(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Justificatifs</h2>
        <p className="text-sm text-gray-500">
          Uploadez vos documents pour la verification de votre profil.
          Formats acceptes : PDF, JPG, PNG (max 10 Mo).
        </p>
      </div>

      {/* Piece d'identite */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Piece d'identite
        </label>
        <input
          ref={identiteRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file, 'identite')
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => identiteRef.current?.click()}
          disabled={uploading === 'identite'}
          className={`w-full p-4 rounded-lg border-2 border-dashed transition text-sm ${
            identiteFile
              ? 'border-black bg-gray-50'
              : 'border-gray-300 hover:border-gray-500'
          }`}
        >
          {uploading === 'identite' ? (
            'Upload en cours...'
          ) : identiteFile ? (
            <span>{identiteFile}</span>
          ) : (
            'Cliquez pour selectionner un fichier'
          )}
        </button>
      </div>

      {/* Diplome */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Diplome
        </label>
        <input
          ref={diplomeRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file, 'diplome')
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => diplomeRef.current?.click()}
          disabled={uploading === 'diplome'}
          className={`w-full p-4 rounded-lg border-2 border-dashed transition text-sm ${
            diplomeFile
              ? 'border-black bg-gray-50'
              : 'border-gray-300 hover:border-gray-500'
          }`}
        >
          {uploading === 'diplome' ? (
            'Upload en cours...'
          ) : diplomeFile ? (
            <span>{diplomeFile}</span>
          ) : (
            'Cliquez pour selectionner un fichier'
          )}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Ces documents seront verifies par notre equipe.
        Votre profil sera visible une fois la verification terminee.
      </p>
    </div>
  )
}
