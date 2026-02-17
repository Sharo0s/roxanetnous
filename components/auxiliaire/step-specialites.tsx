import { SPECIALITES } from '@/lib/constants'
import type { OnboardingData } from '@/app/auxiliaire/onboarding/page'

type Props = {
  data: OnboardingData
  onChange: (partial: Partial<OnboardingData>) => void
}

export function StepSpecialites({ data, onChange }: Props) {
  function toggle(value: string) {
    const current = data.specialites
    if (current.includes(value)) {
      onChange({ specialites: current.filter((s) => s !== value) })
    } else {
      onChange({ specialites: [...current, value] })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Specialites</h2>
        <p className="text-sm text-gray-500">
          Selectionnez les services que vous proposez (minimum 1).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SPECIALITES.map((spec) => (
          <label
            key={spec.value}
            className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
              data.specialites.includes(spec.value)
                ? 'border-black bg-gray-50'
                : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            <input
              type="checkbox"
              checked={data.specialites.includes(spec.value)}
              onChange={() => toggle(spec.value)}
              className="sr-only"
            />
            <span className="text-sm">{spec.label}</span>
          </label>
        ))}
      </div>

      {data.specialites.length > 0 && (
        <p className="text-sm text-gray-500">
          {data.specialites.length} specialite{data.specialites.length > 1 ? 's' : ''} selectionnee{data.specialites.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
