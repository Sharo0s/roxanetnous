import Link from 'next/link'
import { Footer } from '@/components/footer'

export default function CGUPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="text-sm text-gray-500 hover:text-black transition">
          Retour a l&apos;accueil
        </Link>

        <h1 className="text-3xl font-bold text-black mt-6 mb-8">Conditions generales d&apos;utilisation</h1>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">1. Objet</h2>
            <p>
              Les presentes conditions generales d&apos;utilisation (CGU) regissent l&apos;acces et
              l&apos;utilisation de la plateforme roxanetnous, un service de mise en relation entre
              auxiliaires de vie et beneficiaires.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">2. Inscription</h2>
            <p>
              L&apos;inscription est ouverte a toute personne majeure. L&apos;utilisateur s&apos;engage
              a fournir des informations exactes et a les maintenir a jour. Chaque utilisateur est
              responsable de la confidentialite de son mot de passe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">3. Roles</h2>
            <p>Deux types de comptes sont disponibles :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Auxiliaire de vie</strong> : professionnel proposant ses services d&apos;aide a
                domicile. Son profil est soumis a une validation manuelle (diplome, identite).
              </li>
              <li>
                <strong>Beneficiaire</strong> : personne recherchant un auxiliaire de vie pour
                elle-meme ou pour un proche.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">4. Abonnement et paiement</h2>
            <p>
              L&apos;acces a certaines fonctionnalites (publication d&apos;annonces, messagerie)
              necessite un abonnement payant. Les paiements sont traites par Stripe. L&apos;utilisateur
              peut annuler son abonnement a tout moment depuis son espace personnel.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">5. Obligations des utilisateurs</h2>
            <p>L&apos;utilisateur s&apos;engage a :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Ne pas publier de contenu illegal, diffamatoire ou trompeur</li>
              <li>Ne pas usurper l&apos;identite d&apos;un tiers</li>
              <li>Respecter les autres utilisateurs dans les echanges</li>
              <li>Ne pas utiliser la plateforme a des fins contraires a son objet</li>
              <li>Fournir des justificatifs authentiques (pour les auxiliaires)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">6. Role de la plateforme</h2>
            <p>
              roxanetnous est un service de mise en relation. La plateforme ne se substitue pas
              a un employeur et n&apos;est pas partie prenante dans la relation contractuelle entre
              l&apos;auxiliaire et le beneficiaire. Chaque partie est responsable de ses obligations
              legales (contrat de travail, declarations, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">7. Moderation</h2>
            <p>
              La plateforme se reserve le droit de suspendre ou supprimer tout compte ou contenu
              ne respectant pas les presentes CGU, sans preavis en cas de manquement grave.
              Un systeme de signalement est mis a disposition des utilisateurs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">8. Donnees personnelles</h2>
            <p>
              Le traitement des donnees personnelles est detaille dans notre{' '}
              <Link href="/politique-de-confidentialite" className="underline hover:text-black">
                politique de confidentialite
              </Link>
              . L&apos;utilisateur peut a tout moment exporter ou supprimer ses donnees depuis
              son profil.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">9. Responsabilite</h2>
            <p>
              La plateforme s&apos;efforce d&apos;assurer la disponibilite du service mais ne peut
              garantir une absence totale d&apos;interruption. roxanetnous ne saurait etre tenue
              responsable des dommages directs ou indirects lies a l&apos;utilisation du service
              ou a la relation entre utilisateurs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">10. Modification des CGU</h2>
            <p>
              Les presentes CGU peuvent etre modifiees a tout moment. Les utilisateurs seront
              informes de tout changement significatif. La poursuite de l&apos;utilisation du service
              vaut acceptation des nouvelles conditions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">11. Droit applicable</h2>
            <p>
              Les presentes CGU sont soumises au droit francais. En cas de litige, les tribunaux
              competents seront ceux du siege social de l&apos;editeur, sauf disposition legale
              contraire.
            </p>
          </section>

          <p className="text-gray-500 pt-4">Derniere mise a jour : fevrier 2026</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
