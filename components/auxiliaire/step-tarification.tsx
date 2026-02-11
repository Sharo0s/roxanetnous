import { Input } from '@/components/ui/input'
import type { OnboardingData } from '@/app/auxiliaire/onboarding/page'

type Props = {
  data: OnboardingData
  onChange: (partial: Partial<OnboardingData>) => void
}

export function StepTarification({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Tarification</h2>
        <p className="text-sm text-gray-500">Definissez votre tarif horaire et vos options.</p>
      </div>

      <div>
        <Input
          label="Tarif horaire (EUR/h)"
          type="number"
          min={1}
          max={999}
          step={0.5}
          value={data.tarif_horaire || ''}
          onChange={(e) => onChange({ tarif_horaire: parseFloat(e.target.value) || 0 })}
          placeholder="Ex: 25"
          required
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Options tarifaires</p>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-400 transition">
          <input
            type="checkbox"
            checked={data.modulation_pch}
            onChange={(e) => onChange({ modulation_pch: e.target.checked })}
            className="h-4 w-4 mt-0.5 rounded border-gray-300 accent-black"
          />
          <div>
            <span className="text-sm font-medium">Tarif modulable PCH</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Vous acceptez d'adapter votre tarif pour les beneficiaires PCH
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-400 transition">
          <input
            type="checkbox"
            checked={data.modulation_apa}
            onChange={(e) => onChange({ modulation_apa: e.target.checked })}
            className="h-4 w-4 mt-0.5 rounded border-gray-300 accent-black"
          />
          <div>
            <span className="text-sm font-medium">Tarif modulable APA</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Vous acceptez d'adapter votre tarif pour les beneficiaires APA
            </p>
          </div>
        </label>
      </div>
    </div>
  )
}
