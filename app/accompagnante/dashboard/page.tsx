import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUnreadCount } from '@/lib/unread-count'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { SubscriptionBanner } from '@/components/accompagnante/subscription-banner'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'
import { AvatarUpload } from '@/components/accompagnante/avatar-upload'
import { DisponibleToggle } from '@/components/accompagnante/disponible-toggle'
import { StatusBadge } from '@/components/accompagnante/status-badge'
import { SPECIALITES } from '@/lib/constants'

export default async function AccompagnanteDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role, avatar_url, parrainee_par')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  const isFilleule = !!userData.parrainee_par

  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('id, validation_status, validation_source, diplomes, refus_motif, ville, rayon_km, specialites, disponible, indisponible_jusqu_au')
    .eq('user_id', user.id)
    .single()

  const unreadCount = await getUnreadCount(user.id)
  const subscription = await getSubscriptionStatus(user.id)
  const subscribed = subscription.active

  // Detecte un parrainage bloque (anti-fraude) MAIS uniquement si la filleule
  // n'a pas encore ete validee par un admin. Si l'admin a tranche en faveur
  // de la filleule (validation_status='valide'), sa decision prime sur la
  // detection automatique : on ne lui affiche pas le bandeau "Verification
  // supplementaire en cours" car c'est resolu de son point de vue.
  let hasBlockedParrainage = false
  if (profile?.validation_status !== 'valide') {
    const { data: blockedParrainageRow } = await supabase
      .from('parrainages_filleule_view')
      .select('id')
      .eq('statut', 'bloque')
      .maybeSingle()
    hasBlockedParrainage = !!blockedParrainageRow
  }

  // Le contenu detaille (code, copie, liste filleules, jauge) vit sur
  // /accompagnante/parrainage. Sur le dashboard on n'affiche qu'un teaser
  // tant qu'un code existe et que le compteur peut etre montre.
  let parrainageCode: string | null = null
  let parrainageCompteur = 0
  let parrainageTotalRecompenses = 0

  if (profile?.validation_status === 'valide') {
    const { data: parrainageRow } = await supabase
      .from('parrainages_codes')
      .select('code, compteur_confirmes, total_recompenses')
      .eq('user_id', user.id)
      .maybeSingle()
    parrainageCode = parrainageRow?.code ?? null
    parrainageCompteur = parrainageRow?.compteur_confirmes ?? 0
    parrainageTotalRecompenses = parrainageRow?.total_recompenses ?? 0
  }

  let annoncesCount = 0
  let annoncesPubliees = 0
  if (profile) {
    const { count: total } = await supabase
      .from('annonces_accompagnantes')
      .select('id', { count: 'exact', head: true })
      .eq('accompagnante_id', profile.id)
    annoncesCount = total || 0

    const { count: publiees } = await supabase
      .from('annonces_accompagnantes')
      .select('id', { count: 'exact', head: true })
      .eq('accompagnante_id', profile.id)
      .eq('status', 'publiee')
    annoncesPubliees = publiees || 0
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
      <h1 className="sr-only">Tableau de bord</h1>
      <AccompagnanteHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="dashboard"
      />

      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <div className="flex items-start gap-5 mb-8 bg-white rounded-xl border p-5">
          <AvatarUpload
            currentUrl={userData.avatar_url}
            firstName={userData.first_name || ''}
            lastName={userData.last_name || ''}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">
                {userData.first_name} {userData.last_name}
              </h2>
              {profile && (
                <StatusBadge
                  status={profile.validation_status}
                  source={profile.validation_source as 'manuelle' | 'parrainage' | null}
                />
              )}
            </div>
            {profile?.ville && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {profile.ville}{profile.rayon_km ? ` - Sur ${profile.rayon_km} km` : ''}
              </p>
            )}
            {profile?.specialites && (profile.specialites as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(profile.specialites as string[]).map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-accent/20 text-xs font-medium text-gray-700">
                    {SPECIALITES.find((sp) => sp.value === s)?.label || s}
                  </span>
                ))}
              </div>
            )}
            {profile && (
              <div className="mt-3">
                <DisponibleToggle
                  initial={profile.disponible ?? true}
                  initialIndisponibleJusquAu={profile.indisponible_jusqu_au}
                  compact
                />
              </div>
            )}
          </div>
        </div>

        {hasBlockedParrainage ? (
          // Cas filleule bloquee par la detection anti-fraude (meme_carte,
          // meme_email, etc.). parrainee_par a ete reset a null cote BDD,
          // donc isFilleule=false. La filleule garde acces aux messages
          // (pour echanger avec l'admin), a son profil et a son abonnement
          // (pour pouvoir l'annuler si elle ne souhaite pas attendre).
          // Pas d'acces a la publication d'annonces ou aux demandes tant
          // que pas validee.
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-amber-300 p-6">
              <h2 className="font-semibold text-lg text-black mb-2">
                Vérification supplémentaire en cours
              </h2>
              <p className="text-gray-600 mb-2">
                Votre paiement a bien été reçu et votre abonnement est actif.
                En revanche, notre système a relevé un signal qui nécessite
                une vérification manuelle avant la publication de votre profil.
              </p>
              <p className="text-gray-600 mb-0">
                Un administrateur examinera votre dossier sous 48h ouvrées.
                Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez-nous à{' '}
                <a href="mailto:roxanetnous@outlook.com" className="underline">
                  roxanetnous@outlook.com
                </a>
                .
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-6">
                <h2 className="font-semibold text-lg mb-2">Messages</h2>
                <p className="text-gray-600 mb-4">
                  Échangez avec l&apos;équipe pour résoudre la vérification.
                </p>
                <Link
                  href="/messages"
                  className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                >
                  Voir mes messages
                </Link>
              </div>
              <div className="bg-white rounded-xl border p-6">
                <h2 className="font-semibold text-lg mb-2">Mon profil</h2>
                <p className="text-gray-600 mb-4">
                  Consultez et modifiez vos informations professionnelles.
                </p>
                <Link
                  href="/accompagnante/profil"
                  className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                >
                  Voir mon profil
                </Link>
              </div>
              <div className="bg-white rounded-xl border p-6 md:col-span-2">
                <h2 className="font-semibold text-lg mb-2">Mon abonnement</h2>
                <p className="text-gray-600 mb-4">
                  {subscription.cancelAt
                    ? new Date(subscription.cancelAt).getTime() < Date.now()
                      ? `Abonnement expiré le ${new Date(subscription.cancelAt).toLocaleDateString('fr-FR')}`
                      : `Expire le ${new Date(subscription.cancelAt).toLocaleDateString('fr-FR')}`
                    : subscribed
                      ? `${subscription.planType === 'annuel' ? 'Annuel' : 'Mensuel'} - Prochaine échéance : ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : '-'}`
                      : 'Aucun abonnement actif'}
                </p>
                <Link
                  href="/accompagnante/abonnement"
                  className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                >
                  Gérer mon abonnement
                </Link>
              </div>
            </div>
          </div>
        ) : !profile || (
          isFilleule
            ? !profile.ville
            : !profile.diplomes || profile.diplomes.length === 0
        ) ? (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-lg mb-2">Complétez votre profil</h2>
            <p className="text-gray-600 mb-4">
              Pour apparaître sur la plateforme, vous devez d&#39;abord compléter votre profil professionnel.
            </p>
            <a
              href="/accompagnante/onboarding"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition"
            >
              Compléter mon profil
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {isFilleule && profile.validation_status === 'en_attente' && !subscribed && (
              <div className="bg-white rounded-xl border border-accent p-6">
                <h2 className="font-semibold text-lg text-black mb-2">
                  Plus qu&apos;une étape : souscrivez votre abonnement
                </h2>
                <p className="text-gray-600 mb-4">
                  Votre marraine se porte garante : pas de visio, pas de
                  vérification de documents. Souscrivez à un abonnement et
                  vous pourrez publier votre première annonce.
                </p>
                <Link
                  href="/accompagnante/abonnement"
                  className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                >
                  Souscrire à un abonnement
                </Link>
              </div>
            )}
            {profile.validation_status === 'visio_a_planifier' && (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-sm">
                <p className="font-medium text-blue-900">
                  Votre dossier a été revu. Nous vous avons envoyé un email pour convenir d&apos;un créneau visio avec l&apos;équipe.
                </p>
              </div>
            )}
            {profile.validation_status === 'visio_realisee' && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm">
                <p className="font-medium text-amber-900">
                  Visio réalisée — nous finalisons votre validation.
                </p>
              </div>
            )}
            {(profile.validation_status === 'refuse' || profile.validation_status === 'a_completer') && (
              <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm">
                <p className="font-medium text-red-800">
                  {profile.validation_status === 'refuse'
                    ? 'Votre profil a été refusé. Veuillez corriger les informations demandées.'
                    : 'Des informations complémentaires sont demandées.'}
                </p>
                {profile.refus_motif && (
                  <p className="text-red-700 mt-1">{profile.refus_motif}</p>
                )}
                <Link
                  href="/accompagnante/profil"
                  className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium mt-3"
                >
                  Modifier mon profil
                </Link>
              </div>
            )}

            {profile.validation_status === 'valide' && !subscribed && (
              <SubscriptionBanner />
            )}

            {profile.validation_status === 'valide' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border p-6">
                  <h2 className="font-semibold text-lg mb-2">Mes annonces</h2>
                  {subscribed ? (
                    <>
                      <p className="text-gray-600 mb-1">
                        {annoncesPubliees} annonce{annoncesPubliees > 1 ? 's' : ''} publiée{annoncesPubliees > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-gray-400 mb-4">{annoncesCount} au total</p>
                      <Link
                        href="/accompagnante/annonces"
                        className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                      >
                        Gérer mes annonces
                      </Link>
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Un abonnement est requis pour publier des annonces.
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-xl border p-6">
                  <h2 className="font-semibold text-lg mb-2">Demandes accompagnés</h2>
                  <p className="text-gray-600 mb-4">
                    Consultez les demandes des accompagnés.
                  </p>
                  <Link
                    href="/recherche/demandes"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                  >
                    Voir les demandes
                  </Link>
                </div>

                <div className="bg-white rounded-xl border p-6">
                  <h2 className="font-semibold text-lg mb-2">Messages</h2>
                  <p className="text-gray-600 mb-4">
                    Consultez vos conversations avec les accompagnés.
                  </p>
                  <Link
                    href="/messages"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                  >
                    Voir mes messages
                  </Link>
                </div>

                <div className="bg-white rounded-xl border p-6">
                  <h2 className="font-semibold text-lg mb-2">Mon profil</h2>
                  <p className="text-gray-600 mb-4">
                    Consultez et modifiez vos informations professionnelles.
                  </p>
                  <Link
                    href="/accompagnante/profil"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                  >
                    Voir mon profil
                  </Link>
                </div>

                {parrainageCode && (
                  <div className="bg-white rounded-xl border p-6">
                    <h2 className="font-semibold text-lg mb-2">Mon parrainage</h2>
                    <p className="text-gray-600 mb-4">
                      {parrainageCompteur > 0 || parrainageTotalRecompenses > 0
                        ? `${parrainageCompteur}/5 parrainages confirmés`
                        : 'Partagez votre code et obtenez 6 mois offerts tous les 5 parrainages.'}
                    </p>
                    <Link
                      href="/accompagnante/parrainage"
                      className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                    >
                      Voir mon parrainage
                    </Link>
                  </div>
                )}

                <div className="bg-white rounded-xl border p-6">
                  <h2 className="font-semibold text-lg mb-2">Mon abonnement</h2>
                  <p className="text-gray-600 mb-4">
                    {subscription.status === 'trialing'
                      ? `Essai gratuit - Fin le ${subscription.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString('fr-FR') : subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : '-'}`
                      : subscription.cancelAt
                        ? new Date(subscription.cancelAt).getTime() < Date.now()
                          ? `Abonnement expiré le ${new Date(subscription.cancelAt).toLocaleDateString('fr-FR')}`
                          : `Expire le ${new Date(subscription.cancelAt).toLocaleDateString('fr-FR')}`
                        : subscribed
                          ? `${subscription.planType === 'annuel' ? 'Annuel' : 'Mensuel'} - Prochaine échéance : ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : '-'}`
                          : 'Aucun abonnement actif'}
                  </p>
                  <Link
                    href="/accompagnante/abonnement"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                  >
                    Gérer mon abonnement
                  </Link>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
