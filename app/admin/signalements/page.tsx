import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { SignalementActions } from '@/components/admin/signalement-actions'
import type { Database } from '@/types/supabase'

const CIBLE_TYPE_LABELS: Record<string, string> = {
  user: 'Utilisateur',
  annonce_accompagnant: 'Annonce accompagnant',
  annonce_accompagne: 'Annonce accompagné',
  message: 'Message',
}

const DECISION_LABELS: Record<string, string> = {
  suspendu: 'Suspendu',
  supprime: 'Supprimé',
  averti: 'Averti',
  ignore: 'Ignoré',
}

export default async function AdminSignalementsPage() {
  // Story 4.6 (variante locale SCP) : cast localise au point d'appel.
  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  const { data: signalements } = await supabaseAdmin
    .from('signalements')
    .select(`
      *,
      auteur:users!auteur_id (first_name, last_name, email)
    `)
    .order('created_at', { ascending: false })

  const pendingCount = signalements?.filter((s) => s.status === 'en_attente').length || 0

  return (
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        <header className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
            <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Signalements</h1>
          </div>
          <span className="text-sm text-gray-600">{pendingCount} en attente</span>
        </header>

        {!signalements || signalements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-10 text-center text-gray-500 italic">
            Aucun signalement.
          </div>
        ) : (
          <div className="space-y-3">
            {signalements.map((sig) => {
              const auteur = sig.auteur
              return (
                <div key={sig.id} className="bg-white rounded-2xl border border-[#e8dfd2] p-5 hover:border-kraft transition">
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
                          {sig.status === 'en_attente' ? 'En attente' : sig.status === 'traite' ? 'Traité' : 'Ignoré'}
                        </span>
                        <span className="text-xs text-gray-400">{CIBLE_TYPE_LABELS[sig.cible_type] || sig.cible_type}</span>
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
                          Décision : <span className="font-medium">{DECISION_LABELS[sig.decision] || sig.decision}</span>
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
