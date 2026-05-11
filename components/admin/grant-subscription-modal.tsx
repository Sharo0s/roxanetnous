'use client'

import { useState } from 'react'
import { adminGrantSubscription, type GrantSubscriptionMode } from '@/app/actions/admin'

type Props = {
  userId: string
  userName: string
}

type PlanChoice = 'mensuel' | 'annuel' | 'lifetime' | 'custom'

const PLAN_LABEL: Record<PlanChoice, string> = {
  mensuel: 'Mensuel',
  annuel: 'Annuel',
  lifetime: 'À vie',
  custom: 'Personnalisée',
}

const PLAN_HINT: Record<PlanChoice, string> = {
  mensuel: 'Renouvellement automatique gratuit chaque mois. Pour interrompre, utilisez « Annuler l\'abonnement » sur son profil.',
  annuel: 'Renouvellement automatique gratuit chaque année. Pour interrompre, utilisez « Annuler l\'abonnement » sur son profil.',
  lifetime: 'Renouvellement automatique gratuit chaque année. Pour interrompre, utilisez « Annuler l\'abonnement » sur son profil.',
  custom: 'S\'arrête automatiquement après la durée choisie. Pour interrompre avant, utilisez « Annuler l\'abonnement » sur son profil.',
}

export function GrantSubscriptionModal({ userId, userName }: Props) {
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<PlanChoice>('mensuel')
  const [customMonths, setCustomMonths] = useState(6)
  const [step, setStep] = useState<'choose' | 'loading' | 'done' | 'error'>('choose')
  const [errorMsg, setErrorMsg] = useState('')

  function handleClose() {
    if (step === 'loading') return
    setOpen(false)
    setStep('choose')
    setPlan('mensuel')
    setCustomMonths(6)
    setErrorMsg('')
  }

  async function handleConfirm() {
    setStep('loading')
    let mode: GrantSubscriptionMode
    if (plan === 'custom') {
      if (!Number.isInteger(customMonths) || customMonths < 1 || customMonths > 36) {
        setErrorMsg('Durée invalide (1 à 36 mois).')
        setStep('error')
        return
      }
      mode = { kind: 'custom', durationMonths: customMonths }
    } else if (plan === 'lifetime') {
      mode = { kind: 'lifetime' }
    } else {
      mode = { kind: plan }
    }
    const result = await adminGrantSubscription(userId, mode)
    if (result.error) {
      setErrorMsg(result.error)
      setStep('error')
    } else {
      setStep('done')
    }
  }

  const planButtonClass = (active: boolean) =>
    `px-4 py-3 rounded-full text-sm transition ${
      active
        ? 'bg-accent border border-accent text-black font-medium'
        : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
    }`

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

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button type="button" onClick={() => setPlan('mensuel')} className={planButtonClass(plan === 'mensuel')}>
                    {PLAN_LABEL.mensuel}
                  </button>
                  <button type="button" onClick={() => setPlan('annuel')} className={planButtonClass(plan === 'annuel')}>
                    {PLAN_LABEL.annuel}
                  </button>
                  <button type="button" onClick={() => setPlan('lifetime')} className={planButtonClass(plan === 'lifetime')}>
                    {PLAN_LABEL.lifetime}
                  </button>
                  <button type="button" onClick={() => setPlan('custom')} className={planButtonClass(plan === 'custom')}>
                    {PLAN_LABEL.custom}
                  </button>
                </div>

                {plan === 'custom' && (
                  <label htmlFor="grant-duration" className="block mb-3">
                    <span className="block text-sm text-gray-700 mb-2">Durée en mois (1 à 36)</span>
                    <input
                      id="grant-duration"
                      type="number"
                      min={1}
                      max={36}
                      value={customMonths}
                      onChange={(e) => setCustomMonths(Number(e.target.value))}
                      className="w-full px-4 py-2 text-sm border border-[#e8dfd2] rounded-full focus:outline-none focus:border-kraft"
                    />
                  </label>
                )}

                <p className="text-xs text-gray-500 mb-6 px-1">{PLAN_HINT[plan]}</p>

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
                <p className="text-sm text-gray-500">Création de l&apos;abonnement...</p>
              </div>
            )}

            {step === 'done' && (
              <div className="py-6 text-center">
                <p className="text-lg font-semibold text-gray-900 mb-2">Abonnement créé</p>
                <p className="text-sm text-gray-500 mb-4">
                  {userName} a maintenant un abonnement gratuit
                  {plan === 'custom'
                    ? ` pour ${customMonths} mois.`
                    : plan === 'lifetime'
                      ? ' à vie.'
                      : ` ${plan}.`}
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
