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
        className="inline-flex items-center px-3 py-1.5 text-xs bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition"
      >
        Offrir&nbsp;un&nbsp;abonnement
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl max-w-md w-full mx-4 p-6 border border-[#e8dfd2]">
            {step === 'choose' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1 text-left">
                  Offrir un abonnement
                </h3>
                <p className="text-sm text-gray-500 mb-4 text-left">
                  {userName} recevra un abonnement gratuit (sans paiement).
                </p>

                <div className="flex gap-2 mb-6">
                  <button
                    type="button"
                    onClick={() => setPlan('mensuel')}
                    className={`flex-1 px-4 py-3 rounded-full text-sm transition ${
                      plan === 'mensuel'
                        ? 'bg-accent border border-accent text-black font-medium'
                        : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
                    }`}
                  >
                    Mensuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlan('annuel')}
                    className={`flex-1 px-4 py-3 rounded-full text-sm transition ${
                      plan === 'annuel'
                        ? 'bg-accent border border-accent text-black font-medium'
                        : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
                    }`}
                  >
                    Annuel
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 text-sm border border-[#e8dfd2] rounded-full hover:border-kraft transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-2 text-sm bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition font-medium"
                  >
                    Confirmer
                  </button>
                </div>
              </>
            )}

            {step === 'loading' && (
              <div className="py-8 text-center">
                <div className="inline-block h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">Création de l'abonnement...</p>
              </div>
            )}

            {step === 'done' && (
              <div className="py-6 text-center">
                <p className="text-lg font-semibold text-gray-900 mb-2">Abonnement créé</p>
                <p className="text-sm text-gray-500 mb-4">
                  {userName} a maintenant un abonnement {plan} gratuit.
                </p>
                <button
                  onClick={() => {
                    handleClose()
                    window.location.reload()
                  }}
                  className="px-4 py-2 text-sm bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition font-medium"
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
                  className="px-4 py-2 text-sm border border-[#e8dfd2] rounded-full hover:border-kraft transition"
                >
                  Réessayer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
