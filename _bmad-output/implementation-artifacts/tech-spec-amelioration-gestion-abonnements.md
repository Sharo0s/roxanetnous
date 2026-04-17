---
title: 'Amelioration de la gestion des abonnements'
slug: 'amelioration-gestion-abonnements'
created: '2026-04-05'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'Supabase', 'Stripe API 2026-01-28', 'TypeScript', 'TailwindCSS v4', 'Resend']
files_to_modify: ['components/abonnement/subscription-page-content.tsx', 'app/actions/subscription.ts', 'lib/subscription-helpers.ts', 'lib/stripe.ts', 'app/accompagnante/dashboard/page.tsx', 'app/accompagne/dashboard/page.tsx', 'lib/emails.ts', 'app/api/webhooks/stripe/route.ts', 'app/admin/utilisateurs/[id]/page.tsx', 'app/actions/admin.ts']
files_to_create: ['components/abonnement/cancel-modal.tsx', 'app/api/cron/expiration-reminder/route.ts']
code_patterns: ['server-actions', 'server-components', 'supabase-createClient', 'kraft-card-grid', 'resend-email-with-logging']
test_patterns: []
---

# Tech-Spec: Amelioration de la gestion des abonnements

**Created:** 2026-04-05

## Overview

### Problem Statement

La page de gestion d'abonnement actuelle est minimaliste : elle affiche uniquement le statut et deux boutons (gerer via portail Stripe, annuler). Il manque des informations detaillees (plan, montant, moyen de paiement, factures), il n'y a aucun lien d'acces depuis le dashboard, pas de vue admin pour superviser les abonnements, pas de notifications email pour les evenements cles, et la page n'est pas conforme a la legislation francaise (resiliation en 3 clics, droit de retractation).

De plus, plusieurs bugs pre-existants doivent etre corriges :
- Le webhook `customer.subscription.updated` ne remet jamais `cancel_at` a `null` quand une annulation est annulee
- Les emails `sendSubscriptionConfirmEmail` et `sendSubscriptionCancelEmail` hardcodent `/accompagnante/abonnement` au lieu d'utiliser le role
- Le webhook `subscription.updated` ne met pas a jour `stripe_price_id` ni `plan_type`

### Solution

Enrichir l'experience de gestion des abonnements sur 4 axes :
1. **Acces** : carte "Mon abonnement" sur les dashboards accompagnante et accompagne
2. **Page abonnement enrichie** : infos detaillees (plan, montant, moyen de paiement, historique factures), switch mensuel/annuel, conformite legale (resiliation en 2 clics max, droit de retractation, lien CGV)
3. **Vue admin** : section abonnement dans le detail utilisateur, possibilite d'annuler un abonnement (avec confirmation)
4. **Emails** : confirmation de changement de plan, rappel avant renouvellement, rappel avant expiration apres annulation
5. **Bugfixes** : correction des bugs pre-existants identifies ci-dessus

### Scope

**In Scope:**
- Carte "Mon abonnement" sur les dashboards accompagnante et accompagne (meme style visuel que les cartes existantes)
- Enrichissement du composant `subscription-page-content.tsx` : affichage du plan actuel (mensuel/annuel), montant reel (via Stripe API), moyen de paiement (derniers chiffres carte), prochaine echeance
- Historique des factures via Stripe API (date, montant, statut, lien PDF)
- Switch mensuel <-> annuel pour les abonnes actifs (avec preview du cout et confirmation)
- Flow de resiliation conforme a la loi francaise (2 clics : bouton + confirmation)
- Mentions legales : droit de retractation 14 jours avec lien email pour l'exercer + lien vers CGV
- Vue admin : section abonnement dans la page detail utilisateur, action d'annulation avec modale de confirmation
- Emails transactionnels : confirmation changement de plan, rappel avant renouvellement, rappel avant expiration apres annulation
- Nouvelles server actions et enrichissement des helpers existants
- Correction bugs pre-existants (cancel_at, emails hardcodes, webhook update incomplet)
- Bouton de reactivation d'abonnement apres annulation (avant expiration)

**Out of Scope:**
- Changement de pricing / nouveaux tiers tarifaires
- Pricing asymetrique (accompagnante vs accompagne)
- Modification du header de navigation

## Context for Development

### Codebase Patterns

