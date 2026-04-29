# Checklist avant lancement

## DNS / Email
- [ ] Configurer SPF, DKIM et DMARC sur roxanetnous.fr dans Resend (anti-spam)
- [ ] Verifier la delivrabilite des emails (ne plus tomber en spam)

## Vercel
- [ ] Connecter le domaine roxanetnous.fr sur Vercel
- [ ] Mettre a jour NEXT_PUBLIC_BASE_URL vers https://roxanetnous.fr

## Stripe
- [ ] Passer les cles Stripe en mode live (pk_live_ / sk_live_)
- [ ] Creer les prix de production dans Stripe et mettre a jour les STRIPE_PRICE_* dans Vercel
- [ ] Configurer le webhook Stripe de production et mettre a jour STRIPE_WEBHOOK_SECRET

## Supabase
- [ ] Verifier les politiques RLS sur toutes les tables
- [ ] Desactiver la confirmation email auto de Supabase si geree via Resend

## Securite
- [ ] Generer un vrai CRON_SECRET aleatoire
- [ ] Generer une vraie ENCRYPTION_KEY aleatoire (64 hex)
- [ ] Definir ADMIN_NOTIFICATIONS_EMAIL (destinataire des alertes anti-fraude parrainage) sur Vercel
- [ ] S'assurer que toutes les variables d'environnement Vercel sont a jour

## Nettoyage BDD
- [ ] Supprimer tous les comptes utilisateurs sauf l'admin

## Contenu
- [ ] Relire et personnaliser les emails dans lib/emails.ts (accents, ton, branding)
- [ ] Verifier les textes de l'interface (CGU, mentions legales, etc.)

## Pages legales (RGPD) - placeholders a remplir avant lancement
- [ ] app/mentions-legales/page.tsx : remplir nom societe, forme juridique, adresse, SIRET, TVA, telephone, directeur de publication
- [ ] app/politique-de-confidentialite/page.tsx : remplir nom societe et adresse email de contact ; mentionner explicitement la collecte du code de parrainage et de l'IP d'inscription pour la lutte anti-fraude (Story 2.1)
- [ ] app/cgu/page.tsx : relire et adapter les conditions au contexte exact du service

## Parrainage (Story 2.1 - validation automatique filleule)
- [ ] Tester le flow bout en bout en preview Vercel : valider une marraine, partager le code, inscrire une filleule, souscrire abonnement Stripe, verifier le passage automatique en `valide` (validation_source='parrainage')
- [ ] Story 2.2 (a venir) : webhook Stripe (capture stripe_fingerprint), cron J+30, compteur marraine, coupon 6 mois, ParrainageCard dashboard

## Parrainage anti-fraude (Story 2.3 - blacklist admin)
- [ ] Scenario meme_email : marraine A genere code, filleule B s'inscrit avec l'email de A -> verifier statut='bloque', blocage_raison='meme_email', users.parrainee_par=NULL, log admin_actions_log et email admin recu
- [ ] Scenario meme_ip : 2 filleules consecutives d'une meme marraine depuis la meme IP -> flag_suspicion='meme_ip' sur la 2eme, bypass continue, email admin envoye
- [ ] Scenario meme_carte : test Stripe en preview avec 4242 4242 4242 4242 cote marraine ET cote filleule -> webhook detecte fingerprint identique -> statut='bloque', blocage_raison='meme_carte', validation revoquee si deja appliquee, email admin
- [ ] Scenario meme_adresse : 2 profils accompagnantes avec la meme adresse postale -> flag_suspicion='meme_adresse' au webhook (concatene avec un eventuel meme_ip preexistant)
- [ ] Page admin /admin/parrainages : verifier counters, filtres statut/flag, pagination, lien vers /admin/parrainages/blacklist
- [ ] Page admin /admin/parrainages/blacklist : tester boutons "Autoriser exception" (statut->inscrite, parrainee_par restaure), "Confirmer fraude" (statut->fraude, validation_status->refuse), "Ignorer flag" (flag_suspicion->NULL)
- [ ] Verifier que le lien direct depuis l'email admin (?id=PARRAINAGE_ID) met bien la row en surbrillance (bg-accent/30, aria-current)
