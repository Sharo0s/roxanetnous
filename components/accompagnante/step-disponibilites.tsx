import { JOURS_SEMAINE, CRENEAUX } from '@/lib/constants'
import type { OnboardingData } from '@/app/accompagnante/onboarding/page'

type Props = {
  data: OnboardingData
  onChange: (partial: Partial<OnboardingData>) => void
}

export function StepDisponibilites({ data, onChange }: Props) {
  function toggleCreneau(jour: string, creneau: string) {
    const current = { ...data.disponibilites }
    const jourCreneaux = current[jour] || []

    if (jourCreneaux.includes(creneau)) {
      current[jour] = jourCreneaux.filter((c) => c !== creneau)
      if (current[jour].length === 0) delete current[jour]
    } else {
      current[jour] = [...jourCreneaux, creneau]
    }

    onChange({ disponibilites: current })
  }

  function isSelected(jour: string, creneau: string): boolean {
    return (data.disponibilites[jour] || []).includes(creneau)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Disponibilités</h2>
        <p className="text-sm text-gray-500">
          Indiquez vos créneaux de disponibilité (facultatif).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 font-medium text-gray-700"></th>
              {CRENEAUX.map((c) => (
                <th key={c.value} className="text-center py-2 px-2 font-medium text-gray-700">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {JOURS_SEMAINE.map((jour) => (
              <tr key={jour.value} className="border-t border-gray-100">
                <td className="py-2 pr-4 text-gray-700">{jour.label}</td>
                {CRENEAUX.map((creneau) => (
                  <td key={creneau.value} className="text-center py-2 px-2">
                    <button
                      type="button"
                      onClick={() => toggleCreneau(jour.value, creneau.value)}
                      className={`w-8 h-8 rounded-md border transition ${
                        isSelected(jour.value, creneau.value)
                          ? 'bg-accent border-accent text-black'
                          : 'bg-white border-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {isSelected(jour.value, creneau.value) && (
                        <span className="text-xs">&#10003;</span>
                      )}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
