import Link from 'next/link'

export default function CGUPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fefaf8]">
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-3xl mx-auto px-4 py-12 md:py-16 relative z-10 focus:outline-none">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition mb-6">
          <span aria-hidden="true">←</span> Retour à l&apos;accueil
        </Link>

        <header className="text-center mb-10">
          <span className="inline-block text-[11px] uppercase tracking-[0.18em] text-kraft font-medium mb-2">
            Légal
          </span>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">
            Conditions générales d&apos;utilisation
          </h1>
        </header>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">1. Objet</h2>
            <p>
              Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et
              l&apos;utilisation de la plateforme roxanetnous, un service de mise en relation entre
              accompagnants de vie et accompagnés.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">2. Inscription</h2>
            <p>
              L&apos;inscription est ouverte à toute personne majeure. L&apos;utilisateur s&apos;engage
              à fournir des informations exactes et à les maintenir à jour. Chaque utilisateur est
              responsable de la confidentialité de son mot de passe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">3. Rôles</h2>
            <p>Deux types de comptes sont disponibles :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Accompagnant de vie</strong> : professionnel proposant ses services d&apos;aide à
                domicile. Son profil est soumis à une validation manuelle (diplôme, identité).
              </li>
              <li>
                <strong>Accompagné</strong> : personne recherchant un accompagnant de vie pour
                elle-même ou pour un proche.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">4. Abonnement et paiement</h2>
            <p>
              L&apos;accès à certaines fonctionnalités (publication d&apos;annonces, messagerie)
              nécessite un abonnement payant. Les paiements sont traités par Stripe. L&apos;utilisateur
              peut annuler son abonnement à tout moment depuis son espace personnel.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">5. Obligations des utilisateurs</h2>
            <p>L&apos;utilisateur s&apos;engage à :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Ne pas publier de contenu illégal, diffamatoire ou trompeur</li>
              <li>Ne pas usurper l&apos;identité d&apos;un tiers</li>
              <li>Respecter les autres utilisateurs dans les échanges</li>
              <li>Ne pas utiliser la plateforme à des fins contraires à son objet</li>
              <li>Fournir des justificatifs authentiques (pour les accompagnants)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">6. Rôle de la plateforme</h2>
            <p>
              roxanetnous est un service de mise en relation. La plateforme ne se substitue pas
              à un employeur et n&apos;est pas partie prenante dans la relation contractuelle entre
              l&apos;accompagnant et l&apos;accompagné. Chaque partie est responsable de ses obligations
              légales (contrat de travail, déclarations, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">7. Modération</h2>
            <p>
              La plateforme se réserve le droit de suspendre ou supprimer tout compte ou contenu
              ne respectant pas les présentes CGU, sans préavis en cas de manquement grave.
              Un système de signalement est mis à disposition des utilisateurs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">8. Données personnelles</h2>
            <p>
              Le traitement des données personnelles est détaillé dans notre{' '}
              <Link href="/politique-de-confidentialite" className="underline hover:text-black">
                politique de confidentialité
              </Link>
              . L&apos;utilisateur peut à tout moment exporter ou supprimer ses données depuis
              son profil.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">9. Responsabilité</h2>
            <p>
              La plateforme s&apos;efforce d&apos;assurer la disponibilité du service mais ne peut
              garantir une absence totale d&apos;interruption. roxanetnous ne saurait être tenue
              responsable des dommages directs ou indirects liés à l&apos;utilisation du service
              ou à la relation entre utilisateurs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">10. Modification des CGU</h2>
            <p>
              Les présentes CGU peuvent être modifiées à tout moment. Les utilisateurs seront
              informés de tout changement significatif. La poursuite de l&apos;utilisation du service
              vaut acceptation des nouvelles conditions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">11. Droit applicable</h2>
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, les tribunaux
              compétents seront ceux du siège social de l&apos;éditeur, sauf disposition légale
              contraire.
            </p>
          </section>

          <p className="text-gray-500 pt-4">Dernière mise à jour : février 2026</p>
        </div>
      </main>
    </div>
  )
}
