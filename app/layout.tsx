import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { CookieBanner } from '@/components/cookie-banner'
import { LastSeenTracker } from '@/components/last-seen-tracker'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: 'italic',
  variable: '--font-heading',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-body',
  display: 'swap',
})

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'

export const metadata: Metadata = {
  title: {
    default: 'roxanetnous - Accompagnants de vie vérifiés',
    template: '%s | roxanetnous',
  },
  description: 'Trouvez un accompagnant de vie vérifié près de chez vous. Profils validés manuellement, matching intelligent sur 5 critères, messagerie sécurisée.',
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: BASE_URL,
    siteName: 'roxanetnous',
    title: 'roxanetnous - Accompagnants de vie vérifiés',
    description: 'Trouvez un accompagnant de vie vérifié près de chez vous. Profils validés manuellement, matching intelligent sur 5 critères, messagerie sécurisée.',
  },
  twitter: {
    card: 'summary',
    title: 'roxanetnous - Accompagnants de vie vérifiés',
    description: 'Trouvez un accompagnant de vie vérifié près de chez vous.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${playfair.variable} ${inter.variable}`}>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2"
        >
          Aller au contenu principal
        </a>
        {children}
        <LastSeenTracker />
        <CookieBanner />
      </body>
    </html>
  )
}
