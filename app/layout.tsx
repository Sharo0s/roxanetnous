import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CookieBanner } from '@/components/cookie-banner'

const inter = Inter({ subsets: ['latin'] })

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'

export const metadata: Metadata = {
  title: {
    default: 'roxanetnous - Auxiliaires de vie verifies',
    template: '%s | roxanetnous',
  },
  description: 'Trouvez un auxiliaire de vie verifie pres de chez vous. Profils valides manuellement, matching intelligent sur 5 criteres, messagerie securisee.',
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: BASE_URL,
    siteName: 'roxanetnous',
    title: 'roxanetnous - Auxiliaires de vie verifies',
    description: 'Trouvez un auxiliaire de vie verifie pres de chez vous. Profils valides manuellement, matching intelligent sur 5 criteres, messagerie securisee.',
  },
  twitter: {
    card: 'summary',
    title: 'roxanetnous - Auxiliaires de vie verifies',
    description: 'Trouvez un auxiliaire de vie verifie pres de chez vous.',
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
    <html lang="fr">
      <body className={inter.className}>
        {children}
        <CookieBanner />
      </body>
    </html>
  )
}
