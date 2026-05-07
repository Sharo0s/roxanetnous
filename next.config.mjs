import { withSentryConfig } from '@sentry/nextjs'

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
}

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
export default withSentryConfig(nextConfig, {
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
