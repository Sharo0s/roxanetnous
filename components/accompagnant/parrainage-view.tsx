'use client'

import { useEffect, useRef, useState } from 'react'

type FilleulStatut = 'inscrite' | 'abonnee' | 'confirme' | 'fraude' | 'bloque'

type Filleul = {
  firstName: string | null
  lastName: string | null
  statut: FilleulStatut
  inscriteAt: string
  abonneeAt: string | null
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// Format compact pour preserver la confidentialite : "Marie.D" au lieu
// du nom complet, en respectant la capitalisation (Marie, pas MARIE).
function formatFilleuleName(firstName: string | null, lastName: string | null): string {
  const first = (firstName || '').trim()
  const last = (lastName || '').trim()
  if (!first && !last) return 'Filleul'
  const formattedFirst = first ? capitalize(first) : ''
  const initialLast = last ? `.${last.charAt(0).toUpperCase()}` : ''
  return `${formattedFirst}${initialLast}`
}

type Props = {
  code: string
  baseUrl: string
  compteur: number
  totalRecompenses: number
  filleules: Array<Filleul>
}

const PALIER = 5

function joursRestantsAvantConfirmation(abonneeAt: string | null): number | null {
  if (!abonneeAt) return null
  const dateAbonnee = new Date(abonneeAt).getTime()
  const cible = dateAbonnee + 30 * 24 * 60 * 60 * 1000
  const restant = Math.ceil((cible - Date.now()) / (24 * 60 * 60 * 1000))
  return Math.max(0, restant)
}

export function ParrainageView({ code, baseUrl, compteur, totalRecompenses, filleules }: Props) {
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
      // navigator.clipboard indisponible (HTTP non-secure ou navigateur ancien)
    }
  }

  const compteurClamped = Math.max(0, Math.min(PALIER, compteur))
  const restant = Math.max(0, PALIER - compteurClamped)
  const progressPercent = (compteurClamped / PALIER) * 100

  let phrase: string
  if (compteur >= PALIER) {
    phrase = 'Palier atteint, votre récompense est en cours d’application.'
  } else if (compteur === 0 && totalRecompenses === 0) {
    phrase = 'Lancez votre premier cycle de parrainage'
  } else if (compteur === 0 && totalRecompenses > 0) {
    phrase = `Vous avez déjà reçu ${totalRecompenses} récompense${totalRecompenses > 1 ? 's' : ''}, lancez un nouveau cycle`
  } else if (restant === 1) {
    phrase = 'Plus qu’un filleul pour 6 mois offerts'
  } else {
    phrase = `Plus que ${restant} filleuls pour 6 mois offerts`
  }

  const filleulesAffichables = filleules.filter((f) => f.statut !== 'fraude' && f.statut !== 'bloque')

  return (
    <div className="space-y-6">
      {/* Carte code (centree, valeur en degrade accent) */}
      <div className="bg-white rounded-2xl border border-[#e8dfd2] p-8 text-center">
        <div className="text-xs uppercase tracking-[0.14em] text-kraft mb-4">Votre code</div>
        <div
          className="rounded-xl py-6 mb-6 italic text-gray-900 select-all"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2.4rem',
            letterSpacing: '0.4rem',
            backgroundImage: 'linear-gradient(135deg, #faecd9 0%, #f4d8b9 100%)',
          }}
        >
          {code}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={() => handleCopy(code, 'code')}
            className="inline-flex items-center px-5 py-2 bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition text-sm font-medium"
          >
            {copied === 'code' ? 'Copié' : 'Copier le code'}
          </button>
          <button
            type="button"
            onClick={() => handleCopy(inviteLink, 'link')}
            className="inline-flex items-center px-5 py-2 bg-white border border-[#e8dfd2] text-gray-900 rounded-full hover:border-kraft transition text-sm"
          >
            {copied === 'link' ? 'Copié' : 'Copier le lien d’invitation'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-6 max-w-md mx-auto leading-relaxed">
          Partagez ce code ou ce lien avec un accompagnant de votre réseau.
          Vous vous portez garant : il évite la visio et publie ses annonces dès la souscription.
        </p>
      </div>

      {/* Carte progression (phrase italic + barre kraft) */}
      <div className="bg-white rounded-2xl border border-[#e8dfd2] p-8 text-center">
        <p className="italic text-xl md:text-2xl text-gray-900 leading-snug mb-2">{phrase}</p>
        {compteur < PALIER && totalRecompenses > 0 && (
          <p className="text-sm text-gray-600 mb-4">
            {totalRecompenses} récompense{totalRecompenses > 1 ? 's' : ''} déjà obtenue{totalRecompenses > 1 ? 's' : ''}
          </p>
        )}
        <div className="relative h-1.5 w-full bg-[#f1eade] rounded-full overflow-hidden mt-6 mb-2">
          <div
            className="absolute inset-y-0 left-0 bg-kraft rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="text-xs text-gray-500">
          {compteurClamped} sur {PALIER} filleuls validés
        </div>
      </div>

      {/* Liste filleules */}
      <section>
        <h2 className="text-center italic text-xl text-gray-900 mb-1">Vos filleuls en cours</h2>
        <p className="text-center text-sm text-gray-600 mb-6">
          Un filleul est validé après 30 jours d&apos;abonnement actif.
        </p>

        {filleulesAffichables.length === 0 ? (
          <p className="text-center text-sm text-gray-500 italic py-6">
            Aucun filleul pour le moment. Partagez votre code pour démarrer votre premier cycle.
          </p>
        ) : (
          <ul className="space-y-2">
            {filleulesAffichables.map((f, idx) => {
              const joursRestants =
                f.statut === 'abonnee'
                  ? joursRestantsAvantConfirmation(f.abonneeAt)
                  : null
              const joursEcoules =
                f.statut === 'abonnee' && joursRestants !== null
                  ? Math.max(0, 30 - joursRestants)
                  : null

              let label: string
              let percent: number
              let barClass: string
              let labelClass = 'text-gray-500'

              if (f.statut === 'confirme') {
                label = 'Validé — compté dans votre cycle'
                percent = 100
                barClass = 'bg-green-600'
                labelClass = 'text-green-700 font-medium'
              } else if (f.statut === 'abonnee' && joursEcoules !== null && joursRestants !== null) {
                label =
                  joursRestants === 0
                    ? 'Validé aujourd’hui'
                    : `Validé dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''}`
                percent = (joursEcoules / 30) * 100
                barClass = 'bg-kraft'
              } else {
                label = 'En attente de souscription'
                percent = 0
                barClass = 'bg-gray-200'
                labelClass = 'text-gray-400'
              }

              return (
                <li
                  key={`${f.inscriteAt}-${idx}`}
                  className="bg-white border border-[#e8dfd2] rounded-xl px-5 py-3"
                >
                  <div className="flex items-center justify-between mb-2 gap-4">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {formatFilleuleName(f.firstName, f.lastName)}
                    </span>
                    <span className={`text-xs ${labelClass} flex-shrink-0`}>{label}</span>
                  </div>
                  <div
                    className="relative h-1 w-full bg-[#f1eade] rounded-full overflow-hidden"
                    aria-hidden="true"
                  >
                    <div
                      className={`absolute inset-y-0 left-0 ${barClass} rounded-full transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Compteurs synthetiques */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white border border-[#e8dfd2] rounded-xl p-5 text-center">
          <p className="italic text-3xl text-gray-900">{filleulesAffichables.length}</p>
          <p className="text-xs text-gray-600 mt-1">filleuls invités</p>
        </div>
        <div className="bg-white border border-[#e8dfd2] rounded-xl p-5 text-center">
          <p className="italic text-3xl text-gray-900">{compteurClamped}</p>
          <p className="text-xs text-gray-600 mt-1">validés ce cycle</p>
        </div>
        <div className="bg-white border border-[#e8dfd2] rounded-xl p-5 text-center">
          <p className="italic text-3xl text-gray-900">{totalRecompenses}</p>
          <p className="text-xs text-gray-600 mt-1">récompense{totalRecompenses > 1 ? 's' : ''} gagnée{totalRecompenses > 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  )
}
