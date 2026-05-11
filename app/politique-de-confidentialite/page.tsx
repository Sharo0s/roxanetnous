import Link from 'next/link'
import { Footer } from '@/components/footer'

export default function PolitiqueConfidentialitePage() {
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
            Politique de confidentialité
          </h1>
        </header>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données personnelles est [Nom de la société],
              joignable à l&apos;adresse [roxanetnous@outlook.com].
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
              <li>Données de parrainage (accompagnants) : code de parrainage, identifiant du parrain et du filleul, adresse IP au moment de l&apos;inscription, et empreinte technique de la carte de paiement (fingerprint Stripe, sans numéro de carte ; le paiement est limité aux cartes bancaires pour rendre cette détection effective) — conservés à des fins d&apos;audit et de prévention de la fraude. Une détection automatique compare l&apos;email, l&apos;adresse IP, l&apos;adresse postale et l&apos;empreinte de la carte entre parrain et filleul pour identifier les parrainages suspects ; aucune décision pénalisante n&apos;est prise automatiquement sur la seule base de l&apos;adresse IP, qui ne sert qu&apos;à signaler le cas à un administrateur pour revue manuelle.</li>
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
              <li>Droit d&apos;opposition : contacter [roxanetnous@outlook.com]</li>
            </ul>
            <p className="mt-2">
              Pour exercer vos droits, utilisez les fonctionnalités de votre profil ou contactez-nous
              à [roxanetnous@outlook.com]. Vous pouvez également adresser une réclamation à la CNIL
              (www.cnil.fr).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Cookies et traceurs</h2>
            <p>
              Ce site utilise uniquement des traceurs strictement nécessaires au
              fonctionnement du service, exemptés de consentement au titre de
              l&apos;article 82 de la loi Informatique et Libertés et de la délibération
              CNIL n°2020-091 :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Cookies d&apos;authentification Supabase</strong> (famille de
                cookies <code className="text-xs" aria-label="sb tiret crochet ouvrant project-ref crochet fermant tiret auth-token et variantes">sb-[project-ref]-auth-token*</code>,
                pouvant inclure plusieurs cookies en cas de chunking ou de flux OAuth) :
                gèrent votre session utilisateur lorsque vous êtes connecté. Base légale :
                exécution du contrat (article 6.1.b RGPD).
              </li>
              <li>
                <strong>Préférence locale du bandeau d&apos;information</strong>
                (<code className="text-xs">cookies-accepted</code>) : assimilée à un
                traceur par la CNIL mais exemptée de consentement car strictement
                nécessaire à l&apos;ergonomie du bandeau (évite de le réafficher à chaque
                visite). Cette donnée est stockée dans le <em>localStorage</em> de votre
                navigateur, reste sur votre appareil et n&apos;est jamais transmise dans
                une requête HTTP.
              </li>
            </ul>
            <p className="mt-2">
              Aucun cookie publicitaire, analytique, de suivi ou de retargeting tiers
              n&apos;est utilisé sur le domaine roxanetnous. Aucun script tiers de
              traçage (Google Analytics, Meta Pixel, Vercel Analytics, etc.) n&apos;est
              chargé côté client.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Transferts de données</h2>
            <p>
              Les données peuvent être hébergées en dehors de l&apos;UE via nos prestataires
              (Vercel, Supabase, Stripe). Ces prestataires sont conformes au RGPD et offrent
              des garanties adéquates de protection des données.
            </p>
            <p className="mt-2">
              Sur les pages permettant de configurer une zone géographique (création ou
              modification d&apos;un profil accompagnante, onboarding initial accompagnante,
              création d&apos;une annonce — toutes accessibles uniquement après connexion),
              une carte interactive charge des tuiles cartographiques depuis OpenStreetMap
              Foundation, fondation à but non lucratif
              (sous-domaines <code className="text-xs" aria-label="a, b ou c, point tile point openstreetmap point org">{`{a,b,c}.tile.openstreetmap.org`}</code>).
              Cela transmet votre adresse IP à ce tiers. Cette fonctionnalité est
              strictement nécessaire à la configuration de votre rayon d&apos;intervention
              ou de votre zone d&apos;annonce (base légale : exécution du contrat,
              article 6.1.b RGPD).
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
            <p className="mt-2 text-gray-500">Dernière mise à jour : mai 2026</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
