import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AnnonceStatusToggle } from '@/components/accompagnante/annonce-status-toggle'
import { AnnonceDeleteButton } from '@/components/annonce-delete-button'
import { SPECIALITES } from '@/lib/constants'
import { AccompagneDashboardHeader } from '@/components/layout/accompagne-dashboard-header'
import { LogoutButton } from '@/components/auth/logout-button'
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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <AccompagneDashboardHeader
        firstName={userData.first_name}
        lastName={userData.last_name}
        unreadCount={unreadCount}
        currentPage="annonces"
      />

      <div className="max-w-4xl mx-auto px-4 py-10 md:py-14 relative z-10">

        <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Votre espace</div>
            <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Mes annonces</h1>
            <p className="mt-2 text-sm text-gray-600">
              Décrivez vos besoins et recevez des candidatures d&apos;accompagnants.
            </p>
          </div>
          <Link
            href="/accompagne/annonces/nouvelle"
            className="inline-flex items-center px-5 py-2.5 bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft hover:text-white transition text-sm font-medium"
          >
            + Nouvelle annonce
          </Link>
        </header>

        {!annonces || annonces.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-12 text-center">
            <h2 className="italic text-2xl text-gray-900 mb-2">
              Aucune annonce pour le moment.
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Créez votre première annonce pour décrire vos besoins et recevoir des candidatures.
            </p>
            <Link
              href="/accompagne/annonces/nouvelle"
              className="inline-flex items-center px-5 py-2.5 bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft hover:text-white transition text-sm font-medium"
            >
              Créer ma première annonce
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {annonces.map((annonce) => {
              const isPubliee = annonce.status === 'publiee'
              const specLabels = (annonce.specialites_recherchees as string[]).map(
                (s) => SPECIALITES.find((sp) => sp.value === s)?.label || s
              )
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
                      <h3 className="text-gray-900 font-medium mb-1 truncate">{annonce.titre}</h3>
                      <p className="text-sm text-gray-500 mb-3">
                        {annonce.ville} ({annonce.code_postal}) — Début {new Date(annonce.date_debut).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed max-w-prose">
                        {annonce.description}
                      </p>
                      {specLabels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {specLabels.slice(0, 3).map((label, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full bg-accent/20 text-xs font-medium text-gray-700">
                              {label}
                            </span>
                          ))}
                          {specLabels.length > 3 && (
                            <span className="px-2 py-0.5 rounded-full bg-accent/20 text-xs font-medium text-gray-700">
                              +{specLabels.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <Link
                        href={`/accompagne/annonces/${annonce.id}/modifier`}
                        className="inline-flex items-center px-3.5 py-1.5 border border-[#e8dfd2] text-gray-700 rounded-full hover:border-kraft transition text-sm"
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
                </li>
              )
            })}
          </ul>
        )}

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
