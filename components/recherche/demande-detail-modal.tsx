'use client'

import { useEffect, useId, useRef, useState } from 'react'

type Props = {
  titre: string
  ville: string | null
  codePostal: string | null
  dateDebut: string
  description: string
  specialitesLabels: string[]
  diplomeLabel: string | null
  experienceLabel: string | null
  niveauDependanceLabel: string
}

export function DemandeDetailModal({
  titre,
  ville,
  codePostal,
  dateDebut,
  description,
  specialitesLabels,
  diplomeLabel,
  experienceLabel,
  niveauDependanceLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 border border-[#e8dfd2] text-gray-800 rounded-lg text-sm font-medium hover:border-kraft transition w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
      >
        Voir le profil
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative bg-white rounded-2xl max-w-lg w-full mx-4 p-6 shadow-xl max-h-[85vh] overflow-y-auto focus:outline-none"
          >
            <h2 id={titleId} className="italic text-xl text-gray-900 mb-1.5">
              {titre}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {ville} {codePostal && `(${codePostal})`}
              <span className="text-gray-400 mx-1">·</span>
              Début : {new Date(dateDebut).toLocaleDateString('fr-FR')}
            </p>

            <p className="text-sm text-gray-700 mb-5 leading-relaxed whitespace-pre-line">
              {description}
            </p>

            {specialitesLabels.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-2">
                  Besoins recherchés
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {specialitesLabels.map((label, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-accent/20 text-gray-700 rounded-full text-xs"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-6">
              {diplomeLabel && <span>{diplomeLabel}</span>}
              {experienceLabel && <span>{experienceLabel}</span>}
              <span>{niveauDependanceLabel}</span>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-gray-400 text-gray-700 rounded-lg hover:border-gray-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
