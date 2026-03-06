import { createClient } from '@/lib/supabase/server'
import { SignalementActions } from '@/components/admin/signalement-actions'

export default async function AdminSignalementsPage() {
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: signalements } = await supabaseAdmin
    .from('signalements')
    .select(`
      *,
      auteur:auteur_id (first_name, last_name, email)
    `)
    .order('created_at', { ascending: false })

  const pendingCount = signalements?.filter((s) => s.status === 'en_attente').length || 0

  return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Signalements</h2>
          <span className="text-sm text-gray-500">{pendingCount} en attente</span>
        </div>

        {!signalements || signalements.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
            Aucun signalement.
          </div>
        ) : (
          <div className="space-y-3">
            {signalements.map((sig: any) => {
              const auteur = sig.auteur as any
              return (
                <div key={sig.id} className="bg-white rounded-xl border p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          sig.status === 'en_attente'
                            ? 'bg-gray-200 text-gray-700'
                            : sig.status === 'traite'
                              ? 'bg-accent text-black'
                              : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sig.status === 'en_attente' ? 'En attente' : sig.status === 'traite' ? 'Traite' : 'Ignore'}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">{sig.cible_type.replace('_', ' ')}</span>
                      </div>
                      <p className="font-medium text-gray-900">{sig.motif}</p>
                      {sig.description && (
                        <p className="text-sm text-gray-600 mt-1">{sig.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Par {auteur?.first_name} {auteur?.last_name} ({auteur?.email}) — {new Date(sig.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {sig.decision && (
                        <p className="text-xs text-gray-500 mt-1">
                          Decision: <span className="font-medium capitalize">{sig.decision}</span>
                          {sig.notes_admin && ` — ${sig.notes_admin}`}
                        </p>
                      )}
                    </div>
                    {sig.status === 'en_attente' && (
                      <SignalementActions signalementId={sig.id} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
  )
}
