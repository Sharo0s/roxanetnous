import { randomInt } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

// Alphabet 31 chars sans 0/O/1/I/L (lisibilité). Doit rester en sync avec
// app/actions/parrainage.ts (CODE_ALPHABET).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

export function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET.charAt(randomInt(0, CODE_ALPHABET.length))
  }
  return out
}

export type GenerateCodeResult = { code: string } | { error: string }

// Variante système : bypass le check d'authz, le système agit pour le compte
// de l'utilisateur courant après vérification (ex: webhook Stripe, validation admin).
// Module non-'use server' pour éviter d'exposer une Server Action publique sans authz.
export async function generateCodeForUserSystem(userId: string): Promise<GenerateCodeResult> {
  if (!userId) return { error: 'userId manquant.' }
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: existing } = await supabaseAdmin
    .from('parrainages_codes')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing?.code) return { code: existing.code }

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode()
    const { error } = await supabaseAdmin
      .from('parrainages_codes')
      .insert({
        user_id: userId,
        code,
        compteur_confirmes: 0,
        total_recompenses: 0,
      })
    if (!error) return { code }
    if ((error as { code?: string }).code !== '23505') {
      return { error: 'Erreur lors de la création du code de parrainage.' }
    }
    const { data: nowExisting } = await supabaseAdmin
      .from('parrainages_codes')
      .select('code')
      .eq('user_id', userId)
      .maybeSingle()
    if (nowExisting?.code) return { code: nowExisting.code }
  }
  return { error: 'Impossible de générer un code unique après plusieurs tentatives.' }
}
