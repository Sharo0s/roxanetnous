'use client'

import { useEffect, useRef, useState } from 'react'

type FilleuleStatut = 'inscrite' | 'abonnee' | 'confirme' | 'fraude' | 'bloque'

type Filleule = {
  firstName: string | null
  statut: FilleuleStatut
  inscriteAt: string
}

type Props = {
  code: string
  baseUrl: string
  compteur: number
  totalRecompenses: number
  filleules: Array<Filleule>
}

const PALIER = 5
const FILLEULES_DISPLAY_LIMIT = 10

const STATUT_LABELS: Record<FilleuleStatut, string> = {
  inscrite: 'Inscrite',
  abonnee: 'Abonnée',
  confirme: 'Confirmée',
  fraude: '',
  bloque: '',
}

const STATUT_BADGE_CLASS: Record<FilleuleStatut, string> = {
  inscrite: 'bg-gray-100 text-black',
  abonnee: 'bg-gray-200 text-black',
  confirme: 'bg-black text-white',
  fraude: '',
  bloque: '',
}

export function ParrainageCard({ code, baseUrl, compteur, totalRecompenses, filleules }: Props) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inviteLink = `${baseUrl}/register?role=accompagnante&parrainage_code=${encodeURIComponent(code)}`

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopy = async (value: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(null), 2000)
    } catch {
      // navigator.clipboard indisponible (HTTP non-secure ou navigateur ancien) — silencieux
    }
  }

  const compteurClamped = Math.max(0, Math.min(PALIER, compteur))
  const restant = Math.max(0, PALIER - compteurClamped)

  let sousTexte: string
  if (compteur >= PALIER) {
    sousTexte = 'Palier atteint, votre récompense est en cours d’application.'
  } else if (compteur === 0 && totalRecompenses > 0) {
    sousTexte = `Vous avez déjà reçu ${totalRecompenses} récompense${totalRecompenses > 1 ? 's' : ''}. Lancez un nouveau cycle !`
  } else if (compteur === 0 && totalRecompenses === 0) {
    sousTexte = 'Lancez votre premier cycle de parrainage !'
  } else {
    sousTexte = `Plus que ${restant} pour 6 mois offerts`
  }

  const filleulesAffichables = filleules.filter((f) => f.statut !== 'fraude' && f.statut !== 'bloque')
  const filleulesVisibles = filleulesAffichables.slice(0, FILLEULES_DISPLAY_LIMIT)
  const filleulesRestantes = filleulesAffichables.length - filleulesVisibles.length

  return (
    <div className="bg-white rounded-xl border p-6 md:col-span-2">
      <h3 className="font-semibold text-lg mb-2">Votre code de parrainage</h3>

      <div
        className="bg-accent/30 rounded-lg py-5 mb-4 text-center font-bold text-black"
        style={{ fontSize: '32px', letterSpacing: '4px' }}
      >
        {code}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => handleCopy(code, 'code')}
          className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
        >
          {copied === 'code' ? 'Copié' : 'Copier le code'}
        </button>
        <button
          type="button"
          onClick={() => handleCopy(inviteLink, 'link')}
          className="inline-flex items-center px-4 py-2 bg-white text-black border border-black rounded-lg btn-hover transition text-sm font-medium"
        >
          {copied === 'link' ? 'Copié' : 'Copier le lien d’invitation'}
        </button>
      </div>

      <div className="my-4 text-center">
        <p className="font-bold text-lg text-black">{compteurClamped}/{PALIER} parrainages confirmés</p>
        <p className="text-sm text-gray-600 mt-1">{sousTexte}</p>
        <div className="flex justify-center gap-2 mt-3" aria-hidden="true">
          {Array.from({ length: PALIER }).map((_, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded ${i < compteurClamped ? 'bg-black' : 'bg-white border border-black'}`}
            />
          ))}
        </div>
      </div>

      {filleulesVisibles.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium text-sm mb-2">Vos filleules</h4>
          <ul className="flex flex-col gap-1">
            {filleulesVisibles.map((f, idx) => (
              <li
                key={`${f.inscriteAt}-${idx}`}
                className="flex items-center justify-between text-sm py-1"
              >
                <span className="text-gray-800">{f.firstName ?? 'Filleule'}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUT_BADGE_CLASS[f.statut]}`}>
                  {STATUT_LABELS[f.statut]}
                </span>
              </li>
            ))}
          </ul>
          {filleulesRestantes > 0 && (
            <p className="text-xs text-gray-500 mt-2">…et {filleulesRestantes} autres</p>
          )}
        </div>
      )}

      <p className="text-sm text-gray-600 mt-4">
        Partagez ce code ou ce lien avec une accompagnante de votre réseau.
        À son inscription, elle évite la visio et est validée
        automatiquement dès qu’elle souscrit son abonnement.
      </p>
    </div>
  )
}
