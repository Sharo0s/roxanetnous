'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getBeneficiaireProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data
}

export async function uploadPlanningDocument(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return { error: 'Profil beneficiaire introuvable' }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'Aucun fichier selectionne' }

  const auxiliaireIds = formData.getAll('auxiliaire_ids') as string[]
  if (auxiliaireIds.length === 0) return { error: 'Selectionnez au moins un auxiliaire' }

  // Upload vers storage
  const filePath = `${user.id}/${Date.now()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('planning-documents')
    .upload(filePath, file)

  if (uploadError) return { error: 'Erreur lors de l\'upload' }

  // Insert dans planning_documents
  const { data: doc, error: insertError } = await supabase
    .from('planning_documents')
    .insert({
      beneficiaire_id: profile.id,
      nom_fichier: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type || null,
    })
    .select('id')
    .single()

  if (insertError || !doc) {
    // Cleanup storage si l'insert echoue
    await supabase.storage.from('planning-documents').remove([filePath])
    return { error: 'Erreur lors de l\'enregistrement' }
  }

  // Insert assignments
  const assignments = auxiliaireIds.map(auxId => ({
    document_id: doc.id,
    auxiliaire_user_id: auxId,
  }))

  await supabase.from('planning_document_assignments').insert(assignments)

  revalidatePath('/beneficiaire/planning/documents')
  return { success: true }
}

export async function deletePlanningDocument(documentId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return { error: 'Profil beneficiaire introuvable' }

  // Recuperer le file_path avant de supprimer
  const { data: doc } = await supabase
    .from('planning_documents')
    .select('file_path')
    .eq('id', documentId)
    .eq('beneficiaire_id', profile.id)
    .single()

  if (!doc) return { error: 'Document introuvable' }

  // Supprimer du storage
  await supabase.storage.from('planning-documents').remove([doc.file_path])

  // Supprimer de la table (cascade vers assignments et reads)
  await supabase
    .from('planning_documents')
    .delete()
    .eq('id', documentId)
    .eq('beneficiaire_id', profile.id)

  revalidatePath('/beneficiaire/planning/documents')
  return { success: true }
}

export async function markDocumentAsRead(documentId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('planning_document_reads')
    .upsert(
      { document_id: documentId, user_id: user.id, read_at: new Date().toISOString() },
      { onConflict: 'document_id,user_id' }
    )

  return { success: true }
}

export async function getDocumentsForBeneficiaire() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return []

  const { data: docs } = await supabase
    .from('planning_documents')
    .select('id, nom_fichier, file_path, file_size, mime_type, created_at')
    .eq('beneficiaire_id', profile.id)
    .order('created_at', { ascending: false })

  if (!docs || docs.length === 0) return []

  const docIds = docs.map(d => d.id)

  // Recuperer les assignments et reads
  const [{ data: assignments }, { data: reads }] = await Promise.all([
    supabase.from('planning_document_assignments').select('document_id, auxiliaire_user_id').in('document_id', docIds),
    supabase.from('planning_document_reads').select('document_id, user_id').in('document_id', docIds),
  ])

  // Noms des auxiliaires
  const auxUserIds = [...new Set(assignments?.map(a => a.auxiliaire_user_id) || [])]
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .in('id', auxUserIds.length > 0 ? auxUserIds : ['_none_'])

  const usersMap = new Map(users?.map(u => [u.id, u]) || [])
  const readsByDoc = new Map<string, Set<string>>()
  for (const r of reads || []) {
    const set = readsByDoc.get(r.document_id) || new Set()
    set.add(r.user_id)
    readsByDoc.set(r.document_id, set)
  }

  return docs.map(doc => {
    const docAssignments = assignments?.filter(a => a.document_id === doc.id) || []
    const docReads = readsByDoc.get(doc.id) || new Set()

    return {
      ...doc,
      auxiliaires: docAssignments.map(a => {
        const u = usersMap.get(a.auxiliaire_user_id)
        return {
          user_id: a.auxiliaire_user_id,
          first_name: u?.first_name || '',
          last_name: u?.last_name || '',
          has_read: docReads.has(a.auxiliaire_user_id),
        }
      }),
      read_count: docAssignments.filter(a => docReads.has(a.auxiliaire_user_id)).length,
      total_assigned: docAssignments.length,
    }
  })
}
