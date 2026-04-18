import Link from 'next/link'
import { Footer } from '@/components/footer'

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen flex flex-col kraft bg-kraft">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 relative z-10">
        <Link href="/" className="text-sm text-black/50 hover:text-black transition">
          Retour à l&apos;accueil
        </Link>

        <h1 className="text-3xl font-bold text-black mt-6 mb-8">Politique de confidentialité</h1>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données personnelles est [Nom de la société],
              joignable à l&apos;adresse [contact@roxanetnous.fr].
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Données collectées</h2>
            <p>Nous collectons les données suivantes :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Données d&apos;identification : nom, prénom, adresse email, téléphone</li>
              <li>Données de profil : ville, code postal, adresse, spécialités, diplômes, expérience</li>
              <li>Documents justificatifs : pièce d&apos;identité, diplôme (pour les accompagnantes)</li>
              <li>Données d&apos;utilisation : annonces, messages, favoris</li>
              <li>Données de paiement : gérées par Stripe (nous ne stockons pas les numéros de carte)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Finalités du traitement</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Création et gestion de votre compte utilisateur</li>
              <li>Mise en relation entre accompagnantes de vie et accompagnés</li>
              <li>Vérification des qualifications des accompagnantes</li>
              <li>Gestion des abonnements et paiements</li>
              <li>Envoi de notifications liées au service (messages, validation de profil)</li>
              <li>Modération et sécurité de la plateforme</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Base légale</h2>
            <p>
              Le traitement des données repose sur l&apos;exécution du contrat (utilisation du service)
              et le consentement de l&apos;utilisateur lors de la création de son compte.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Durée de conservation</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Données de compte : conservées tant que le compte est actif</li>
              <li>Documents justificatifs : conservés pendant la durée de validité du profil</li>
              <li>Données de paiement (Stripe) : selon la politique de Stripe et les obligations légales</li>
              <li>Logs de notification : 12 mois</li>
              <li>Après suppression du compte : toutes les données sont supprimées immédiatement</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Vos droits</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Droit d&apos;accès : obtenir une copie de vos données (export disponible dans votre profil)</li>
              <li>Droit de rectification : modifier vos informations dans votre profil</li>
              <li>Droit à l&apos;effacement : supprimer votre compte et toutes vos données depuis votre profil</li>
              <li>Droit à la portabilité : exporter vos données au format JSON depuis votre profil</li>
              <li>Droit d&apos;opposition : contacter [contact@roxanetnous.fr]</li>
            </ul>
            <p className="mt-2">
              Pour exercer vos droits, utilisez les fonctionnalités de votre profil ou contactez-nous
              à [contact@roxanetnous.fr]. Vous pouvez également adresser une réclamation à la CNIL
              (www.cnil.fr).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Cookies</h2>
            <p>
              Ce site utilise uniquement des cookies essentiels au fonctionnement du service :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Cookies d&apos;authentification Supabase (session utilisateur)</li>
              <li>Préférence cookies (acceptation de la bannière)</li>
            </ul>
            <p className="mt-2">
              Aucun cookie publicitaire, analytique ou de suivi tiers n&apos;est utilisé.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Transferts de données</h2>
            <p>
              Les données peuvent être hébergées en dehors de l&apos;UE via nos prestataires
              (Vercel, Supabase, Stripe). Ces prestataires sont conformes au RGPD et offrent
              des garanties adéquates de protection des données.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger
              vos données : chiffrement des communications (HTTPS), contrôle d&apos;accès par rôles
              (RLS), hachage des mots de passe, et stockage sécurisé des documents.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Mise à jour</h2>
            <p>
              Cette politique peut être mise à jour. La date de dernière modification est indiquée
              ci-dessous. Nous vous informerons de tout changement significatif.
            </p>
            <p className="mt-2 text-gray-500">Dernière mise à jour : février 2026</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