- **Server Actions** : toutes les mutations passent par des server actions dans `/app/actions/`. Pattern : `'use server'`, auth check, validation, DB op, `redirect()`.
- **Supabase** : acces BDD via `createClient()`, `createClient({ serviceRole: true })` pour admin. Table `subscriptions` avec user_id unique (upsert).
- **Stripe** : client initialise dans `/lib/stripe.ts`. Webhooks dans `/app/api/webhooks/stripe/route.ts` gerant 4 events. Customer portal via `stripe.billingPortal.sessions.create()`.
- **Composants partages** : `subscription-page-content.tsx` utilise par les deux roles via les pages `/accompagnante/abonnement` et `/accompagne/abonnement`.
- **Design** : fond kraft (`kraft bg-kraft`), cartes blanches (`bg-white rounded-xl border p-6`), accent `#FFB06E`, pas d'emojis. Boutons : primary `bg-accent text-black rounded-lg btn-hover`, secondary `border border-gray-300 text-gray-700`.
- **Dashboard cards** : grille `grid grid-cols-1 md:grid-cols-2 gap-4`. Chaque carte : `<h3 className="font-semibold text-lg mb-2">`, `<p className="text-gray-600 mb-4">`, `<Link>` bouton accent.
- **Emails** : Resend SDK, FROM_EMAIL configurable. Chaque envoi est logue dans `notifications_log` (userId, email, type, subject, status, error). HTML inline simple : fond blanc, texte noir, bouton noir. **Attention** : `lib/emails.ts` a `'use server'` en tete de fichier. Les imports depuis les API routes (webhook) fonctionnent car Next.js ne restreint pas les imports `'use server'` cote serveur, mais il faut en etre conscient.
- **Admin** : dashboard avec onglets. Detail utilisateur dans `/admin/utilisateurs/[id]` avec sections conditionnelles par role. **La page doit verifier que l'utilisateur connecte est admin** (verifier si c'est deja le cas, sinon ajouter le check). Actions loguees dans `admin_actions_log`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `components/abonnement/subscription-page-content.tsx` | Composant UI principal (a refondre) : affiche statut + pricing |
| `app/actions/subscription.ts` | Server actions : `createCheckoutSession`, `createPortalSession`, `cancelSubscription` |
| `lib/subscription-helpers.ts` | `hasActiveSubscription(userId)`, `getSubscriptionStatus(userId)` -> `SubscriptionInfo` |
| `lib/stripe.ts` | Client Stripe, `getStripePriceId(role, plan)`, `getTrialDays(plan)`, `isLaunchOffer()` |
| `app/api/webhooks/stripe/route.ts` | Webhook : checkout.completed, subscription.updated/deleted, invoice.payment_failed |
| `app/accompagnante/dashboard/page.tsx` | Dashboard accompagnante : 4 cartes, `SubscriptionBanner` conditionnel |
| `app/accompagne/dashboard/page.tsx` | Dashboard accompagne : 6 cartes, `AccompagneSubscriptionBanner` conditionnel |
| `app/accompagnante/abonnement/page.tsx` | Page wrapper accompagnante (auth + header + composant partage) |
| `app/accompagne/abonnement/page.tsx` | Page wrapper accompagne (auth + header + composant partage) |
| `lib/emails.ts` | 8 templates email existants, pattern Resend + logging `notifications_log` |
| `app/admin/utilisateurs/[id]/page.tsx` | Detail utilisateur admin (sections conditionnelles par role) |
| `app/actions/admin.ts` | `validateAccompagnante()`, `adminDeleteUser()` (cascade Stripe) |
| `lib/admin-stats.ts` | `getKpis()`, `getMrrDetail()`, `getChurn()`, `getDernieresAnnulations()` |

### Technical Decisions

- **Montant via Stripe API** : ne PAS hardcoder les prix (4.99, 49.99). Recuperer le montant reel depuis la derniere facture Stripe ou depuis le prix Stripe (`stripe.prices.retrieve()`). Ceci garantit la coherence meme si les prix changent, et gere correctement les prix promo (2.99 affiche actuellement).
- **Webhook = source de verite pour plan_type** : `switchPlan()` ne met PAS a jour la BDD directement. Il appelle uniquement `stripe.subscriptions.update()`. Le webhook `customer.subscription.updated` detecte le changement de prix et met a jour `plan_type`, `stripe_price_id` en BDD + envoie l'email. Ceci evite la race condition entre l'action serveur et le webhook. La page est rafraichie par `redirect()` apres un court delai ou via `revalidatePath()`.
- **`cancelSubscription` sans redirect** : creer une nouvelle version `cancelSubscriptionFromModal()` qui retourne un resultat `{ success: boolean, cancelAt: string | null }` au lieu de faire `redirect()`. L'ancienne `cancelSubscription` avec redirect est conservee pour retrocompatibilite.
- **`getPaymentMethod` et `getInvoices` dans `lib/subscription-helpers.ts`** : ce sont des fonctions server-only (elles importent le client Stripe). Elles sont appelees uniquement depuis les server components (pages wrapper). Elles ne doivent PAS etre dans `app/actions/subscription.ts` (qui a `'use server'` et exposerait inutilement ces fonctions comme endpoints publics).
- **Resiliation en 2 clics** : clic 1 = "Resilier mon abonnement" (ouvre modale avec recap), clic 2 = "Confirmer la resiliation" (execute + affiche confirmation dans la modale). Conforme a la loi (3 clics max). Le bouton "Fermer" final n'est pas un clic de resiliation.
- **Droit de retractation** : afficher le texte legal + fournir un lien `mailto:` vers l'email de contact pour exercer le droit de retractation dans les 14 jours. Le traitement du remboursement est manuel (via dashboard Stripe).
- **Rappels email** : webhook Stripe `invoice.upcoming` (rappel renouvellement) + cron job pour rappel expiration post-annulation. Le texte du rappel ne mentionne PAS "3 jours" (le timing Stripe est variable), mais dit "prochainement".
- **Admin** : section abonnement ajoutee dans la page detail utilisateur existante, pas de nouvelle page. Action `adminCancelSubscription` dans `admin.ts` avec modale de confirmation.
- **Deduplication emails webhook** : avant d'envoyer un email depuis un webhook, verifier dans `notifications_log` qu'un email du meme type n'a pas deja ete envoye pour cet utilisateur dans les dernieres 24h. Ceci previent les doublons en cas de retry Stripe.
- **Reactivation** : si l'abonnement est `cancel_at_period_end: true` (annulation prevue mais pas encore effective), afficher un bouton "Reactiver mon abonnement" qui appelle `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })`.

## Implementation Plan

### Tasks

#### Phase 0 : Bugfixes pre-existants

