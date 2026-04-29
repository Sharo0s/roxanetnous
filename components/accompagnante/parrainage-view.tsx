'use client'

import { useEffect, useRef, useState } from 'react'

type FilleuleStatut = 'inscrite' | 'abonnee' | 'confirme' | 'fraude' | 'bloque'

type Filleule = {
  firstName: string | null
  lastName: string | null
  statut: FilleuleStatut
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
  if (!first && !last) return 'Filleule'
  const formattedFirst = first ? capitalize(first) : ''
  const initialLast = last ? `.${last.charAt(0).toUpperCase()}` : ''
  return `${formattedFirst}${initialLast}`
}

type Props = {
  code: string
  baseUrl: string
  compteur: number
  totalRecompenses: number
  filleules: Array<Filleule>
}

const PALIER = 5

const STATUT_LABELS: Record<FilleuleStatut, string> = {
  inscrite: 'Inscrite',
  abonnee: 'Abonnée',
  confirme: 'Confirmée',
  fraude: '',
  bloque: '',
}

const STATUT_BADGE_CLASS: Record<FilleuleStatut, string> = {
  inscrite: 'bg-gray-100 text-gray-700',
  abonnee: 'bg-amber-50 text-amber-800 border border-amber-200',
  confirme: 'bg-black text-white',
  fraude: '',
  bloque: '',
}

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
    phrase = 'Plus qu’une filleule pour 6 mois offerts'
  } else {
    phrase = `Plus que ${restant} filleules pour 6 mois offerts`
  }

  const filleulesAffichables = filleules.filter((f) => f.statut !== 'fraude' && f.statut !== 'bloque')

  return (
    <div className="space-y-6">
      {/* Bandeau code + boutons */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-lg mb-3">Votre code de parrainage</h2>
        <div
          className="bg-accent/30 rounded-lg py-6 mb-4 text-center font-bold text-black select-all"
          style={{ fontSize: '40px', letterSpacing: '6px' }}
        >
          {code}
        </div>
        <div className="flex flex-wrap gap-2">
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
        <p className="text-sm text-gray-600 mt-4">
          Partagez ce code ou ce lien avec une accompagnante de votre réseau.
          Vous vous portez garante : elle évite la visio et la vérification
          de documents, et publie ses annonces dès la souscription.
        </p>
      </div>

      {/* Bandeau progression vers le palier */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col items-center text-center mb-5">
          <p className="text-2xl font-bold text-black">{phrase}</p>
          {compteur < PALIER && totalRecompenses > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              {totalRecompenses} récompense{totalRecompenses > 1 ? 's' : ''} déjà obtenue{totalRecompenses > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="relative h-4 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="absolute inset-y-0 left-0 bg-black rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="text-xs text-gray-600 text-center">
          {compteurClamped} sur {PALIER} filleules validées
        </div>
      </div>

      {/* Liste des filleules avec mini-progression individuelle */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-lg mb-1">Vos filleules en cours</h2>
        <p className="text-sm text-gray-500 mb-5">
          Une filleule est validée après 30 jours d&apos;abonnement actif.
        </p>

        {filleulesAffichables.length === 0 ? (
          <p className="text-sm text-gray-600">
            Aucune filleule pour le moment. Partagez votre code pour démarrer
            votre premier cycle.
          </p>
        ) : (
          <ul className="flex flex-col gap-5">
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
              let labelClass = 'text-gray-600'

              if (f.statut === 'confirme') {
                label = 'Validée — comptée dans votre cycle'
                percent = 100
                barClass = 'bg-black'
                labelClass = 'text-black font-medium'
              } else if (f.statut === 'abonnee' && joursEcoules !== null && joursRestants !== null) {
                label =
                  joursRestants === 0
                    ? 'Validée aujourd’hui'
                    : `Validée dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''}`
                percent = (joursEcoules / 30) * 100
                barClass = 'bg-accent'
              } else {
                // statut === 'inscrite'
                label = 'En attente de souscription'
                percent = 0
                barClass = 'bg-gray-300'
                labelClass = 'text-gray-400'
              }

              return (
                <li key={`${f.inscriteAt}-${idx}`} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-900 font-medium">
                      {formatFilleuleName(f.firstName, f.lastName)}
                    </span>
                    <span className={`text-xs ${labelClass}`}>{label}</span>
                  </div>
                  <div
                    className="relative h-2 w-full bg-gray-100 rounded-full overflow-hidden"
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
      </div>

      {/* Compteurs synthétiques */}
      <div className="bg-white rounded-xl border p-6 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-black">{filleulesAffichables.length}</p>
          <p className="text-xs text-gray-600 mt-0.5">Filleules invitées</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-black">{compteurClamped}</p>
          <p className="text-xs text-gray-600 mt-0.5">Validées dans ce cycle</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-black">{totalRecompenses}</p>
          <p className="text-xs text-gray-600 mt-0.5">Récompenses gagnées</p>
        </div>
      </div>
    </div>
  )
}
