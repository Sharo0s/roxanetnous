import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CookieBanner } from '@/components/cookie-banner'
import { LastSeenTracker } from '@/components/last-seen-tracker'

const inter = Inter({ subsets: ['latin'] })

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'

export const metadata: Metadata = {
  title: {
    default: 'roxanetnous - Accompagnantes de vie verifiees',
    template: '%s | roxanetnous',
  },
  description: 'Trouvez une accompagnante de vie verifiee pres de chez vous. Profils valides manuellement, matching intelligent sur 5 criteres, messagerie securisee.',
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: BASE_URL,
    siteName: 'roxanetnous',
    title: 'roxanetnous - Accompagnantes de vie verifiees',
    description: 'Trouvez une accompagnante de vie verifiee pres de chez vous. Profils valides manuellement, matching intelligent sur 5 criteres, messagerie securisee.',
  },
  twitter: {
    card: 'summary',
    title: 'roxanetnous - Accompagnantes de vie verifiees',
    description: 'Trouvez une accompagnante de vie verifiee pres de chez vous.',
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
        <LastSeenTracker />
        <CookieBanner />
      </body>
    </html>
  )
}