- [x] Task 0a: Corriger le webhook `customer.subscription.updated` — `cancel_at` et `stripe_price_id`
  - File: `app/api/webhooks/stripe/route.ts`
  - Action: Dans le case `customer.subscription.updated` :
    1. Toujours ecrire `cancel_at` : si `subscription.cancel_at` est truthy, stocker la date ; sinon, ecrire `null` explicitement. Ceci corrige le bug ou une annulation inversee laisse un `cancel_at` fantome en BDD.
    2. Toujours ecrire `stripe_price_id` depuis `subscription.items.data[0].price.id` et `plan_type` derive du prix (comparer avec les env vars `STRIPE_PRICE_*` pour determiner mensuel/annuel).
    3. Detecter si `stripe_price_id` a change par rapport a la valeur precedente en BDD. Si oui, recuperer l'ancien plan_type avant l'update, puis apres l'update, appeler `sendPlanChangeEmail()` avec l'ancien et le nouveau plan.
  - Notes: Lire la valeur actuelle en BDD AVANT l'update pour la comparaison. Ajouter la deduplication email : verifier dans `notifications_log` qu'un email `plan_change` n'a pas ete envoye pour cet utilisateur dans les 24 dernieres heures.

- [x] Task 0b: Corriger les liens hardcodes dans les emails existants
  - File: `lib/emails.ts`
  - Action: Modifier `sendSubscriptionConfirmEmail` et `sendSubscriptionCancelEmail` pour accepter un parametre `role: 'accompagnante' | 'accompagne'` et utiliser `/${role}/abonnement` au lieu de `/accompagnante/abonnement` hardcode.
  - Notes: Mettre a jour les appels dans le webhook (`route.ts`) pour passer le role. Le role est disponible dans les metadata de la session checkout ou peut etre derive depuis la table `users`.

- [x] Task 0c: Verifier et securiser la page admin detail utilisateur
  - File: `app/admin/utilisateurs/[id]/page.tsx`
  - Action: Verifier que la page effectue un check `userData.role === 'admin'` sur l'utilisateur CONNECTE (pas l'utilisateur consulte). Si ce check n'existe pas, l'ajouter en debut de page avec `redirect('/')` si non-admin.
  - Notes: Le middleware Next.js peut aussi proteger les routes `/admin/*`, mais le check explicite dans la page est la defense en profondeur.

#### Phase 1 : Data layer (helpers + server actions)

- [x] Task 1: Enrichir le type `SubscriptionInfo` et `getSubscriptionStatus()`
  - File: `lib/subscription-helpers.ts`
  - Action: Ajouter les champs `planType` (`'mensuel' | 'annuel' | null`), `stripePriceId` (`string | null`), `trialEnd` (`string | null`) au type `SubscriptionInfo`. Modifier la query Supabase pour selectionner aussi `plan_type`, `stripe_price_id`, `trial_end`. NE PAS hardcoder le montant — il sera recupere via `getSubscriptionAmount()`.
  - Notes: Verifier que les colonnes `plan_type` et `stripe_price_id` existent bien dans la table `subscriptions` (elles sont ecrites par le webhook checkout.completed). Si absentes, creer une migration Supabase.

- [x] Task 2: Creer `getPaymentMethod()` dans les helpers
  - File: `lib/subscription-helpers.ts`
  - Action: Nouvelle fonction `getPaymentMethod(stripeCustomerId: string)` qui recupere le moyen de paiement par defaut via `stripe.customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] })`. Retourne `{ brand: string, last4: string, expMonth: number, expYear: number } | null`. Encapsuler dans un try/catch : si Stripe echoue, retourner `null` (le composant affichera un fallback).
  - Notes: Fonction server-only dans `lib/`, PAS un server action. Appelee uniquement depuis les server components (pages wrapper).

- [x] Task 3: Creer `getInvoices()` dans les helpers
  - File: `lib/subscription-helpers.ts`
  - Action: Nouvelle fonction `getInvoices(stripeCustomerId: string)` qui appelle `stripe.invoices.list({ customer: customerId, limit: 24, status: 'paid' })`. Retourne un tableau `{ id: string, date: string, amount: number, status: string, pdfUrl: string | null }[]`. Encapsuler dans un try/catch : si Stripe echoue, retourner `[]`.
  - Notes: Limite a 24 factures pour couvrir 2 ans de mensuel ou 24 ans d'annuel. Le `invoice_pdf` de Stripe donne le lien PDF direct. Fonction server-only dans `lib/`.

- [x] Task 4: Creer `getSubscriptionAmount()` dans les helpers
  - File: `lib/subscription-helpers.ts`
  - Action: Nouvelle fonction `getSubscriptionAmount(stripePriceId: string)` qui appelle `stripe.prices.retrieve(stripePriceId)` et retourne `{ amount: number, interval: 'month' | 'year' }`. Encapsuler dans un try/catch : si Stripe echoue, retourner `null`.
  - Notes: Ceci evite de hardcoder les prix et gere correctement les prix promo. Resultat mis en cache cote serveur (prix Stripe ne changent pas en cours de session). Fonction server-only dans `lib/`.

