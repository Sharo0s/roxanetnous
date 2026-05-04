'use client'

import { useRef, useState } from 'react'
import { DIPLOMES, EXPERIENCE_LEVELS } from '@/lib/constants'
import type { OnboardingData } from '@/components/accompagnante/onboarding-client'

type Props = {
  data: OnboardingData
  onChange: (partial: Partial<OnboardingData>) => void
  onUpload?: (file: File, type: string) => Promise<boolean>
  onUploadsChange?: (uploads: { cv: boolean; diplomes: Record<string, boolean> }) => void
  isFilleule?: boolean
}

export function StepDiplome({ data, onChange, onUpload, onUploadsChange, isFilleule = false }: Props) {
  const cvRef = useRef<HTMLInputElement>(null)
  const diplomeRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [cvFileName, setCvFileName] = useState<string | null>(null)
  const [diplomeFileNames, setDiplomeFileNames] = useState<Record<string, string>>({})
  const [cvUploaded, setCvUploaded] = useState(false)
  const [diplomesUploaded, setDiplomesUploaded] = useState<Record<string, boolean>>({})

  function notifyUploads(cv: boolean, diplomes: Record<string, boolean>) {
    onUploadsChange?.({ cv, diplomes })
  }

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !onUpload) return
    setUploading('cv')
    const success = await onUpload(file, 'cv')
    if (success) {
      setCvFileName(file.name)
      setCvUploaded(true)
      notifyUploads(true, diplomesUploaded)
    }
    setUploading(null)
  }

  async function handleDiplomeUpload(e: React.ChangeEvent<HTMLInputElement>, diplomeValue: string) {
    const file = e.target.files?.[0]
    if (!file || !onUpload) return
    setUploading(`diplome:${diplomeValue}`)
    const success = await onUpload(file, `diplome:${diplomeValue}`)
    if (success) {
      setDiplomeFileNames((prev) => ({ ...prev, [diplomeValue]: file.name }))
      const updated = { ...diplomesUploaded, [diplomeValue]: true }
      setDiplomesUploaded(updated)
      notifyUploads(cvUploaded, updated)
    }
    setUploading(null)
  }

  function toggleDiplome(value: string) {
    const current = data.diplomes
    let newDiplomes: string[]
    if (current.includes(value)) {
      newDiplomes = current.filter((d) => d !== value)
      const updated = { ...diplomesUploaded }
      delete updated[value]
      setDiplomesUploaded(updated)
      notifyUploads(cvUploaded, updated)
    } else if (value === 'sans_diplome') {
      // Sans diplome = deselectionner tous les autres
      newDiplomes = ['sans_diplome']
      setDiplomesUploaded({})
      setDiplomeFileNames({})
      notifyUploads(cvUploaded, {})
    } else {
      // Selectionner un diplome = retirer "sans_diplome"
      newDiplomes = [...current.filter((d) => d !== 'sans_diplome'), value]
    }
    onChange({ diplomes: newDiplomes })
  }

  const isSansDiplome = data.diplomes.includes('sans_diplome')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Diplôme et expérience</h2>
        <p className="text-sm text-gray-500">Indiquez vos qualifications et votre niveau d'expérience.</p>
      </div>

      {/* CV upload - obligatoire sauf en flow filleule (parrainee) */}
      {onUpload && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Curriculum vitae (CV){' '}
            {isFilleule ? (
              <span className="text-gray-400 font-normal">(optionnel)</span>
            ) : (
              <span className="text-red-500">*</span>
            )}
          </label>
          <input
            ref={cvRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleCvUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => cvRef.current?.click()}
            disabled={uploading === 'cv'}
            className={`w-full p-4 rounded-lg border-2 border-dashed transition text-sm ${
              cvFileName
                ? 'border-accent bg-gray-50'
                : 'border-gray-400 hover:border-gray-500'
            }`}
          >
            {uploading === 'cv'
              ? 'Upload en cours...'
              : cvFileName
                ? cvFileName
                : 'Cliquez pour sélectionner un fichier'}
          </button>
          <p className="text-xs text-gray-400">PDF, JPG, PNG ou WebP (max. 10 Mo)</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Diplômes{' '}
          {isFilleule ? (
            <span className="text-gray-400 font-normal">(optionnel)</span>
          ) : (
            <span className="text-red-500">*</span>
          )}
        </label>
        <p className="text-xs text-gray-400 mb-3">
          {isFilleule
            ? 'Optionnel grâce à votre parrainage. Vous pouvez tout de même les renseigner si vous le souhaitez.'
            : 'Vous pouvez en sélectionner plusieurs. Un justificatif est requis pour chaque diplôme.'}
        </p>
        <div className="space-y-2">
          {DIPLOMES.map((d) => {
            const isSelected = data.diplomes.includes(d.value)
            return (
              <div key={d.value}>
                <label
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                    isSelected
                      ? 'border-accent bg-gray-50'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleDiplome(d.value)}
                    className="sr-only"
                  />
                  <span className="text-sm">{d.label}</span>
                </label>

                {isSelected && onUpload && d.value !== 'sans_diplome' && (
                  <div className="mt-2 ml-4 mb-3">
                    <input
                      ref={(el) => { diplomeRefs.current[d.value] = el }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => handleDiplomeUpload(e, d.value)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => diplomeRefs.current[d.value]?.click()}
                      disabled={uploading === `diplome:${d.value}`}
                      className={`w-full rounded-lg border-2 border-dashed px-4 py-3 text-sm transition ${
                        diplomeFileNames[d.value]
                          ? 'border-accent bg-gray-50 text-gray-700'
                          : 'border-gray-400 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {uploading === `diplome:${d.value}`
                        ? 'Upload en cours...'
                        : diplomeFileNames[d.value]
                          ? diplomeFileNames[d.value]
                          : `Justificatif ${d.label} *`}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG ou WebP (max. 10 Mo)</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Expérience <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {EXPERIENCE_LEVELS.map((exp) => (
            <label
              key={exp.value}
              className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                data.experience === exp.value
                  ? 'border-accent bg-gray-50'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="experience"
                value={exp.value}
                checked={data.experience === exp.value}
                onChange={(e) => onChange({ experience: e.target.value })}
                className="sr-only"
              />
              <span className="text-sm">{exp.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description (facultatif)
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Présentez-vous en quelques lignes..."
          rows={4}
          className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
        />
      </div>
    </div>
  )
}
