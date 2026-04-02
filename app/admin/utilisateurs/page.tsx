import { createClient } from '@/lib/supabase/server'
import { DIPLOMES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { UtilisateursClient } from '@/components/admin/utilisateurs-client'

export type AuxiliaireRow = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'auxiliaire'
  created_at: string
  ville: string | null
  code_postal: string | null
  validation_status: string | null
  diplomes: string[]
  experience: string | null
  profile_id: string | null
}

export type BeneficiaireRow = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'beneficiaire'
  created_at: string
  ville: string | null
  code_postal: string | null
}

export default async function AdminUtilisateursPage() {
  const supabaseAdmin = await createClient({ serviceRole: true })

  // Charger les auxiliaires avec leur profil
  // Hint FK necessaire car auxiliaires_profiles a 2 FK vers users (user_id + validated_by)
  const { data: auxUsers } = await supabaseAdmin
    .from('users')
    .select(`
      id, email, first_name, last_name, role, created_at,
      auxiliaires_profiles!auxiliaires_profiles_user_id_fkey (id, ville, code_postal, validation_status, diplomes, experience)
    `)
    .eq('role', 'auxiliaire')
    .order('created_at', { ascending: false })
    .limit(5000)

  // Charger les beneficiaires avec leur profil
  const { data: benUsers } = await supabaseAdmin
    .from('users')
    .select(`
      id, email, first_name, last_name, role, created_at,
      beneficiaires_profiles (ville, code_postal)
    `)
    .eq('role', 'beneficiaire')
    .order('created_at', { ascending: false })
    .limit(5000)

  const auxiliaires: AuxiliaireRow[] = (auxUsers || []).map((u: any) => {
    const p = Array.isArray(u.auxiliaires_profiles)
      ? u.auxiliaires_profiles[0]
      : u.auxiliaires_profiles
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: 'auxiliaire' as const,
      created_at: u.created_at,
      ville: p?.ville || null,
      code_postal: p?.code_postal || null,
      validation_status: p?.validation_status || null,
      diplomes: p?.diplomes || [],
      experience: p?.experience || null,
      profile_id: p?.id || null,
    }
  })

  const beneficiaires: BeneficiaireRow[] = (benUsers || []).map((u: any) => {
    const p = Array.isArray(u.beneficiaires_profiles)
      ? u.beneficiaires_profiles[0]
      : u.beneficiaires_profiles
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: 'beneficiaire' as const,
      created_at: u.created_at,
      ville: p?.ville || null,
      code_postal: p?.code_postal || null,
    }
  })

  // Compter par statut de validation
  const enAttenteCount = auxiliaires.filter(
    (a) => a.validation_status === 'en_attente'
  ).length
  const validesCount = auxiliaires.filter(
    (a) => a.validation_status === 'valide'
  ).length

  return (
    <UtilisateursClient
      auxiliaires={auxiliaires}
      beneficiaires={beneficiaires}
      enAttenteCount={enAttenteCount}
      validesCount={validesCount}
      diplomeLabels={Object.fromEntries(DIPLOMES.map((d) => [d.value, d.label]))}
      experienceLabels={Object.fromEntries(EXPERIENCE_LEVELS.map((e) => [e.value, e.label]))}
    />
  )
}