- [x] Task 5: Creer la server action `switchPlan()`
  - File: `app/actions/subscription.ts`
  - Action: Nouvelle fonction `switchPlan(formData: FormData)` qui :
    1. Authentifie l'utilisateur et recupere son role
    2. Recupere `getSubscriptionStatus()` et verifie que `status === 'active'` (pas `past_due`, `cancelled`, `trialing`)
    3. Verifie que le nouveau plan est different du plan actuel (`newPlan !== subscription.planType`). Si identique, redirige sans action.
    4. Determine le nouveau `price_id` via `getStripePriceId(role, newPlan)`
    5. Appelle `stripe.subscriptions.retrieve(subscriptionId)` pour obtenir `items.data[0].id`
    6. Appelle `stripe.subscriptions.update(subscriptionId, { items: [{ id: itemId, price: newPriceId }], proration_behavior: 'create_prorations' })`
    7. NE MET PAS A JOUR LA BDD (le webhook `subscription.updated` s'en charge — source de verite unique)
    8. Appelle `revalidatePath('/${role}/abonnement')` puis `redirect('/${role}/abonnement')`
  - Notes: Pour les utilisateurs en `trialing`, le switch est interdit (ils n'ont pas encore de plan paye). Afficher un message cote UI. En cas d'erreur Stripe, encapsuler dans try/catch et rediriger avec un query param `?error=switch_failed` que le composant UI pourra afficher.

- [x] Task 6: Creer la server action `cancelSubscriptionFromModal()`
  - File: `app/actions/subscription.ts`
  - Action: Nouvelle fonction `cancelSubscriptionFromModal()` qui fait la meme chose que `cancelSubscription()` MAIS retourne `{ success: boolean, cancelAt: string | null, error?: string }` au lieu de faire `redirect()`. L'ancienne `cancelSubscription()` avec redirect est CONSERVEE pour retrocompatibilite.
  - Notes: Cette version est destinee au composant `CancelModal` qui a besoin du resultat pour afficher l'ecran de confirmation (etape 2 → etape 3 dans la modale). Le `cancelAt` retourne permet d'afficher la date de fin d'acces.

- [x] Task 7: Creer la server action `reactivateSubscription()`
  - File: `app/actions/subscription.ts`
  - Action: Nouvelle fonction `reactivateSubscription()` qui :
    1. Authentifie l'utilisateur et recupere son role
    2. Recupere `getSubscriptionStatus()` et verifie que `cancelAt` est defini (annulation prevue)
    3. Appelle `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })`
    4. Redirige vers la page abonnement
  - Notes: La mise a jour BDD (`cancel_at: null`) est geree par le webhook `subscription.updated` (corrige en Task 0a).

- [x] Task 8: Creer la server action `adminCancelSubscription()`
  - File: `app/actions/admin.ts`
  - Action: Nouvelle fonction `adminCancelSubscription(formData: FormData)` prenant un `userId`. Verifie que l'appelant est admin. Recupere le `stripe_subscription_id` depuis la table `subscriptions`. Appelle `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })`. Logue l'action dans `admin_actions_log` avec `action_type: 'annulation_abonnement'`. Redirige vers la page detail utilisateur.
  - Notes: Suit le meme pattern que `adminDeleteUser()` pour le check admin et le logging. Encapsuler l'appel Stripe dans un try/catch.

#### Phase 2 : Emails

- [x] Task 9: Ajouter les 3 templates email + corriger les existants
  - File: `lib/emails.ts`
  - Action:
    **Corrections existantes (Task 0b) :**
    - Modifier `sendSubscriptionConfirmEmail` : ajouter param `role`, remplacer `/accompagnante/abonnement` par `/${role}/abonnement`
    - Modifier `sendSubscriptionCancelEmail` : ajouter param `role`, remplacer `/accompagnante/abonnement` par `/${role}/abonnement`

    **Nouveaux templates :**
    1. `sendPlanChangeEmail(email, firstName, oldPlan, newPlan, role, userId?)` — Subject: "Changement de formule confirme". Body: confirme le passage de {oldPlan} a {newPlan}, mentionne le prorata. Lien vers `/${role}/abonnement`. Type log: `plan_change`.
    2. `sendRenewalReminderEmail(email, firstName, renewalDate, amount, role, userId?)` — Subject: "Votre abonnement sera renouvele prochainement". Body: rappel que l'echeance approche (sans mentionner "3 jours" car le timing Stripe est variable), montant, lien pour gerer l'abonnement. Lien vers `/${role}/abonnement`. Type log: `renewal_reminder`.
    3. `sendExpirationReminderEmail(email, firstName, expirationDate, role, userId?)` — Subject: "Votre abonnement expire bientot". Body: rappel que l'acces sera coupe a la date d'expiration, lien pour se reabonner. Lien vers `/${role}/abonnement`. Type log: `expiration_reminder`.
  - Notes: HTML inline identique aux templates existants. Bouton noir sur fond blanc. Tous les templates utilisent le param `role` pour generer le bon lien.

#### Phase 3 : Webhooks

- [x] Task 10: Ajouter le handler webhook `invoice.upcoming` avec deduplication
  - File: `app/api/webhooks/stripe/route.ts`
  - Action: Ajouter un case `'invoice.upcoming'` dans le switch. Extraire le `customer` de l'invoice, retrouver le `user_id` et le role dans la table `subscriptions` + `users` via `stripe_customer_id`. **Deduplication** : avant d'envoyer, verifier dans `notifications_log` qu'un email de type `renewal_reminder` n'a pas deja ete envoye pour cet userId dans les dernieres 24h. Si non, appeler `sendRenewalReminderEmail()` avec la date de la prochaine echeance et le montant.
  - Notes: L'event `invoice.upcoming` doit etre active dans le dashboard Stripe (Developers > Webhooks). Le timing d'envoi par Stripe est variable (1h a 3j avant renouvellement selon la config du compte).

- [x] Task 11: Mettre a jour les appels email dans le webhook
  - File: `app/api/webhooks/stripe/route.ts`
  - Action: Mettre a jour les appels a `sendSubscriptionConfirmEmail` et `sendSubscriptionCancelEmail` pour passer le parametre `role`. Recuperer le role depuis la table `users` via le `user_id` (deja disponible dans le webhook via les metadata ou la table `subscriptions`).
  - Notes: Consequence de la correction des liens hardcodes (Task 0b / Task 9).

#### Phase 4 : Composant UI - Modale de resiliation

- [x] Task 12: Creer le composant `CancelModal`
  - File: `components/abonnement/cancel-modal.tsx` (nouveau)
  - Action: Composant client (`'use client'`) implementant la resiliation en 2 clics :
    - **Clic 1** : Bouton "Resilier mon abonnement" (visible sur la page abonnement, clairement libelle). Au clic, ouvre la modale.
    - **Modale ouverte** : recap de l'abonnement (plan actuel, date de fin d'acces apres resiliation, liste de ce qui sera perdu : acces aux annonces, messagerie, etc.). Deux boutons : "Annuler" (ferme la modale) et "Confirmer la resiliation".
    - **Clic 2** : "Confirmer la resiliation" appelle `cancelSubscriptionFromModal()` (server action qui retourne un resultat, PAS de redirect). Au retour, affiche dans la meme modale : "Votre resiliation a ete prise en compte. Votre acces reste actif jusqu'au {cancelAt}." + bouton "Fermer".
    - **Etats de chargement** : pendant l'appel server action, le bouton "Confirmer" affiche un spinner et est desactive.
    - **Erreur** : si `cancelSubscriptionFromModal` retourne `success: false`, afficher un message d'erreur dans la modale.
  - Notes: Design : modale blanche, overlay sombre semi-transparent, bouton "Confirmer" en gris fonce (pas rouge — design noir/blanc), texte clair. Props : `subscription: SubscriptionInfo` pour afficher le recap. Conforme a la loi du 1er juin 2023 (resiliation en 3 clics max — ici 2 clics).

#### Phase 5 : Refonte du composant page abonnement

- [x] Task 13: Refondre `SubscriptionPageContent` — vue abonne actif
  - File: `components/abonnement/subscription-page-content.tsx`
  - Action: Remplacer la section `subscription.active` actuelle par une vue enrichie. Le composant devient un mix server/client : la partie principale reste server, le `CancelModal` est un composant client imbrique.

    **Sections a afficher pour un abonne actif :**

    - **Carte "Details de l'abonnement"** : plan (Mensuel/Annuel), statut (badge accent : "Actif" / "Essai gratuit" / "Annulation prevue"), montant reel (depuis props `amount`), prochaine echeance.
    - **Carte "Moyen de paiement"** : si `paymentMethod` est disponible : marque carte + `**** {last4}` + expiration `{expMonth}/{expYear}`. Bouton "Modifier" → `createPortalSession`. Si `paymentMethod` est `null` (erreur Stripe) : afficher "Information indisponible" avec bouton "Gerer via Stripe" → `createPortalSession`.
    - **Carte "Changer de formule"** : si mensuel, proposer annuel avec calcul d'economie ("Economisez X EUR/an"). Si annuel, proposer mensuel avec avertissement ("Vous passerez a 4,99 EUR/mois au lieu de 4,17 EUR/mois"). Bouton qui soumet un form avec `switchPlan`. **Ne PAS afficher cette carte si `status === 'trialing'`** (le switch pendant un essai gratuit n'est pas supporte). Afficher un message d'erreur si `?error=switch_failed` est present dans l'URL.
    - **Bouton "Reactiver mon abonnement"** : visible uniquement si `cancelAt` est defini. Appelle `reactivateSubscription`. Remplace le `CancelModal` dans ce cas.
    - **Section "Historique des factures"** : tableau (date, montant, statut, lien PDF telechargement). Si `invoices` est vide : "Aucune facture disponible". Si erreur Stripe (tableau vide malgre un abonnement actif) : "Historique temporairement indisponible".
    - **`CancelModal`** : bouton "Resilier mon abonnement" clairement visible. Masque si `cancelAt` est deja defini (annulation deja prevue).
    - **Mentions legales** (en bas de page, texte petit) : "Conformement a la legislation, vous disposez d'un droit de retractation de 14 jours a compter de la souscription. Pour l'exercer, contactez-nous a [email]. Consultez nos [Conditions Generales d'Utilisation](/cgu)."

  - Notes: Le composant recoit des props supplementaires : `paymentMethod: PaymentMethod | null`, `invoices: Invoice[]`, `role: string`, `amount: { amount: number, interval: string } | null`. La vue "non-abonne" (cartes de pricing) reste inchangee.

