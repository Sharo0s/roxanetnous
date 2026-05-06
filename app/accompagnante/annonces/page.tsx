import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AnnonceStatusToggle } from '@/components/accompagnante/annonce-status-toggle'
import { AnnonceDeleteButton } from '@/components/annonce-delete-button'
import { hasActiveSubscription } from '@/lib/subscription-helpers'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'
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
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
      <AccompagnanteHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="annonces"
      />

      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mes annonces</h1>
          {subscribed && (
            <Link
              href="/accompagnante/annonces/nouvelle"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Nouvelle annonce
            </Link>
          )}
        </div>

        {!subscribed && (
          <div className="bg-white rounded-xl border-2 border-accent p-6 mb-6">
            <h2 className="font-semibold text-lg mb-2">Abonnement requis</h2>
            <p className="text-gray-600 mb-4">
              Souscrivez un abonnement pour publier vos annonces.
            </p>
            <Link
              href="/accompagnante/abonnement"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Voir les offres
            </Link>
          </div>
        )}

        {!annonces || annonces.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500 mb-4">Vous n&#39;avez pas encore d&#39;annonce.</p>
            {subscribed && (
              <Link
                href="/accompagnante/annonces/nouvelle"
                className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
              >
                Créer ma première annonce
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {annonces.map((annonce) => (
              <div key={annonce.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        annonce.status === 'publiee'
                          ? 'bg-accent text-black'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {annonce.status === 'publiee' ? 'Publiée' : 'Archivée'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {annonce.ville} ({annonce.code_postal}) — Rayon {annonce.rayon_km} km
                    </p>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{annonce.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span>{annonce.vues} vues</span>
                      <span>{annonce.contacts_count} contacts</span>
                      <span>Publiée le {new Date(annonce.published_at || annonce.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/accompagnante/annonces/${annonce.id}/modifier`}
                      className="px-3 py-1.5 border border-gray-400 text-gray-700 rounded-lg hover:border-accent transition text-sm"
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
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
