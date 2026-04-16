import type { Metadata } from 'next'
import { Satisfy, The_Girl_Next_Door } from 'next/font/google'
import './globals.css'
import { CookieBanner } from '@/components/cookie-banner'
import { LastSeenTracker } from '@/components/last-seen-tracker'

const satisfy = Satisfy({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-heading',
  display: 'swap',
})

const girlNextDoor = The_Girl_Next_Door({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-body',
  display: 'swap',
})

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'

export const metadata: Metadata = {
  title: {
    default: 'roxanetnous - Accompagnantes de vie vérifiées',
    template: '%s | roxanetnous',
  },
  description: 'Trouvez une accompagnante de vie vérifiée près de chez vous. Profils validés manuellement, matching intelligent sur 5 critères, messagerie sécurisée.',
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: BASE_URL,
    siteName: 'roxanetnous',
    title: 'roxanetnous - Accompagnantes de vie vérifiées',
    description: 'Trouvez une accompagnante de vie vérifiée près de chez vous. Profils validés manuellement, matching intelligent sur 5 critères, messagerie sécurisée.',
  },
  twitter: {
    card: 'summary',
    title: 'roxanetnous - Accompagnantes de vie vérifiées',
    description: 'Trouvez une accompagnante de vie vérifiée près de chez vous.',
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
    <html lang="fr" className={`${satisfy.variable} ${girlNextDoor.variable}`}>
      <body className={girlNextDoor.className}>
        {children}
        <LastSeenTracker />
        <CookieBanner />
      </body>
    </html>
  )
}