- [x] Task 14: Mettre a jour les pages wrapper abonnement
  - File: `app/accompagnante/abonnement/page.tsx` et `app/accompagne/abonnement/page.tsx`
  - Action: Appeler les nouvelles fonctions en parallele avec `Promise.allSettled()` (PAS `Promise.all()` pour eviter qu'un echec Stripe bloque toute la page) :
    - `getSubscriptionStatus(user.id)` (toujours)
    - `getPaymentMethod(subscription.stripeCustomerId)` (seulement si `stripeCustomerId` existe)
    - `getInvoices(subscription.stripeCustomerId)` (seulement si `stripeCustomerId` existe)
    - `getSubscriptionAmount(subscription.stripePriceId)` (seulement si `stripePriceId` existe)
  - Passer les resultats en props au composant `SubscriptionPageContent`. Passer aussi le `role` de l'utilisateur. Pour les appels qui echouent (`status === 'rejected'`), passer `null` / `[]`.
  - Notes: L'ordre d'execution : d'abord `getSubscriptionStatus`, puis en parallele les 3 autres (ils dependent de `stripeCustomerId`/`stripePriceId`). Utiliser un pattern sequentiel-puis-parallele.

#### Phase 6 : Carte dashboard

- [x] Task 15: Ajouter la carte "Mon abonnement" sur le dashboard accompagnante
  - File: `app/accompagnante/dashboard/page.tsx`
  - Action: Remplacer l'appel `hasActiveSubscription(user.id)` par `getSubscriptionStatus(user.id)`. Conserver le boolean `subscribed` pour la logique existante (`const subscribed = subscription.active`). Ajouter une carte dans la grille existante, meme style que les autres (`bg-white rounded-xl border p-6`). Contenu :
    - Titre : "Mon abonnement"
    - Si abonne actif : afficher le plan (Mensuel/Annuel) + "Prochaine echeance : {date}". Si annulation prevue, afficher "Expire le {date}" a la place.
    - Si en essai gratuit : "Essai gratuit - Fin le {date}"
    - Si non abonne : "Aucun abonnement actif"
    - Bouton : "Gerer mon abonnement" → lien vers `/accompagnante/abonnement`
  - Notes: Ceci ne rajoute qu'un seul appel Supabase (qui remplace `hasActiveSubscription`) et ne rajoute aucun appel Stripe. La difference de performance est negligeable (5 colonnes au lieu de 2).

- [x] Task 16: Ajouter la carte "Mon abonnement" sur le dashboard accompagne
  - File: `app/accompagne/dashboard/page.tsx`
  - Action: Meme carte que Task 15, adaptee au role accompagne. Lien vers `/accompagne/abonnement`. Le dashboard accompagne aura donc 7 cartes (au lieu de 6).
  - Notes: Le dashboard accompagne utilise deja `hasActiveSubscription()` via `Promise.all()`. Remplacer par `getSubscriptionStatus()` dans le meme `Promise.all()`.

#### Phase 7 : Vue admin

- [x] Task 17: Ajouter la section abonnement dans le detail utilisateur admin
  - File: `app/admin/utilisateurs/[id]/page.tsx`
  - Action:
    1. **Verifier le check admin** (Task 0c) : s'assurer que la page verifie que l'utilisateur connecte a le role `admin`. Si absent, ajouter le check.
    2. Appeler `getSubscriptionStatus(userId)` avec le `userId` de l'utilisateur consulte.
    3. Ajouter une nouvelle section "Abonnement" (meme style que les autres sections : `bg-white rounded-xl border p-6`). Contenu :
       - Si abonnement existant : statut (badge couleur), plan, date de debut (`first_subscription_date` — a selectionner dans la query), prochaine echeance, date d'annulation prevue (si applicable)
       - Bouton "Annuler l'abonnement" (si actif et pas deja en annulation) avec **modale de confirmation** : "Etes-vous sur de vouloir annuler l'abonnement de {prenom} {nom} ? L'acces restera actif jusqu'a la fin de la periode en cours." Boutons : "Annuler" / "Confirmer l'annulation". Le bouton "Confirmer" appelle `adminCancelSubscription`.
       - Si aucun abonnement : "Aucun abonnement"
  - Notes: La modale admin peut etre un composant client simple inline ou reutiliser un pattern existant. L'action est loguee dans `admin_actions_log`.

#### Phase 8 : Cron job rappel expiration

- [x] Task 18: Creer le endpoint API pour le rappel d'expiration
  - File: `app/api/cron/expiration-reminder/route.ts` (nouveau)
  - Action: Creer un endpoint GET protege par verification du header `Authorization: Bearer {CRON_SECRET}`. Retourner 401 si le secret est absent ou invalide.
    1. Requete Supabase : selectionner les abonnements avec `cancel_at` dans les 3 prochains jours et `status = 'active'`, jointure avec `users` pour email et prenom.
    2. **Deduplication** : pour chaque resultat, verifier dans `notifications_log` qu'un email de type `expiration_reminder` n'a pas deja ete envoye pour cet userId dans les 7 derniers jours.
    3. Pour ceux qui passent le filtre, appeler `sendExpirationReminderEmail()`.
    4. Retourner `{ sent: number, skipped: number }` en JSON.
  - Notes: Ajouter `CRON_SECRET` dans `.env.local.example` et dans les variables d'environnement Vercel. Si deploye sur Vercel, configurer dans `vercel.json` :
    ```json
    { "crons": [{ "path": "/api/cron/expiration-reminder", "schedule": "0 8 * * *" }] }
    ```
    Vercel Cron passe automatiquement le header `Authorization: Bearer {CRON_SECRET}`. L'endpoint ne doit PAS etre accessible publiquement sans ce header.

#### Phase 9 : Configuration Stripe

- [x] Task 19: Activer le webhook `invoice.upcoming` dans Stripe
  - Action: Dans le dashboard Stripe (Developers > Webhooks), ajouter l'event `invoice.upcoming` au webhook existant. Tester via Stripe CLI : `stripe trigger invoice.upcoming`.
  - Notes: Sans cette activation, le rappel de renouvellement ne fonctionnera pas. Ceci est une action manuelle dans le dashboard Stripe, pas du code.

### Acceptance Criteria

#### Carte dashboard

- [ ] AC 1: Given un utilisateur accompagnante connecte avec un abonnement actif mensuel, when il consulte son dashboard, then il voit une carte "Mon abonnement" affichant "Mensuel" et la date de prochaine echeance, avec un bouton "Gerer mon abonnement" menant a `/accompagnante/abonnement`.
- [ ] AC 2: Given un utilisateur accompagne connecte sans abonnement, when il consulte son dashboard, then il voit une carte "Mon abonnement" affichant "Aucun abonnement actif" avec un bouton menant a `/accompagne/abonnement`.
- [ ] AC 3: Given un utilisateur avec un abonnement annule (cancel_at defini), when il consulte son dashboard, then la carte affiche "Expire le {date}".
- [ ] AC 4: Given un utilisateur en essai gratuit (trialing), when il consulte son dashboard, then la carte affiche "Essai gratuit - Fin le {date}".

#### Page abonnement enrichie

- [ ] AC 5: Given un abonne actif, when il consulte sa page abonnement, then il voit son plan (Mensuel/Annuel), le montant reel (depuis Stripe), la prochaine echeance, et son moyen de paiement (marque + 4 derniers chiffres).
- [ ] AC 6: Given un abonne actif mais l'API Stripe est indisponible pour le moyen de paiement, when il consulte sa page abonnement, then il voit "Information indisponible" avec un bouton "Gerer via Stripe" a la place des details carte.
- [ ] AC 7: Given un abonne actif, when il consulte la section "Historique des factures", then il voit les dernieres factures avec date, montant, statut et lien PDF telechargeable.
- [ ] AC 8: Given un abonne mensuel actif (pas trialing), when il clique sur "Passer a l'annuel", then son abonnement est mis a jour via Stripe avec prorata, et la page se rafraichit avec le nouveau plan.
- [ ] AC 9: Given un abonne annuel actif (pas trialing), when il clique sur "Passer au mensuel", then il voit un avertissement sur le cout plus eleve par mois, et apres confirmation son abonnement est mis a jour via Stripe.
- [ ] AC 10: Given un abonne en essai gratuit (trialing), when il consulte la page abonnement, then la carte "Changer de formule" n'est PAS affichee.
- [ ] AC 11: Given un non-abonne, when il consulte la page abonnement, then il voit les cartes de pricing (mensuel/annuel) inchangees.

#### Resiliation

- [ ] AC 12: Given un abonne actif sans annulation prevue, when il clique sur "Resilier mon abonnement", then une modale s'ouvre avec le recap de son abonnement (plan, date de fin d'acces, ce qui sera perdu).
- [ ] AC 13: Given la modale de resiliation ouverte, when il clique sur "Confirmer la resiliation", then l'abonnement est marque `cancel_at_period_end` via Stripe, et la modale affiche un ecran de confirmation avec la date de fin d'acces.
- [ ] AC 14: Given un abonne avec annulation prevue, when il consulte sa page abonnement, then le bouton "Resilier" n'est plus visible, et un bouton "Reactiver mon abonnement" est affiche a la place.
- [ ] AC 15: Given un abonne avec annulation prevue, when il clique sur "Reactiver mon abonnement", then l'annulation est inversee via Stripe et la page se rafraichit sans `cancelAt`.

