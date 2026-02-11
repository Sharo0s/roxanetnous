import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import Link from 'next/link'
import { AnnonceStatusToggle } from '@/components/auxiliaire/annonce-status-toggle'
import { SPECIALITES } from '@/lib/constants'

export default async function MesAnnoncesBeneficiaire() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'beneficiaire') redirect('/')

  const { data: profile } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const annonces = profile
    ? (await supabase
        .from('annonces_beneficiaires')
        .select('*')
        .eq('beneficiaire_id', profile.id)
        .order('created_at', { ascending: false })
      ).data
    : null

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/beneficiaire/dashboard" className="text-xl font-bold text-black">
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
            href="/beneficiaire/annonces/nouvelle"
            className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
          >
            Nouvelle annonce
          </Link>
        </div>

        {!annonces || annonces.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500 mb-4">Vous n&#39;avez pas encore d&#39;annonce.</p>
            <Link
              href="/beneficiaire/annonces/nouvelle"
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
            >
              Creer ma premiere annonce
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
                        {annonce.ville} ({annonce.code_postal}) — Debut: {new Date(annonce.date_debut).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{annonce.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {specLabels.slice(0, 3).map((label, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                            {label}
                          </span>
                        ))}
                        {specLabels.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                            +{specLabels.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                    <AnnonceStatusToggle
                      annonceId={annonce.id}
                      currentStatus={annonce.status}
                      type="beneficiaire"
                    />
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
