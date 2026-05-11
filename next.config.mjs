import { withSentryConfig } from '@sentry/nextjs'
import { withWorkflow } from '@workflow/next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/waitlist',
        destination: '/me-tenir-au-courant',
        permanent: true,
      },
    ]
  },
}

// Story 4.3 : enrobage Vercel Workflow DevKit pour activer les directives
// "use workflow" et "use step" dans le build Next. Cf. doc bundled
// node_modules/workflow/docs/getting-started/next.mdx. La queue durable email
// (lib/workflows/send-email-workflow.ts) en depend.
const nextConfigWithWorkflow = withWorkflow(nextConfig)

// Story 4.1 : instrumentation Sentry transverse. Wrappe nextConfig pour
// brancher l'upload sourcemaps (build-time, requiert SENTRY_AUTH_TOKEN) et
// le tunnel route /monitoring (contourne les ad-blockers cote client).
//
// Decisions :
// - silent: true (logs build minimaux, eviter le bruit en CI Vercel).
// - webpack.automaticVercelMonitors: false (evite la creation de cron monitors
//   redondants avec ceux deja definis dans vercel.json).
// - webpack.treeshake.removeDebugLogging: true (retire le logger Sentry
//   des bundles client). Pattern v10 (remplace l'ancien disableLogger).
// - tunnelRoute: '/monitoring' (route handler genere automatiquement par
//   le SDK pour proxy les events vers Sentry server-side).
export default withSentryConfig(nextConfigWithWorkflow, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  tunnelRoute: '/monitoring',
  webpack: {
    automaticVercelMonitors: false,
    treeshake: {
      removeDebugLogging: true,
    },
  },
})