#### Conformite legale

- [ ] AC 16: Given un abonne sur la page abonnement, when il consulte le bas de la page, then il voit une mention du droit de retractation de 14 jours avec un lien email pour l'exercer, et un lien vers les CGV (`/cgu`).

#### Admin

- [ ] AC 17: Given un admin sur la page detail d'un utilisateur avec abonnement actif, when il consulte la section "Abonnement", then il voit le statut, plan, dates, et un bouton "Annuler l'abonnement".
- [ ] AC 18: Given un admin, when il clique sur "Annuler l'abonnement", then une modale de confirmation s'affiche. S'il confirme, l'abonnement est annule via Stripe, l'action est loguee dans `admin_actions_log`, et la page se rafraichit.
- [ ] AC 19: Given un admin sur la page detail d'un utilisateur sans abonnement, when il consulte la section "Abonnement", then il voit "Aucun abonnement".
- [ ] AC 20: Given un utilisateur non-admin qui tente d'acceder a `/admin/utilisateurs/{id}`, when la page se charge, then il est redirige vers `/`.

#### Emails

- [ ] AC 21: Given un abonne qui change de plan (mensuel -> annuel) via l'app ou le portail Stripe, when le webhook `customer.subscription.updated` est recu, then un email de confirmation de changement de plan est envoye (une seule fois, pas de doublon en cas de retry) et logue dans `notifications_log`.
- [ ] AC 22: Given un abonnement avec renouvellement proche, when Stripe envoie le webhook `invoice.upcoming`, then un email de rappel de renouvellement est envoye avec le montant et la date (une seule fois en 24h, pas de doublon).
- [ ] AC 23: Given un abonnement annule avec expiration dans 3 jours, when le cron job s'execute, then un email de rappel d'expiration est envoye (une seule fois par periode de 7 jours).

