// Story 4.1 AC6 : endpoint ephemere pour valider la chaine Sentry sur preview
// Vercel. A SUPPRIMER avant merge en main (commit dedie).
//
// Procedure de validation :
// 1. Configurer NEXT_PUBLIC_SENTRY_DSN + SENTRY_DSN + SENTRY_ORG +
//    SENTRY_PROJECT sur Vercel scope preview.
// 2. Deployer la preview, hit https://<preview-url>/api/test-sentry.
// 3. Verifier reception de l'event sur le dashboard Sentry avec les tags
//    flow=test, signal=test-endpoint, severity=warning.
// 4. Documenter l'URL Sentry de l'event dans Dev Agent Record > Completion
//    Notes (story 4.1).
// 5. SUPPRIMER ce fichier avec un commit dedie avant merge final.

import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function GET() {
  // Review 2026-05-07 (D2) : ceinture+bretelles. La spec exige la suppression
  // de ce fichier avant merge final ; ce guard neutralise l'endpoint si l'oubli
  // arrive en production (DoS quota Sentry + fingerprint SDK actif).
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 })
  }

  Sentry.captureMessage('test-sentry endpoint hit (story 4.1 validation)', {
    level: 'warning',
    tags: { flow: 'test', signal: 'test-endpoint', severity: 'warning' },
    extra: { story: '4.1', purpose: 'validate Sentry pipeline on preview' },
  })

  try {
    throw new Error('test-sentry: erreur volontaire pour validation captureException')
  } catch (err) {
    Sentry.captureException(err, {
      tags: { flow: 'test', signal: 'test-endpoint', severity: 'warning' },
      extra: { story: '4.1' },
    })
  }

  return NextResponse.json({
    ok: true,
    message: 'Sentry test events emitted (captureMessage + captureException). Verify on Sentry dashboard.',
  })
}
