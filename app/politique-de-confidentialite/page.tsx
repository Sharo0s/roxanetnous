import Link from 'next/link'
import { Footer } from '@/components/footer'

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen flex flex-col kraft bg-kraft">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 relative z-10">
        <Link href="/" className="text-sm text-black/50 hover:text-black transition">
          Retour a l&apos;accueil
        </Link>

        <h1 className="text-3xl font-bold text-black mt-6 mb-8">Politique de confidentialite</h1>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Responsable du traitement</h2>
            <p>
              Le responsable du traitement des donnees personnelles est [Nom de la societe],
              joignable a l&apos;adresse [contact@roxanetnous.fr].
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Donnees collectees</h2>
            <p>Nous collectons les donnees suivantes :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Donnees d&apos;identification : nom, prenom, adresse email, telephone</li>
              <li>Donnees de profil : ville, code postal, adresse, specialites, diplomes, experience</li>
              <li>Documents justificatifs : piece d&apos;identite, diplome (pour les auxiliaires)</li>
              <li>Donnees d&apos;utilisation : annonces, messages, avis, favoris</li>
              <li>Donnees de paiement : gerees par Stripe (nous ne stockons pas les numeros de carte)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Finalites du traitement</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Creation et gestion de votre compte utilisateur</li>
              <li>Mise en relation entre auxiliaires de vie et beneficiaires</li>
              <li>Verification des qualifications des auxiliaires</li>
              <li>Gestion des abonnements et paiements</li>
              <li>Envoi de notifications liees au service (messages, validation de profil)</li>
              <li>Moderation et securite de la plateforme</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Base legale</h2>
            <p>
              Le traitement des donnees repose sur l&apos;execution du contrat (utilisation du service)
              et le consentement de l&apos;utilisateur lors de la creation de son compte.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Duree de conservation</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Donnees de compte : conservees tant que le compte est actif</li>
              <li>Documents justificatifs : conserves pendant la duree de validite du profil</li>
              <li>Donnees de paiement (Stripe) : selon la politique de Stripe et les obligations legales</li>
              <li>Logs de notification : 12 mois</li>
              <li>Apres suppression du compte : toutes les donnees sont supprimees immediatement</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Vos droits</h2>
            <p>Conformement au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Droit d&apos;acces : obtenir une copie de vos donnees (export disponible dans votre profil)</li>
              <li>Droit de rectification : modifier vos informations dans votre profil</li>
              <li>Droit a l&apos;effacement : supprimer votre compte et toutes vos donnees depuis votre profil</li>
              <li>Droit a la portabilite : exporter vos donnees au format JSON depuis votre profil</li>
              <li>Droit d&apos;opposition : contacter [contact@roxanetnous.fr]</li>
            </ul>
            <p className="mt-2">
              Pour exercer vos droits, utilisez les fonctionnalites de votre profil ou contactez-nous
              a [contact@roxanetnous.fr]. Vous pouvez egalement adresser une reclamation a la CNIL
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
              <li>Preference cookies (acceptation de la banniere)</li>
            </ul>
            <p className="mt-2">
              Aucun cookie publicitaire, analytique ou de suivi tiers n&apos;est utilise.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Transferts de donnees</h2>
            <p>
              Les donnees peuvent etre hebergees en dehors de l&apos;UE via nos prestataires
              (Vercel, Supabase, Stripe). Ces prestataires sont conformes au RGPD et offrent
              des garanties adequates de protection des donnees.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Securite</h2>
            <p>
              Nous mettons en oeuvre des mesures techniques et organisationnelles pour proteger
              vos donnees : chiffrement des communications (HTTPS), controle d&apos;acces par roles
              (RLS), hachage des mots de passe, et stockage securise des documents.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Mise a jour</h2>
            <p>
              Cette politique peut etre mise a jour. La date de derniere modification est indiquee
              ci-dessous. Nous vous informerons de tout changement significatif.
            </p>
            <p className="mt-2 text-gray-500">Derniere mise a jour : fevrier 2026</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