#### Bugfixes

- [ ] AC 24: Given un utilisateur qui annule puis reactive son abonnement via le portail Stripe, when le webhook `subscription.updated` est recu, then `cancel_at` est remis a `null` en BDD et la page abonnement n'affiche plus "Annulation prevue".
- [ ] AC 25: Given un accompagne qui recoit un email de confirmation d'abonnement, when il clique sur le lien, then il est redirige vers `/accompagne/abonnement` (et non `/accompagnante/abonnement`).

#### Securite

- [ ] AC 26: Given une requete GET vers `/api/cron/expiration-reminder` sans header `Authorization` valide, when le endpoint recoit la requete, then il retourne un code 401.

## Additional Context

### Dependencies

- **Stripe API** : `invoices.list()` (factures), `customers.retrieve()` avec expand payment method, `prices.retrieve()` (montant reel), `subscriptions.retrieve()` (item ID pour switch), `subscriptions.update()` (switch plan, annulation, reactivation), webhook `invoice.upcoming` (a activer manuellement dans le dashboard Stripe)
- **Resend** : 3 nouveaux templates email + correction de 2 existants
- **Supabase** : table `subscriptions` existante (verifier colonnes `plan_type`, `stripe_price_id` — elles sont ecrites par le webhook mais leur existence doit etre confirmee), `notifications_log` (logging emails + deduplication), `admin_actions_log` (logging actions admin)
- **Vercel Cron** : pour le endpoint `/api/cron/expiration-reminder` (execution quotidienne a 8h). Necessite configuration `vercel.json` + variable `CRON_SECRET`.
- **Variable d'environnement** : `CRON_SECRET` a ajouter

