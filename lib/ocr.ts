import { createClient } from '@/lib/supabase/server'
import { DIPLOMES } from '@/lib/constants'

type DocumentType = 'identite' | 'diplome' | 'permis' | 'cv'

type CoherenceResult = {
  coherent: boolean
  alerts: string[]
}

type VisionResponse = {
  responses: Array<{
    textAnnotations?: Array<{
      description: string
      locale?: string
    }>
    fullTextAnnotation?: {
      text: string
    }
    error?: {
      message: string
    }
  }>
}

export async function analyzeDocument(
  storagePath: string,
  documentType: DocumentType,
  profileId: string
): Promise<void> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey) {
    console.error('OCR: GOOGLE_CLOUD_VISION_API_KEY non configuree')
    return
  }

  const supabase = await createClient({ serviceRole: true })

  // Verifier si le fichier est un PDF (analyse manuelle requise)
  if (storagePath.toLowerCase().endsWith('.pdf')) {
    await supabase.from('ocr_results').insert({
      accompagnante_profile_id: profileId,
      document_type: documentType,
      storage_path: storagePath,
      extracted_text: null,
      extracted_data: null,
      confidence_score: null,
      coherence_diplome: null,
      coherence_identite: null,
      alerts: ['PDF - analyse manuelle requise'],
    })
    return
  }

  // Telecharger le fichier depuis Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('justificatifs')
    .download(storagePath)

  if (downloadError || !fileData) {
    console.error('OCR: erreur telechargement fichier', downloadError)
    return
  }

  // Convertir en base64
  const buffer = Buffer.from(await fileData.arrayBuffer())
  const base64 = buffer.toString('base64')

  // Appeler Google Cloud Vision API
  const visionResponse = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          },
        ],
      }),
    }
  )

  if (!visionResponse.ok) {
    console.error('OCR: erreur API Vision', visionResponse.status)
    await supabase.from('ocr_results').insert({
      accompagnante_profile_id: profileId,
      document_type: documentType,
      storage_path: storagePath,
      extracted_text: null,
      extracted_data: null,
      confidence_score: null,
      coherence_diplome: null,
      coherence_identite: null,
      alerts: [`Erreur API Vision (${visionResponse.status})`],
    })
    return
  }

  const result: VisionResponse = await visionResponse.json()
  const annotation = result.responses?.[0]

  if (annotation?.error) {
    console.error('OCR: erreur Vision', annotation.error.message)
    await supabase.from('ocr_results').insert({
      accompagnante_profile_id: profileId,
      document_type: documentType,
      storage_path: storagePath,
      extracted_text: null,
      extracted_data: null,
      confidence_score: null,
      coherence_diplome: null,
      coherence_identite: null,
      alerts: [`Erreur Vision: ${annotation.error.message}`],
    })
    return
  }

  const extractedText =
    annotation?.fullTextAnnotation?.text ||
    annotation?.textAnnotations?.[0]?.description ||
    ''

  // Calculer un score de confiance basique (presence de texte)
  const confidenceScore = extractedText.length > 10 ? 80 : extractedText.length > 0 ? 40 : 0

  // Recuperer le profil pour la verification de coherence
  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('*, users:user_id (first_name, last_name)')
    .eq('id', profileId)
    .single()

  let coherenceResult: CoherenceResult = { coherent: false, alerts: [] }
  if (profile) {
    coherenceResult = checkCoherence(extractedText, profile, documentType)
  }

  await supabase.from('ocr_results').insert({
    accompagnante_profile_id: profileId,
    document_type: documentType,
    storage_path: storagePath,
    extracted_text: extractedText.slice(0, 5000),
    extracted_data: {
      text_length: extractedText.length,
      word_count: extractedText.split(/\s+/).filter(Boolean).length,
    },
    confidence_score: confidenceScore,
    coherence_diplome: documentType === 'diplome' ? coherenceResult.coherent : null,
    coherence_identite: documentType === 'identite' ? coherenceResult.coherent : null,
    alerts: coherenceResult.alerts.length > 0 ? coherenceResult.alerts : null,
  })
}

