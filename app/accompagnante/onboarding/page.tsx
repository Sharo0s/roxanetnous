'use client'

import { useState } from 'react'
import { submitOnboarding, uploadJustificatif } from '@/app/actions/accompagnante'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { StepDiplome } from '@/components/accompagnante/step-diplome'
import { StepSpecialites } from '@/components/accompagnante/step-specialites'
import { StepLocalisation } from '@/components/accompagnante/step-localisation'
import { StepDisponibilites } from '@/components/accompagnante/step-disponibilites'

const STEPS = [
  'Diplome et experience',
  'Specialites',
  'Localisation',
  'Disponibilites',
]

export type OnboardingData = {
  diplomes: string[]
  experience: string
  specialites: string[]
  ville: string
  code_postal: string
  rayon_km: number
  disponibilites: Record<string, string[]>
  langues: string[]
  permis_conduire: boolean
  vehicule: boolean
  description: string
}

const initialData: OnboardingData = {
  diplomes: [],
  experience: '',
  specialites: [],
  ville: '',
  code_postal: '',
  rayon_km: 10,
  disponibilites: {},
  langues: [],
  permis_conduire: false,
  vehicule: false,
  description: '',
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>(initialData)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploads, setUploads] = useState<{ cv: boolean; diplomes: Record<string, boolean> }>({ cv: false, diplomes: {} })
  const [permisUploaded, setPermisUploaded] = useState(false)

  function updateData(partial: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...partial }))
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: {
        const isSansDiplome = data.diplomes.includes('sans_diplome')
        const hasAllDiplomeUploads = isSansDiplome || (data.diplomes.length > 0 && data.diplomes.every((d) => uploads.diplomes[d]))
        return data.diplomes.length > 0 && !!data.experience && uploads.cv && hasAllDiplomeUploads
      }
      case 1:
        return data.specialites.length > 0
      case 2:
        return !!data.ville && /^\d{5}$/.test(data.code_postal) && (!data.permis_conduire || permisUploaded)
      case 3:
        return true
      default:
        return false
    }
  }

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    const result = await submitOnboarding(data)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleUpload(file: File, type: string) {
    const formData = new FormData()
    formData.set('file', file)
    formData.set('type', type)
    const result = await uploadJustificatif(formData)
    if (result?.error) {
      setError(result.error)
      return false
    }
    return true
  }

  return (
    <main className="min-h-screen kraft bg-kraft">
      <header className="bg-white border-b relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/accompagnante/dashboard" className="text-xl font-bold text-black">
            roxanetnous
          </Link>
          <span className="text-sm text-gray-500">
            Etape {step + 1} sur {STEPS.length}
          </span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-3xl mx-auto px-4 pt-6 relative z-10">
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i <= step ? 'bg-accent' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-sm text-gray-500">{STEPS[step]}</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 relative z-10">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border p-6">
          {step === 0 && <StepDiplome data={data} onChange={updateData} onUpload={handleUpload} onUploadsChange={setUploads} />}
          {step === 1 && <StepSpecialites data={data} onChange={updateData} />}
          {step === 2 && <StepLocalisation data={data} onChange={updateData} onUpload={handleUpload} onPermisUploaded={setPermisUploaded} />}
          {step === 3 && <StepDisponibilites data={data} onChange={updateData} />}
        </div>

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => { setStep((s) => s - 1); setError(null) }}
            disabled={step === 0}
          >
            Precedent
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => { setStep((s) => s + 1); setError(null) }}
              disabled={!canProceed()}
            >
              Suivant
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Envoi en cours...' : 'Valider mon profil'}
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
