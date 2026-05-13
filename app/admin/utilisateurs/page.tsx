import { createClient } from '@/lib/supabase/server'
import { DIPLOMES } from '@/lib/constants'
import { UtilisateursClient } from '@/components/admin/utilisateurs-client'
import { getDernieresAnnulations } from '@/lib/admin-stats'

export type AccompagnanteRow = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'accompagnant'
  created_at: string
  ville: string | null
  code_postal: string | null
  validation_status: string | null
  validation_source: string | null
  diplomes: string[]
  experience: string | null
  profile_id: string | null
}

export type AccompagneRow = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'accompagne'
  created_at: string
  ville: string | null
  code_postal: string | null
}

export default async function AdminUtilisateursPage() {
  const supabaseAdmin = await createClient({ serviceRole: true })

  // Charger les accompagnants avec leur profil
  // Hint FK necessaire car accompagnants_profiles a 2 FK vers users (user_id + validated_by)
  const { data: auxUsers } = await supabaseAdmin
    .from('users')
    .select(`
      id, email, first_name, last_name, role, created_at,
      accompagnants_profiles!auxiliaires_profiles_user_id_fkey (id, ville, code_postal, validation_status, validation_source, diplomes, experience)
    `)
    .eq('role', 'accompagnant')
    .order('created_at', { ascending: false })
    .limit(5000)

  // Charger les accompagnes avec leur profil
  const { data: benUsers } = await supabaseAdmin
    .from('users')
    .select(`
      id, email, first_name, last_name, role, created_at,
      accompagnes_profiles (ville, code_postal)
    `)
    .eq('role', 'accompagne')
    .order('created_at', { ascending: false })
    .limit(5000)

  const accompagnantes: AccompagnanteRow[] = (auxUsers || []).map((u: any) => {
    const p = Array.isArray(u.accompagnants_profiles)
      ? u.accompagnants_profiles[0]
      : u.accompagnants_profiles
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: 'accompagnant' as const,
      created_at: u.created_at,
      ville: p?.ville || null,
      code_postal: p?.code_postal || null,
      validation_status: p?.validation_status || null,
      validation_source: p?.validation_source || null,
      diplomes: p?.diplomes || [],
      experience: p?.experience || null,
      profile_id: p?.id || null,
    }
  })

  const accompagnes: AccompagneRow[] = (benUsers || []).map((u: any) => {
    const p = Array.isArray(u.accompagnes_profiles)
      ? u.accompagnes_profiles[0]
      : u.accompagnes_profiles
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: 'accompagne' as const,
      created_at: u.created_at,
      ville: p?.ville || null,
      code_postal: p?.code_postal || null,
    }
  })

  // Compter par statut de validation
  const enAttenteCount = accompagnantes.filter(
    (a) => a.validation_status === 'en_attente'
  ).length
  const validesCount = accompagnantes.filter(
    (a) => a.validation_status === 'valide'
  ).length

  const annulations = await getDernieresAnnulations()

  return (
    <>
      <h1 className="sr-only">Utilisateurs</h1>
      <UtilisateursClient
        accompagnantes={accompagnantes}
        accompagnes={accompagnes}
        enAttenteCount={enAttenteCount}
        validesCount={validesCount}
        diplomeLabels={Object.fromEntries(DIPLOMES.map((d) => [d.value, d.label]))}
        annulations={annulations}
      />
    </>
  )
}