function checkCoherence(
  extractedText: string,
  profile: Record<string, unknown>,
  documentType: DocumentType
): CoherenceResult {
  const alerts: string[] = []
  const textLower = extractedText.toLowerCase()
  const user = profile.users as { first_name?: string; last_name?: string } | null

  if (documentType === 'identite') {
    const firstName = user?.first_name?.toLowerCase() || ''
    const lastName = user?.last_name?.toLowerCase() || ''

    const firstNameFound = firstName.length > 1 && textLower.includes(firstName)
    const lastNameFound = lastName.length > 1 && textLower.includes(lastName)

    if (!firstNameFound && firstName.length > 1) {
      alerts.push(`Prenom "${user?.first_name}" non trouve dans le document`)
    }
    if (!lastNameFound && lastName.length > 1) {
      alerts.push(`Nom "${user?.last_name}" non trouve dans le document`)
    }

    return {
      coherent: firstNameFound && lastNameFound,
      alerts,
    }
  }

  if (documentType === 'diplome') {
    const diplomesValues = (profile.diplomes as string[]) || []
    if (diplomesValues.length === 0 || (diplomesValues.length === 1 && diplomesValues[0] === 'autre')) {
      return { coherent: false, alerts: ['Verification automatique non disponible pour ce type de diplome'] }
    }

    // Verifier si au moins un diplome correspond
    const diplomeInfo = diplomesValues
      .map((v) => DIPLOMES.find((d) => d.value === v))
      .find((d) => d && d.value !== 'autre')

    // Mots-cles associes aux diplomes
    const diplomeKeywords: Record<string, string[]> = {
      deaes: ['deaes', 'accompagnant educatif', 'accompagnant éducatif', 'social'],
      de_accompagnante_vie: ['accompagnante de vie', 'accompagnante vie', 'deavs'],
      aide_soignante: ['aide-soignante', 'aide soignante', 'deas'],
      accompagnante_gerontologie: ['gerontologie', 'gérontologie', 'accompagnante'],
      aide_medico_psychologique: ['medico-psychologique', 'médico-psychologique', 'amp', 'deamp'],
      assistant_soin_gerontologie: ['assistant', 'soin', 'gerontologie', 'gérontologie'],
      assistant_vie_familles: ['assistant', 'vie', 'familles', 'advf'],
      bac_pro_assp: ['bac pro', 'assp', 'accompagnement', 'soins', 'services'],
    }

    if (!diplomeInfo) {
      return { coherent: false, alerts: ['Verification automatique non disponible pour ce type de diplome'] }
    }

    const keywords = diplomeKeywords[diplomeInfo.value] || []
    const matchedKeywords = keywords.filter((kw) => textLower.includes(kw))

    if (matchedKeywords.length === 0) {
      alerts.push(`Aucun mot-cle du diplome "${diplomeInfo.label}" trouve dans le document`)
    }

    return {
      coherent: matchedKeywords.length >= 1,
      alerts,
    }
  }

  if (documentType === 'cv') {
    const firstName = user?.first_name?.toLowerCase() || ''
    const lastName = user?.last_name?.toLowerCase() || ''

    const firstNameFound = firstName.length > 1 && textLower.includes(firstName)
    const lastNameFound = lastName.length > 1 && textLower.includes(lastName)

    const cvKeywords = ['experience', 'expérience', 'formation', 'competence', 'compétence', 'curriculum', 'parcours']
    const hasCvKeyword = cvKeywords.some((kw) => textLower.includes(kw))

    if (!hasCvKeyword) {
      alerts.push('Le document ne semble pas etre un CV')
    }
    if (!firstNameFound && firstName.length > 1) {
      alerts.push(`Prenom "${user?.first_name}" non trouve dans le document`)
    }
    if (!lastNameFound && lastName.length > 1) {
      alerts.push(`Nom "${user?.last_name}" non trouve dans le document`)
    }

    return {
      coherent: hasCvKeyword && firstNameFound && lastNameFound,
      alerts,
    }
  }

  if (documentType === 'permis') {
    const firstName = user?.first_name?.toLowerCase() || ''
    const lastName = user?.last_name?.toLowerCase() || ''

    const hasPermisKeyword = textLower.includes('permis') || textLower.includes('conduire') || textLower.includes('driving')

    const firstNameFound = firstName.length > 1 && textLower.includes(firstName)
    const lastNameFound = lastName.length > 1 && textLower.includes(lastName)

    if (!hasPermisKeyword) {
      alerts.push('Le document ne semble pas etre un permis de conduire')
    }
    if (!firstNameFound && firstName.length > 1) {
      alerts.push(`Prenom "${user?.first_name}" non trouve dans le document`)
    }
    if (!lastNameFound && lastName.length > 1) {
      alerts.push(`Nom "${user?.last_name}" non trouve dans le document`)
    }

    return {
      coherent: hasPermisKeyword && firstNameFound && lastNameFound,
      alerts,
    }
  }

  return { coherent: false, alerts: ['Type de document non reconnu'] }
}
