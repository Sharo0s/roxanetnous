import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AnnonceStatusToggle } from '@/components/accompagnante/annonce-status-toggle'
import { AnnonceDeleteButton } from '@/components/annonce-delete-button'
import { hasActiveSubscription } from '@/lib/subscription-helpers'
import { AccompagnanteDashboardHeader } from '@/components/layout/accompagnante-dashboard-header'
import { LogoutButton } from '@/components/auth/logout-button'
import { getUnreadCount } from '@/lib/unread-count'

export default async function MesAnnoncesAccompagnante() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('id, validation_status')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.validation_status !== 'valide') redirect('/accompagnante/dashboard')

  const subscribed = await hasActiveSubscription(user.id)
  const unreadCount = await getUnreadCount(user.id)

  const { data: annonces } = await supabase
    .from('annonces_accompagnantes')
    .select('*')
    .eq('accompagnante_id', profile.id)
    .order('created_at', { ascending: false })

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#faf7f2] focus:outline-none">
      <AccompagnanteDashboardHeader
        firstName={userData.first_name}
        lastName={userData.last_name}
        unreadCount={unreadCount}
        currentPage="annonces"
      />

      <div className="max-w-4xl mx-auto px-4 py-10 md:py-14 relative z-10">

        {/* TITRE EDITORIAL + CTA */}
        <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Mon espace</div>
            <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Mes annonces</h1>
            <p className="mt-2 text-sm text-gray-600">
              Publiez et gérez vos offres d&apos;accompagnement.
            </p>
          </div>
          {subscribed && (
            <Link
              href="/accompagnante/annonces/nouvelle"
              className="inline-flex items-center px-5 py-2.5 bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition text-sm font-medium"
            >
              + Nouvelle annonce
            </Link>
          )}
        </header>

        {/* PAYWALL (si non abonne) */}
        {!subscribed && (
          <div className="bg-white rounded-2xl border border-kraft p-6 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[240px]">
              <h2 className="italic text-xl text-gray-900 mb-1">Abonnement requis</h2>
              <p className="text-sm text-gray-600">Souscrivez un abonnement pour publier vos annonces.</p>
            </div>
            <Link
              href="/accompagnante/abonnement"
              className="inline-flex items-center px-5 py-2.5 bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition text-sm font-medium"
            >
              Voir les offres
            </Link>
          </div>
        )}

        {/* LISTE / EMPTY STATE */}
        {!annonces || annonces.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-12 text-center">
            <h2 className="italic text-2xl text-gray-900 mb-2">
              Aucune annonce pour le moment.
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Créez votre première annonce pour commencer à être visible auprès des accompagnées.
            </p>
            {subscribed && (
              <Link
                href="/accompagnante/annonces/nouvelle"
                className="inline-flex items-center px-5 py-2.5 bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition text-sm font-medium"
              >
                Créer ma première annonce
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {annonces.map((annonce) => {
              const isPubliee = annonce.status === 'publiee'
              return (
                <li
                  key={annonce.id}
                  className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[240px]">
                      <div className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-medium mb-2 ${
                        isPubliee ? 'text-green-700' : 'text-gray-400'
                      }`}>
                        <span
                          aria-hidden="true"
                          className={`w-1.5 h-1.5 rounded-full ${isPubliee ? 'bg-green-600' : 'bg-gray-400'}`}
                        />
                        {isPubliee ? 'Publiée' : 'Archivée'}
                      </div>
                      <p className="text-gray-900 font-medium mb-2">
                        {annonce.ville}
                        <span className="text-gray-500 font-normal ml-1">
                          ({annonce.code_postal}) — Rayon {annonce.rayon_km} km
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed max-w-prose">
                        {annonce.description}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span>{annonce.vues} vues</span>
                        <span>{annonce.contacts_count} contacts</span>
                        <span>Publiée le {new Date(annonce.published_at || annonce.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <Link
                        href={`/accompagnante/annonces/${annonce.id}/modifier`}
                        className="inline-flex items-center px-3.5 py-1.5 border border-[#e8dfd2] text-gray-700 rounded-full hover:border-kraft transition text-sm"
                      >
                        Modifier
                      </Link>
                      <AnnonceStatusToggle
                        annonceId={annonce.id}
                        currentStatus={annonce.status}
                        type="accompagnante"
                      />
                      <AnnonceDeleteButton
                        annonceId={annonce.id}
                        type="accompagnante"
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* FOOTER */}
        <div className="mt-16 pt-6 border-t border-[#e8dfd2] flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <Link href="/cgu" className="hover:text-gray-800">Aide</Link>
          <span aria-hidden="true">·</span>
          <Link href="/politique-de-confidentialite" className="hover:text-gray-800">Confidentialité</Link>
          <span aria-hidden="true">·</span>
          <Link href="/cgu" className="hover:text-gray-800">Conditions</Link>
          <span aria-hidden="true">·</span>
          <LogoutButton />
        </div>

      </div>
    </main>
  )
}
