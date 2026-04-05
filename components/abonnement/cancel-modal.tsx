'use client'

import { useState } from 'react'
import { cancelSubscriptionFromModal } from '@/app/actions/subscription'
import type { SubscriptionInfo } from '@/lib/subscription-helpers'

type Step = 'confirm' | 'loading' | 'done' | 'error'

export function CancelModal({ subscription }: { subscription: SubscriptionInfo }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('confirm')
  const [cancelAt, setCancelAt] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const planLabel = subscription.planType === 'annuel' ? 'Annuel' : 'Mensuel'
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR')
    : null

  function handleOpen() {
    setStep('confirm')
    setErrorMessage(null)
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    if (step === 'done') {
      window.location.reload()
    }
  }

  async function handleConfirm() {
    if (step === 'loading') return
    setStep('loading')
    const result = await cancelSubscriptionFromModal()
    if (result.success) {
      setCancelAt(result.cancelAt)
      setStep('done')
    } else {
      setErrorMessage(result.error || 'Une erreur est survenue.')
      setStep('error')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="px-4 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors"
      >
        Resilier mon abonnement
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />
          <div className="relative bg-white rounded-xl max-w-md w-full mx-4 p-6 shadow-xl">
            {step === 'confirm' && (
              <>
                <h3 className="text-lg font-semibold mb-4">Resilier votre abonnement</h3>
                <div className="space-y-3 text-sm text-gray-600 mb-6">
                  <p>Vous etes actuellement sur la formule <strong className="text-gray-900">{planLabel}</strong>.</p>
                  {periodEnd && (
                    <p>Votre acces restera actif jusqu&apos;au <strong className="text-gray-900">{periodEnd}</strong>.</p>
                  )}
                  <p>Apres la resiliation, vous perdrez l&apos;acces a :</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>La visibilite de vos annonces dans les recherches</li>
                    <li>La messagerie</li>
                    <li>Les notifications de matching</li>
                  </ul>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-4 py-2.5 text-sm font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                  >
                    Confirmer la resiliation
                  </button>
                </div>
              </>
            )}

            {step === 'loading' && (
              <div className="flex flex-col items-center py-8">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin mb-4" />
                <p className="text-sm text-gray-600">Resiliation en cours...</p>
              </div>
            )}

            {step === 'done' && (
              <>
                <h3 className="text-lg font-semibold mb-4">Resiliation confirmee</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Votre resiliation a ete prise en compte. Votre acces reste actif jusqu&apos;au{' '}
                  <strong className="text-gray-900">
                    {cancelAt ? new Date(cancelAt).toLocaleDateString('fr-FR') : periodEnd}
                  </strong>.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 text-sm font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}

            {step === 'error' && (
              <>
                <h3 className="text-lg font-semibold mb-4">Erreur</h3>
                <p className="text-sm text-gray-600 mb-6">{errorMessage}</p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('confirm')}
                    className="px-4 py-2.5 text-sm font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                  >
                    Reessayer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
