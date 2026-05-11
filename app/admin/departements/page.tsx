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
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
        <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Où sommes-nous ?</h1>
        <p className="text-sm text-gray-600 mt-3">
          Les départements où Roxane et Nous accueille de nouvelles inscriptions. {totalOuverts} département
          {totalOuverts > 1 ? 's' : ''} ouvert{totalOuverts > 1 ? 's' : ''} sur {departements.length}.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Vos changements sont visibles en moins d&apos;une minute.
        </p>
      </header>

      <DepartementsManager regions={regions} />
    </div>
  )
}
