import { getAllDepartements, type Departement } from '@/lib/departements'
import { DepartementsManager } from '@/components/admin/departements-manager'

export default async function AdminDepartementsPage() {
  const departements = await getAllDepartements()

  const parRegion = new Map<string, Departement[]>()
  for (const d of departements) {
    const liste = parRegion.get(d.region) ?? []
    liste.push(d)
    parRegion.set(d.region, liste)
  }

  const regions = Array.from(parRegion.entries())
    .map(([nom, depts]) => ({
      nom,
      departements: depts.sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom))

  const totalOuverts = departements.filter((d) => d.ouvert).length

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Départements ouverts</h1>
        <p className="text-sm text-gray-600 mt-1">
          Pilotage du déploiement progressif. {totalOuverts} département{totalOuverts > 1 ? 's' : ''} ouvert
          {totalOuverts > 1 ? 's' : ''} sur {departements.length}.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Les changements sont propagés en moins de 30 secondes (cache invalidé immédiatement à
          chaque action).
        </p>
      </div>

      <DepartementsManager regions={regions} />
    </div>
  )
}
