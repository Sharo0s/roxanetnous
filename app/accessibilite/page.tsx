import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/footer'

export const metadata: Metadata = {
  title: 'Accessibilité',
  description:
    'Déclaration d\'accessibilité RGAA 4.1 de roxanetnous : niveau de conformité, résultats des tests, limites connues et contact pour signaler un défaut.',
}

export default function AccessibilitePage() {
  return (
    <div className="min-h-screen flex flex-col kraft bg-kraft">
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-3xl mx-auto px-4 py-12 relative z-10 focus:outline-none">
        <Link href="/" className="text-sm text-black/50 hover:text-black transition">
          Retour à l&apos;accueil
        </Link>

        <h1 className="text-3xl font-bold text-black mt-6 mb-8">Accessibilité</h1>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Niveau de conformité</h2>
            <p>roxanetnous est partiellement conforme au RGAA 4.1, niveau AA partiel.</p>
            <p>
              roxanetnous est une plateforme privée non assujettie aux obligations légales de
              déclaration d&apos;accessibilité (article 47 de la loi 2005-102, décret 2019-768) ;
              cette déclaration est publiée volontairement pour informer les utilisateurs de la
              démarche de mise en conformité.
            </p>
            <p>
              Cette déclaration a été établie le 6 mai 2026 à l&apos;issue du Lot B de mise en
              conformité (mini-épic 2.6).
            </p>
            <p>Dernière mise à jour : 6 mai 2026.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Résultats des tests</h2>
            <p>Tests automatisés :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <code>eslint-plugin-jsx-a11y</code> : baseline stable sur les patterns
                d&apos;écriture, surveillance continue en CI Vercel.
              </li>
              <li>
                <code>axe-core</code> via Playwright : 0 violation Critical/Serious sur 7
                parcours audités (landing, recherche, login proxy onboarding accompagnante,
                messagerie, inscription accompagnante, login proxy inscription, suppression
                RGPD).
              </li>
            </ul>
            <p className="mt-2">Tests manuels narratifs :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                VoiceOver macOS sur la messagerie, l&apos;onboarding accompagnante et les
                formulaires d&apos;inscription (3 échantillons documentés Lot B).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Limites connues</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                La carte interactive Leaflet de la recherche est neutralisée pour les
                technologies d&apos;assistance (<code>aria-hidden</code> + <code>inert</code>).
                L&apos;alternative non-visuelle complète est fournie par les champs
                «&nbsp;ville&nbsp;» et «&nbsp;rayon&nbsp;» adjacents.
              </li>
              <li>
                Les pages d&apos;administration (back-office) ne sont pas auditées : audience
                interne uniquement.
              </li>
              <li>
                La cible tactile 44 x 44 px n&apos;est pas auditée systématiquement ;
                vérification au cas par cas.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Contact</h2>
            <p>
              Pour signaler un défaut d&apos;accessibilité ou demander une alternative :
              {' '}
              <a
                href="mailto:roxanetnous@outlook.com"
                className="text-black underline hover:no-underline"
              >
                roxanetnous@outlook.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Engagement d&apos;amélioration</h2>
            <p>
              Une revue d&apos;accessibilité est programmée semestriellement à partir de mai
              2026 (re-run de l&apos;évaluation NFR a11y et de la baseline axe-core). Les
              retours utilisateurs sont intégrés au backlog au fil de l&apos;eau.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
