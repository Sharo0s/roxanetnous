import { useRef, useState } from 'react'
import { CityAutocomplete } from '@/components/ui/city-autocomplete'
import { MapRadius } from '@/components/ui/map-radius'
import type { OnboardingData } from '@/components/accompagnante/onboarding-client'

type Props = {
  data: OnboardingData
  onChange: (partial: Partial<OnboardingData>) => void
  onUpload?: (file: File, type: 'permis') => Promise<boolean>
  onPermisUploaded?: (uploaded: boolean) => void
  departementsOuverts: string[]
}

export function StepLocalisation({ data, onChange, onUpload, onPermisUploaded, departementsOuverts }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !onUpload) return
    setUploading(true)
    const success = await onUpload(file, 'permis')
    if (success) {
      setUploadedFileName(file.name)
      onPermisUploaded?.(true)
    }
    setUploading(false)
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Localisation</h2>
        <p className="text-sm text-gray-500">Indiquez votre zone d'intervention.</p>
      </div>

      <CityAutocomplete
        ville={data.ville}
        codePostal={data.code_postal}
        onVilleChange={(ville) => onChange({ ville })}
        onCodePostalChange={(code_postal) => onChange({ code_postal })}
        departementsOuverts={departementsOuverts}
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rayon d'intervention : {data.rayon_km} km
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={data.rayon_km}
          onChange={(e) => onChange({ rayon_km: parseInt(e.target.value) })}
          className="w-full accent-black"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1 km</span>
          <span>100 km</span>
        </div>
      </div>

      <MapRadius ville={data.ville} codePostal={data.code_postal} rayonKm={data.rayon_km} />

      <div className="space-y-3">
        <div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={data.permis_conduire}
              onChange={(e) => onChange({ permis_conduire: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 accent-black"
            />
            <span className="text-sm">Permis de conduire</span>
          </label>

          {data.permis_conduire && onUpload && (
            <div className="mt-3 ml-7">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-gray-400 transition"
              >
                {uploading
                  ? 'Upload en cours...'
                  : uploadedFileName
                    ? `Fichier : ${uploadedFileName}`
                    : 'Joindre un scan du permis de conduire *'}
              </button>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG ou WebP (max. 10 Mo)</p>
            </div>
          )}
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={data.vehicule}
            onChange={(e) => onChange({ vehicule: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 accent-black"
          />
          <span className="text-sm">Véhicule personnel</span>
        </label>
      </div>
    </div>
  )
}
