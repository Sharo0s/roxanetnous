import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'admin') redirect('/')

  // Recuperer les auxiliaires en attente
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: pending } = await supabaseAdmin
    .from('auxiliaires_profiles')
    .select(`
      id,
      diplome,
      experience,
      specialites,
      ville,
      code_postal,
      validation_status,
      created_at,
      user_id,
      users:user_id (first_name, last_name, email)
    `)
    .eq('validation_status', 'en_attente')
    .order('created_at', { ascending: true })

  // Compter par statut
  const { count: pendingCount } = await supabaseAdmin
    .from('auxiliaires_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'en_attente')

  const { count: validatedCount } = await supabaseAdmin
    .from('auxiliaires_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'valide')

  const { count: totalCount } = await supabaseAdmin
    .from('auxiliaires_profiles')
    .select('id', { count: 'exact', head: true })

  // Stats supplementaires
  const { count: usersCount } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })

  const { count: annoncesAuxCount } = await supabaseAdmin
    .from('annonces_auxiliaires')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'publiee')

  const { count: annoncesBenCount } = await supabaseAdmin
    .from('annonces_beneficiaires')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'publiee')

  const { count: signalementsCount } = await supabaseAdmin
    .from('signalements')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'en_attente')

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-black">roxanetnous</h1>
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/utilisateurs" className="text-sm text-gray-500 hover:text-black">Utilisateurs</Link>
            <Link href="/admin/annonces" className="text-sm text-gray-500 hover:text-black">Annonces</Link>
            <Link href="/admin/avis" className="text-sm text-gray-500 hover:text-black">Avis</Link>
            <Link href="/admin/signalements" className="text-sm text-gray-500 hover:text-black">
              Signalements{(signalementsCount || 0) > 0 && ` (${signalementsCount})`}
            </Link>
            <Link href="/admin/historique" className="text-sm text-gray-500 hover:text-black">Historique</Link>
            <span className="text-sm text-gray-600">
              {userData.first_name} {userData.last_name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h2>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Validation en attente</p>
            <p className="text-3xl font-bold mt-1">{pendingCount || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Profils valides</p>
            <p className="text-3xl font-bold mt-1">{validatedCount || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Utilisateurs</p>
            <p className="text-3xl font-bold mt-1">{usersCount || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Signalements</p>
            <p className="text-3xl font-bold mt-1">{signalementsCount || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Annonces auxiliaires publiees</p>
            <p className="text-3xl font-bold mt-1">{annoncesAuxCount || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Annonces beneficiaires publiees</p>
            <p className="text-3xl font-bold mt-1">{annoncesBenCount || 0}</p>
          </div>
        </div>

        {/* Queue de validation */}
        <h3 className="text-lg font-semibold mb-4">Auxiliaires en attente de validation</h3>

        {!pending || pending.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
            Aucun auxiliaire en attente de validation.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((profile: any) => {
              const u = profile.users as any
              return (
                <Link
                  key={profile.id}
                  href={`/admin/validation/${profile.id}`}
                  className="block bg-white rounded-xl border p-5 hover:border-black transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {u?.first_name} {u?.last_name}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {u?.email}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {profile.ville} ({profile.code_postal}) — {profile.diplome} — {profile.experience}
                      </p>
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(profile.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
