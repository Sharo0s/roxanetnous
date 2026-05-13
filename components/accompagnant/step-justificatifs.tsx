'use client'

import { useState, useRef } from 'react'

type Props = {
  onUpload: (file: File, type: 'identite') => Promise<boolean>
}

export function StepJustificatifs({ onUpload }: Props) {
  const [identiteFile, setIdentiteFile] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const identiteRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    const success = await onUpload(file, 'identite')
    if (success) {
      setIdentiteFile(file.name)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Justificatifs</h2>
        <p className="text-sm text-gray-500">
          Uploadez votre pièce d'identité pour la vérification de votre profil.
          Formats acceptés : PDF, JPG, PNG (max 10 Mo).
        </p>
      </div>

      {/* Piece d'identite */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Pièce d'identité
        </label>
        <input
          ref={identiteRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => identiteRef.current?.click()}
          disabled={uploading}
          className={`w-full p-4 rounded-lg border-2 border-dashed transition text-sm ${
            identiteFile
              ? 'border-accent bg-gray-50'
              : 'border-gray-400 hover:border-gray-500'
          }`}
        >
          {uploading ? (
            'Upload en cours...'
          ) : identiteFile ? (
            <span>{identiteFile}</span>
          ) : (
            'Cliquez pour sélectionner un fichier'
          )}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Ces documents seront vérifiés par notre équipe.
        Votre profil sera visible une fois la vérification terminée.
      </p>
    </div>
  )
}
