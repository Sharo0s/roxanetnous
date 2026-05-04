'use client'

import { useMemo, useState, useTransition } from 'react'
import { toggleDepartement, toggleRegion } from '@/app/admin/departements/actions'
import type { Departement } from '@/lib/departements'

type RegionGroup = {
  nom: string
  departements: Departement[]
}

type Props = {
  regions: RegionGroup[]
}

type EtatRegion = 'tous' | 'aucun' | 'partiel'

function etatDeRegion(depts: Departement[]): EtatRegion {
  const ouverts = depts.filter((d) => d.ouvert).length
  if (ouverts === 0) return 'aucun'
  if (ouverts === depts.length) return 'tous'
  return 'partiel'
}

export function DepartementsManager({ regions }: Props) {
  const [etat, setEtat] = useState<RegionGroup[]>(regions)
  const [erreur, setErreur] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [enCours, setEnCours] = useState<Set<string>>(new Set())
  const [depliees, setDepliees] = useState<Set<string>>(() => {
    // Deplier par defaut les regions qui ont au moins un departement ouvert
    const init = new Set<string>()
    for (const r of regions) {
      if (r.departements.some((d) => d.ouvert)) init.add(r.nom)
    }
    return init
  })

  const totalOuverts = useMemo(
    () => etat.reduce((acc, r) => acc + r.departements.filter((d) => d.ouvert).length, 0),
    [etat]
  )

  function toggleReplier(regionNom: string) {
    setDepliees((prev) => {
      const next = new Set(prev)
      if (next.has(regionNom)) next.delete(regionNom)
      else next.add(regionNom)
      return next
    })
  }

  function setEnCoursActif(cle: string, actif: boolean) {
    setEnCours((prev) => {
      const next = new Set(prev)
      if (actif) next.add(cle)
      else next.delete(cle)
      return next
    })
  }

  function handleToggleDept(regionNom: string, code: string, nouveauOuvert: boolean) {
    setErreur(null)
    setEnCoursActif(`d:${code}`, true)

    setEtat((prev) =>
      prev.map((r) =>
        r.nom !== regionNom
          ? r
          : {
              ...r,
              departements: r.departements.map((d) =>
                d.code === code ? { ...d, ouvert: nouveauOuvert } : d
              ),
            }
      )
    )

    startTransition(async () => {
      const res = await toggleDepartement(code, nouveauOuvert)
      setEnCoursActif(`d:${code}`, false)
      if (res.error) {
        setErreur(res.error)
        setEtat((prev) =>
          prev.map((r) =>
            r.nom !== regionNom
              ? r
              : {
                  ...r,
                  departements: r.departements.map((d) =>
                    d.code === code ? { ...d, ouvert: !nouveauOuvert } : d
                  ),
                }
          )
        )
      }
    })
  }

  function handleToggleRegion(regionNom: string, nouveauOuvert: boolean) {
    setErreur(null)
    setEnCoursActif(`r:${regionNom}`, true)
    const snapshot = etat

    setEtat((prev) =>
      prev.map((r) =>
        r.nom !== regionNom
          ? r
          : {
              ...r,
              departements: r.departements.map((d) => ({ ...d, ouvert: nouveauOuvert })),
            }
      )
    )

    startTransition(async () => {
      const res = await toggleRegion(regionNom, nouveauOuvert)
      setEnCoursActif(`r:${regionNom}`, false)
      if (res.error) {
        setErreur(res.error)
        setEtat(snapshot)
      }
    })
  }

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
          {erreur}
        </div>
      )}

      <div className="text-sm text-gray-600">
        {totalOuverts} département{totalOuverts > 1 ? 's' : ''} ouvert{totalOuverts > 1 ? 's' : ''}.
        {pending && <span className="ml-2 text-gray-400">Mise à jour...</span>}
      </div>

      {etat.map((region) => {
        const e = etatDeRegion(region.departements)
        const ouvertsCount = region.departements.filter((d) => d.ouvert).length
        const total = region.departements.length
        const estDepliee = depliees.has(region.nom)

        return (
          <div key={region.nom} className="bg-white border rounded-xl overflow-hidden">
            <div
              className={`flex items-center justify-between px-4 py-3 bg-gray-50 ${
                estDepliee ? 'border-b' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => toggleReplier(region.nom)}
                aria-expanded={estDepliee}
                className="flex items-center gap-3 flex-1 text-left hover:opacity-70 transition-opacity"
              >
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    estDepliee ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <h3 className="font-semibold text-gray-900">{region.nom}</h3>
                <span className="text-xs text-gray-500">
                  {ouvertsCount}/{total}
                </span>
                {e === 'partiel' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Partiel
                  </span>
                )}
                {e === 'tous' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                    Ouverte
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleToggleRegion(region.nom, e !== 'tous')}
                disabled={enCours.has(`r:${region.nom}`)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ml-3 ${
                  e === 'tous'
                    ? 'border-gray-400 text-gray-700 hover:bg-gray-100'
                    : 'border-black bg-black text-white hover:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {e === 'tous' ? 'Tout fermer' : 'Tout ouvrir'}
              </button>
            </div>

            {estDepliee && (
            <ul className="divide-y">
              {region.departements.map((d) => {
                const cleEnCours = enCours.has(`d:${d.code}`)
                return (
                  <li
                    key={d.code}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-gray-500 w-8">{d.code}</span>
                      <span className="text-sm text-gray-900">{d.nom}</span>
                    </div>
                    <label className="inline-flex items-center cursor-pointer">
                      <span
                        className={`text-xs mr-3 ${d.ouvert ? 'text-green-700' : 'text-gray-400'}`}
                      >
                        {d.ouvert ? 'Ouvert' : 'Fermé'}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={d.ouvert}
                        disabled={cleEnCours}
                        onChange={(ev) => handleToggleDept(region.nom, d.code, ev.target.checked)}
                      />
                      <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-green-600 peer-disabled:opacity-50 relative transition-colors">
                        <div
                          className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${
                            d.ouvert ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
