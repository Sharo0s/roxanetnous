import { DIPLOMES, EXPERIENCE_LEVELS } from '@/lib/constants'
import type { OnboardingData } from '@/app/auxiliaire/onboarding/page'

type Props = {
  data: OnboardingData
  onChange: (partial: Partial<OnboardingData>) => void
}

export function StepDiplome({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Diplome et experience</h2>
        <p className="text-sm text-gray-500">Indiquez votre qualification et votre niveau d'experience.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Diplome <span className="text-red-500">*</span>
        </label>
        <select
          value={data.diplome}
          onChange={(e) => onChange({ diplome: e.target.value })}
          className="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="">Selectionnez votre diplome</option>
          {DIPLOMES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Experience <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {EXPERIENCE_LEVELS.map((exp) => (
            <label
              key={exp.value}
              className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                data.experience === exp.value
                  ? 'border-black bg-gray-50'
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
          placeholder="Presentez-vous en quelques lignes..."
          rows={4}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
        />
      </div>
    </div>
  )
}
