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
- [ ] S'assurer que toutes les variables d'environnement Vercel sont a jour

## Contenu
- [ ] Relire et personnaliser les emails dans lib/emails.ts (accents, ton, branding)
- [ ] Verifier les textes de l'interface (CGU, mentions legales, etc.)

## Pages legales (RGPD) - placeholders a remplir avant lancement
- [ ] app/mentions-legales/page.tsx : remplir nom societe, forme juridique, adresse, SIRET, TVA, telephone, directeur de publication
- [ ] app/politique-de-confidentialite/page.tsx : remplir nom societe et adresse email de contact
- [ ] app/cgu/page.tsx : relire et adapter les conditions au contexte exact du service
