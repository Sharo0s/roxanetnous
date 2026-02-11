import { Input } from '@/components/ui/input'
import type { OnboardingData } from '@/app/auxiliaire/onboarding/page'

type Props = {
  data: OnboardingData
  onChange: (partial: Partial<OnboardingData>) => void
}

export function StepLocalisation({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Localisation</h2>
        <p className="text-sm text-gray-500">Indiquez votre zone d'intervention.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Ville"
          value={data.ville}
          onChange={(e) => onChange({ ville: e.target.value })}
          placeholder="Paris"
          required
        />
        <Input
          label="Code postal"
          value={data.code_postal}
          onChange={(e) => onChange({ code_postal: e.target.value })}
          placeholder="75001"
          maxLength={5}
          required
        />
      </div>

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

      <div className="space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={data.permis_conduire}
            onChange={(e) => onChange({ permis_conduire: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 accent-black"
          />
          <span className="text-sm">Permis de conduire</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={data.vehicule}
            onChange={(e) => onChange({ vehicule: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 accent-black"
          />
          <span className="text-sm">Vehicule personnel</span>
        </label>
      </div>
    </div>
  )
}
