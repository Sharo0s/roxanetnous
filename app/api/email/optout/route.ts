// Endpoint cible des liens "Ne plus recevoir ces rappels" presents dans les
// emails de relance d'onboarding (cron /api/cron/relance-profils-incomplets).
//
// Mode GET uniquement : le destinataire clique le lien depuis sa boite mail,
// pas de formulaire intermediaire. C'est non-conventionnel mais conforme aux
// patterns d'unsubscribe transactionnels (RGPD : action de retrait doit etre
// "aussi simple que la souscription"). Le token signe HMAC garantit qu'on ne
// peut pas opt-out un tiers sans avoir recu son mail.
//
// La route accepte GET sans Auth utilisateur (le token *est* l'auth). Elle
// utilise le service role pour ecrire dans public.users malgre la RLS.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyOptoutToken } from '@/lib/optout-token'

const OPTOUT_TYPE = 'rappels_onboarding'

function htmlResponse(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} - roxanetnous</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; color: #1a1a1a; background: #fefaf8; }
    h1 { font-size: 24px; font-weight: 500; margin: 0 0 16px; font-style: italic; }
    p { color: #4b5563; line-height: 1.6; margin: 0 0 12px; }
    .home { display: inline-block; margin-top: 24px; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
  <a href="/" class="home">Retour sur roxanetnous</a>
</body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const type = request.nextUrl.searchParams.get('type')

  if (!token || type !== OPTOUT_TYPE) {
    return htmlResponse(
      'Lien invalide',
      '<p>Ce lien d\'opt-out est incomplet ou ne correspond pas a un type connu.</p>',
      400
    )
  }

  const result = verifyOptoutToken(token)
  if (!result.ok) {
    const message =
      result.reason === 'expired'
        ? 'Ce lien a expire. Si vous souhaitez ne plus recevoir nos rappels, contactez-nous.'
        : 'Ce lien est invalide ou a ete altere.'
    return htmlResponse('Lien invalide', `<p>${message}</p>`, 400)
  }

  if (result.type !== OPTOUT_TYPE) {
    return htmlResponse('Lien invalide', '<p>Le type d\'opt-out ne correspond pas.</p>', 400)
  }

  const supabase = await createClient({ serviceRole: true })
  const { error } = await supabase
    .from('users')
    .update({ rappels_optout: true })
    .eq('id', result.userId)

  if (error) {
    return htmlResponse(
      'Erreur',
      '<p>Une erreur est survenue. Merci de reessayer plus tard ou de nous contacter.</p>',
      500
    )
  }

  return htmlResponse(
    'C\'est note',
    '<p>Vous ne recevrez plus de rappels par email pour completer votre profil.</p><p>Vous pouvez toujours revenir completer votre profil quand vous le souhaitez.</p>'
  )
}