### Testing Strategy

Pas de tests automatises (aucun pattern de test existant dans le codebase). Verification manuelle :

- **Bugfixes** : annuler puis reactiver un abonnement via le portail Stripe, verifier que `cancel_at` est remis a `null` en BDD. Verifier les liens dans les emails de confirmation/annulation pour un accompagne.
- **Page abonnement** : verifier l'affichage avec un compte abonne actif (mensuel et annuel), un compte en trial, un compte annule, un compte sans abonnement. Tester la resilience si Stripe est lent/indisponible (les fallbacks doivent s'afficher).
- **Switch plan** : tester mensuel -> annuel et annuel -> mensuel, verifier le prorata dans le dashboard Stripe. Tester qu'un switch vers le meme plan ne fait rien. Tester qu'un utilisateur en trial ne peut pas switcher.
- **Resiliation** : tester le flow 2 clics (bouton -> modale -> confirmer). Verifier que le bouton "Confirmer" est desactive pendant l'appel. Verifier que le bouton "Resilier" disparait apres annulation et que "Reactiver" apparait.
- **Reactivation** : tester la reactivation, verifier que `cancel_at` est remis a `null` via le webhook.
- **Factures** : verifier le telechargement PDF, les montants affiches.
- **Admin** : tester l'annulation depuis la page detail (avec modale de confirmation), verifier le log dans `admin_actions_log`. Tester qu'un non-admin est redirige.
- **Emails** : verifier les 3 nouveaux templates + les 2 corriges. Tester la deduplication en retriggerant un webhook.
- **Webhook `invoice.upcoming`** : activer l'event dans le dashboard Stripe, tester via Stripe CLI (`stripe trigger invoice.upcoming`).
- **Cron** : tester en local avec `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/expiration-reminder`. Verifier la deduplication.

### Notes

- **Conformite legale francaise obligatoire** : resiliation en 3 clics max (loi du 1er juin 2023, amende jusqu'a 75 000 EUR pour les entreprises). Notre implementation est en 2 clics (bouton + confirmation). Le droit de retractation 14 jours est mentionne avec un moyen de l'exercer (email de contact). Le traitement est manuel via le dashboard Stripe.
- **Activation webhook** : l'event `invoice.upcoming` doit etre ajoute dans la configuration du webhook Stripe (Dashboard > Developers > Webhooks). Sans cela, le rappel de renouvellement ne fonctionnera pas. Ajouter a la checklist de deploiement.
- **CRON_SECRET** : ajouter la variable dans `.env.local.example`, Vercel, et documenter dans la checklist de deploiement.
- **Prorata Stripe** : le comportement par defaut de Stripe lors d'un switch de plan est `create_prorations`. L'utilisateur sera debite/credite au prorata. Ceci est transparent et gere par Stripe.
- **Source de verite unique** : le webhook `customer.subscription.updated` est la seule source de verite pour `plan_type`, `stripe_price_id`, `cancel_at`, `cancelled_at` en BDD. Les server actions (`switchPlan`, `cancelSubscriptionFromModal`, `reactivateSubscription`) ne modifient PAS la BDD directement — elles appellent Stripe et laissent le webhook mettre a jour la BDD.
- **Resilience Stripe** : toutes les fonctions qui appellent l'API Stripe (`getPaymentMethod`, `getInvoices`, `getSubscriptionAmount`) sont encapsulees dans des try/catch et retournent des valeurs fallback (`null`, `[]`). Les composants UI affichent des messages de fallback propres.
- Les cartes dashboard suivent exactement le meme style visuel que les cartes existantes.
- Le dashboard accompagne passera de 6 a 7 cartes avec l'ajout de "Mon abonnement".
- L'onglet "Revenus" du dashboard admin affiche deja MRR, segments, churn — la vue admin ici concerne la gestion individuelle par utilisateur.
- **Tech debt identifiee** : absence totale de tests automatises pour les flows de paiement. A adresser dans un futur sprint.

## Review Notes

- Adversarial review completed
- Findings: 18 total, 15 fixed, 3 skipped (F12 retrocompat volontaire, F13 pattern existant, F17/F18 mineurs)
- Resolution approach: auto-fix
- Corrections notables : caracteres corrompus, try/catch manquants, echappement HTML emails, gardes cancelAt sur switchPlan, deduplication robuste cron
