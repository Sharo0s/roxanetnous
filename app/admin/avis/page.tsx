import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminAvisActions } from '@/components/admin/avis-actions'

export default async function AdminAvisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Avis signales en priorite, puis tous les avis recents
  const { data: avisSignales } = await supabaseAdmin
    .from('avis')
    .select(`
      id, note, commentaire, signale, masque, created_at,
      auteur:auteur_id (first_name, last_name, email),
      cible:cible_id (first_name, last_name, email)
    `)
    .eq('signale', true)
    .eq('masque', false)
    .order('created_at', { ascending: false })

  const { data: avisRecents } = await supabaseAdmin
    .from('avis')
    .select(`
      id, note, commentaire, signale, masque, created_at,
      auteur:auteur_id (first_name, last_name, email),
      cible:cible_id (first_name, last_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        {avisSignales && avisSignales.length > 0 && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Avis signalés ({avisSignales.length})</h2>
            <div className="space-y-3 mb-10">
              {avisSignales.map((avis: any) => (
                <AvisCard key={avis.id} avis={avis} showActions adminId={user.id} />
              ))}
            </div>
          </>
        )}

        <h2 className="text-2xl font-bold text-gray-900 mb-4">Avis récents</h2>
        {!avisRecents || avisRecents.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
            Aucun avis.
          </div>
        ) : (
          <div className="space-y-3">
            {avisRecents.map((avis: any) => (
              <AvisCard key={avis.id} avis={avis} showActions={!avis.masque} adminId={user.id} />
            ))}
          </div>
        )}
      </div>
  )
}

function AvisCard({ avis, showActions, adminId }: { avis: any; showActions: boolean; adminId: string }) {
  const auteur = avis.auteur as any
  const cible = avis.cible as any

  return (
    <div className={`bg-white rounded-xl border p-5 hover:border-accent transition-colors ${avis.masque ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className={`w-3 h-3 rounded-sm ${n <= avis.note ? 'bg-accent' : 'bg-gray-200'}`} />
              ))}
            </div>
            {avis.signale && (
              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium border border-gray-400">Signalé</span>
            )}
            {avis.masque && (
              <span className="px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full text-xs font-medium">Masqué</span>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-2">{avis.commentaire}</p>
          <p className="text-xs text-gray-400">
            Par {auteur?.first_name} {auteur?.last_name} ({auteur?.email})
            {' -> '} {cible?.first_name} {cible?.last_name}
            {' — '} {new Date(avis.created_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
        {showActions && (
          <AdminAvisActions avisId={avis.id} isMasque={avis.masque} />
        )}
      </div>
    </div>
  )
}
