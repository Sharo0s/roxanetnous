import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AnnonceStatusToggle } from '@/components/accompagnante/annonce-status-toggle'
import { AnnonceDeleteButton } from '@/components/annonce-delete-button'
import { SPECIALITES } from '@/lib/constants'
import { AccompagneHeader } from '@/components/layout/accompagne-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function MesAnnoncesAccompagne() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const annonces = profile
    ? (await supabase
        .from('annonces_accompagnes')
        .select('*')
        .eq('accompagne_id', profile.id)
        .order('created_at', { ascending: false })
      ).data
    : null

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
      <AccompagneHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="annonces"
      />

      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Mes annonces</h2>
          <Link
            href="/accompagne/annonces/nouvelle"
            className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
          >
            Nouvelle annonce
          </Link>
        </div>

        {!annonces || annonces.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500 mb-4">Vous n&#39;avez pas encore d&#39;annonce.</p>
            <Link
              href="/accompagne/annonces/nouvelle"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Créer ma première annonce
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {annonces.map((annonce) => {
              const specLabels = (annonce.specialites_recherchees as string[]).map(
                (s) => SPECIALITES.find((sp) => sp.value === s)?.label || s
              )
              return (
                <div key={annonce.id} className="bg-white rounded-xl border p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{annonce.titre}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          annonce.status === 'publiee'
                            ? 'bg-accent text-black'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {annonce.status === 'publiee' ? 'Publiée' : 'Archivée'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {annonce.ville} ({annonce.code_postal}) — Début : {new Date(annonce.date_debut).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{annonce.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {specLabels.slice(0, 3).map((label, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                            {label}
                          </span>
                        ))}
                        {specLabels.length > 3 && (
                          <span
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs cursor-default relative group"
                          >
                            +{specLabels.length - 3}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-accent text-black text-xs rounded-lg px-3 py-2 whitespace-nowrap z-50">
                              {specLabels.slice(3).join(', ')}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <Link
                        href={`/accompagne/annonces/${annonce.id}/modifier`}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-400 rounded-lg hover:border-accent transition"
                      >
                        Modifier
                      </Link>
                      <AnnonceStatusToggle
                        annonceId={annonce.id}
                        currentStatus={annonce.status}
                        type="accompagne"
                      />
                      <AnnonceDeleteButton
                        annonceId={annonce.id}
                        type="accompagne"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
