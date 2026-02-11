import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import Link from 'next/link'
import { AnnonceStatusToggle } from '@/components/auxiliaire/annonce-status-toggle'

export default async function MesAnnoncesAuxiliaire() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'auxiliaire') redirect('/')

  const { data: profile } = await supabase
    .from('auxiliaires_profiles')
    .select('id, validation_status')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.validation_status !== 'valide') redirect('/auxiliaire/dashboard')

  const { data: annonces } = await supabase
    .from('annonces_auxiliaires')
    .select('*')
    .eq('auxiliaire_id', profile.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/auxiliaire/dashboard" className="text-xl font-bold text-black">
              roxanetnous
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {userData.first_name} {userData.last_name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Mes annonces</h2>
          <Link
            href="/auxiliaire/annonces/nouvelle"
            className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
          >
            Nouvelle annonce
          </Link>
        </div>

        {!annonces || annonces.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500 mb-4">Vous n&#39;avez pas encore d&#39;annonce.</p>
            <Link
              href="/auxiliaire/annonces/nouvelle"
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
            >
              Creer ma premiere annonce
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {annonces.map((annonce) => (
              <div key={annonce.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{annonce.titre}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        annonce.status === 'publiee'
                          ? 'bg-black text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {annonce.status === 'publiee' ? 'Publiee' : 'Archivee'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {annonce.ville} ({annonce.code_postal}) — Rayon {annonce.rayon_km} km
                    </p>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{annonce.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span>{annonce.vues} vues</span>
                      <span>{annonce.contacts_count} contacts</span>
                      <span>Publiee le {new Date(annonce.published_at || annonce.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  <AnnonceStatusToggle
                    annonceId={annonce.id}
                    currentStatus={annonce.status}
                    type="auxiliaire"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
