'use client'

import { useState } from 'react'
import { adminGrantSubscription } from '@/app/actions/admin'

type Props = {
  userId: string
  userName: string
}

export function GrantSubscriptionModal({ userId, userName }: Props) {
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<'mensuel' | 'annuel'>('mensuel')
  const [step, setStep] = useState<'choose' | 'loading' | 'done' | 'error'>('choose')
  const [errorMsg, setErrorMsg] = useState('')

  function handleClose() {
    if (step === 'loading') return
    setOpen(false)
    setStep('choose')
    setPlan('mensuel')
    setErrorMsg('')
  }

  async function handleConfirm() {
    setStep('loading')
    const result = await adminGrantSubscription(userId, plan)
    if (result.error) {
      setErrorMsg(result.error)
      setStep('error')
    } else {
      setStep('done')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs font-medium bg-accent text-black rounded-lg hover:bg-accent/80 transition-colors"
      >
        Offrir&nbsp;un&nbsp;abonnement
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative bg-white rounded-xl max-w-md w-full mx-4 p-6">
            {step === 'choose' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Offrir un abonnement
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {userName} recevra un abonnement gratuit (sans paiement).
                </p>

                <div className="space-y-2 mb-6">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-accent transition-colors">
                    <input
                      type="radio"
                      name="plan"
                      value="mensuel"
                      checked={plan === 'mensuel'}
                      onChange={() => setPlan('mensuel')}
                      className="accent-accent"
                    />
                    <div>
                      <div className="text-sm font-medium">Mensuel</div>
                      <div className="text-xs text-gray-400">Renouvellement chaque mois</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-accent transition-colors">
                    <input
                      type="radio"
                      name="plan"
                      value="annuel"
                      checked={plan === 'annuel'}
                      onChange={() => setPlan('annuel')}
                      className="accent-accent"
                    />
                    <div>
                      <div className="text-sm font-medium">Annuel</div>
                      <div className="text-xs text-gray-400">Renouvellement chaque annee</div>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-accent text-black rounded-lg hover:bg-accent/80 transition-colors"
                  >
                    Confirmer
                  </button>
                </div>
              </>
            )}

            {step === 'loading' && (
              <div className="py-8 text-center">
                <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">Creation de l'abonnement...</p>
              </div>
            )}

            {step === 'done' && (
              <div className="py-6 text-center">
                <p className="text-lg font-semibold text-gray-900 mb-2">Abonnement cree</p>
                <p className="text-sm text-gray-500 mb-4">
                  {userName} a maintenant un abonnement {plan} gratuit.
                </p>
                <button
                  onClick={() => {
                    handleClose()
                    window.location.reload()
                  }}
                  className="px-4 py-2 text-sm font-medium bg-accent text-black rounded-lg hover:bg-accent/80 transition-colors"
                >
                  Fermer
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className="py-6 text-center">
                <p className="text-lg font-semibold text-gray-900 mb-2">Erreur</p>
                <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
                <button
                  onClick={() => setStep('choose')}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Reessayer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
