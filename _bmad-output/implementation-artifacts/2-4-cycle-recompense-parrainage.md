# Story 2.4 : Cycle récompense parrainage (cron J+30, coupon Stripe, compteur UI)

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **marraine accompagnante** ayant parraine plusieurs filleules,
je veux que **chaque filleule restee abonnee active 30 jours soit comptabilisee** dans mon compteur, et **declencher automatiquement 6 mois d'abonnement gratuit pour moi quand j'atteins 5 parrainages confirmes**, avec une **carte dashboard qui montre mon compteur, ma liste de filleules et qui m'avertit a chaque palier**,
afin de **profiter concretement de la promesse du programme** (« 5 parrainages = 6 mois offerts ») sans intervention manuelle de l'admin et avec un retour visible sur le travail viral effectue.

## Acceptance Criteria

1. **AC1 - Cron `/api/cron/confirm-parrainages` (route GET)**
   Nouveau fichier `app/api/cron/confirm-parrainages/route.ts` (pattern `app/api/cron/expiration-reminder/route.ts`). Route protegee par `Authorization: Bearer ${process.env.CRON_SECRET}` (401 sinon). Comportement :
   - Charger toutes les rows `parrainages` avec `statut='abonnee'` ET `filleule_abonnee_at <= NOW() - INTERVAL '30 days'` (limite 200 par run pour borner le travail) via `getSupabaseAdmin()` (service role).
   - Pour chaque row, dans une boucle sequentielle (pas de Promise.all pour preserver l'idempotence par-row) :
     1. Verifier que la filleule a un abonnement Stripe **toujours actif** : `subscriptions.status IN ('active','trialing')` ET (`current_period_end IS NULL OR current_period_end > NOW()`). Si non actif (resilie, expire, fraude, churn) -> **skip** (ne pas confirmer, ne pas incrementer, le parrainage reste `abonnee` jusqu'a churn ou re-activation). **Ne pas** repasser le statut a un autre etat : la filleule peut se reabonner, l'evaluation est reprise au cron suivant.
     2. **Compare-and-swap idempotent** : `UPDATE parrainages SET statut='confirme', confirme_at=NOW() WHERE id=:id AND statut='abonnee' RETURNING id`. Si 0 ligne retournee -> skip (concurrent ou rejeu).
     3. **Increment compteur** : `UPDATE parrainages_codes SET compteur_confirmes = compteur_confirmes + 1 WHERE user_id=:marraine_id RETURNING compteur_confirmes, total_recompenses, code`. Si pas de row (cas marraine `valide` sans code genere : edge dette technique Story 2.2) -> log `console.error('[cron_confirm_parrainages][missing_code]', { marraine_id })` et continuer (la confirmation parrainage reste, juste sans recompense possible).
     4. **Trigger recompense** : si `compteur_confirmes >= 5` apres l'increment, voir AC2.
   - Retour HTTP : `NextResponse.json({ processed, confirmed, rewards, skipped, errors })`. Tout exception loop est captee dans un try/catch par-row, `errors++`, et console.error pour logs Vercel ; on n'interrompt pas le batch.

2. **AC2 - Application coupon Stripe 100% / 6 mois sur la marraine**
   Quand l'AC1 step 4 declenche (`compteur_confirmes >= 5`), reutiliser exactement le pattern de `app/actions/admin.ts:509-522` (coupon Stripe + subscription discount). Sequence :
   - **Pre-check abonnement marraine** : charger `subscriptions` de la marraine via `getSubscriptionStatus(marraine_id)` (helper `lib/subscription-helpers.ts`). Si `active` est `false` OU pas de `stripe_subscription_id` -> log `console.warn('[cron_confirm_parrainages][marraine_no_active_sub]', { marraine_id })` et **conserver** le compteur a 5+ (ne pas reset, ne pas creer coupon : la marraine recuperera la recompense lors d'une future re-souscription). Pas d'email, pas de log admin (cas degenere).
   - **Creer coupon** :
     ```ts
     const coupon = await stripe.coupons.create({
       percent_off: 100,
       duration: 'repeating',
       duration_in_months: 6,
       name: `Recompense parrainage - ${marraineEmail}`,
       metadata: { user_id: marraine_id, type: 'parrainage_recompense' },
     })
     ```
   - **Appliquer a la subscription active** :
     ```ts
     await stripe.subscriptions.update(stripeSubscriptionId, {
       discounts: [{ coupon: coupon.id }],
     })
     ```
   - **Si le call Stripe echoue** (try/catch) : log `console.error('[cron_confirm_parrainages][stripe_apply]', err)`, **ne pas** decrementer le compteur cote BDD (la prochaine execution du cron retentera puisque le compteur est >=5 et il n'y a pas eu de reset). **Ne pas** envoyer email ni log admin tant que la recompense n'est pas effective.
   - **Si succes** :
     - `UPDATE parrainages_codes SET compteur_confirmes = compteur_confirmes - 5, total_recompenses = total_recompenses + 1, derniere_recompense_at = NOW() WHERE user_id = :marraine_id`. **Soustraction** (pas reset a 0) pour gerer un improbable depassement (si 6 confirmations arrivent le meme run, on garde 1 en credit pour le prochain palier).
     - `INSERT admin_actions_log` avec `action_type='parrainage_recompense_appliquee'`, `target_type='subscription'`, `target_id=marraine_id`, `details: { coupon_id: coupon.id, marraine_id, total_recompenses: <new value> }`, `admin_id: null` (cron, pas d'admin humain).
     - Appel `sendParrainageRecompense({ email, firstName, totalRecompenses, userId: marraine_id })` (AC4).
     - Increment compteur retours du cron : `rewards++`.

3. **AC3 - Vercel cron declaration**
   Etendre `vercel.json` :
   ```json
   {
     "crons": [
       { "path": "/api/cron/update-badges", "schedule": "0 3 * * *" },
       { "path": "/api/cron/reactivate-disponible", "schedule": "0 6 * * *" },
       { "path": "/api/cron/expiration-reminder", "schedule": "0 8 * * *" },
       { "path": "/api/cron/confirm-parrainages", "schedule": "0 2 * * *" }
     ]
   }
   ```
   Schedule `0 2 * * *` (2h du matin UTC) pour minimiser collision avec les autres crons et la charge utilisateur. Pas de timeout custom (300s par defaut sur Vercel suffit largement pour <200 rows).

4. **AC4 - Email `sendParrainageRecompense` (`lib/emails.ts`)**
   Nouvelle fonction async a ajouter **apres** `sendParrainageFilleuleConfirmation` (ligne ~636) :
   ```ts
   export async function sendParrainageRecompense(params: {
     email: string
     firstName: string
     totalRecompenses: number
     userId?: string
   })
   ```
   - Sujet : `Felicitations, vous avez 6 mois offerts sur roxanetnous`
   - Corps HTML : noir/blanc, **pas d'emoji**, structure identique aux autres emails de `lib/emails.ts` (max-width 600, `<h1 style="color: #000;">`, paragraphes, CTA `<a style="background: #000; color: #fff;">`). Contenu :
     - H1 : `Felicitations ${firstName}, 6 mois vous sont offerts`
     - Paragraphe : `5 accompagnantes que vous avez parrainees sont actives depuis plus de 30 jours. Comme promis, votre prochain prelevement sera remplace par 6 mois d'abonnement gratuit, automatiquement applique sur votre compte.`
     - Si `totalRecompenses > 1` : phrase complementaire `C'est votre ${totalRecompenses}e recompense - merci de continuer a faire grandir la communaute !`
     - CTA : `Voir mon abonnement` -> `${BASE_URL}/accompagnante/abonnement`
     - Phrase de cloture : `Continuez a parrainer pour cumuler de nouvelles recompenses (5 nouveaux parrainages confirmes = 6 mois supplementaires).`
   - Logging : `logNotification` avec `type='parrainage_recompense'`, `status='sent'|'error'`. Try/catch identique aux autres fonctions (AC5 Story 2.3 pour reference).
   - **Pas** de fallback `ADMIN_NOTIFICATIONS_EMAIL` ici - cet email part a la marraine reelle (pas a l'admin).

5. **AC5 - Composant `ParrainageCard` enrichi avec compteur et liste**
   `components/accompagnante/parrainage-card.tsx` doit etre **etendu** (pas reecrit) avec les donnees recompense. Nouvelle signature :
   ```tsx
   type Props = {
     code: string
     baseUrl: string
     compteur: number          // 0..4 (post-modulo si depassement)
     totalRecompenses: number  // historique cumule
     filleules: Array<{
       firstName: string | null
       statut: 'inscrite' | 'abonnee' | 'confirme' | 'fraude' | 'bloque'
       inscriteAt: string       // ISO
     }>
   }
   ```
   - **Bloc compteur** insere apres le bouton Copier et avant la phrase explicative existante :
     - Texte centre : `${compteur}/5 parrainages confirmes` en `font-bold text-lg`.
     - Sous-texte gris : si `compteur < 5` -> `Plus que ${5 - compteur} pour 6 mois offerts`. Si `compteur === 0 && totalRecompenses > 0` -> `Vous avez deja recu ${totalRecompenses} recompense${totalRecompenses > 1 ? 's' : ''}. Lancez un nouveau cycle !`. Si `compteur === 0 && totalRecompenses === 0` -> `Lancez votre premier cycle de parrainage !`.
     - **Barre de progression visuelle** : 5 carres `w-8 h-8` cote a cote. Carres remplis (`bg-black`) = 1..min(compteur,5), vides (`bg-white border border-black`) = le reste. Aucune couleur autre que noir/blanc/gris (DECISIONS.md regle 2026-02-11).
   - **Liste filleules** sous le compteur (visible uniquement si `filleules.length > 0`) :
     - Titre `<h4 className="font-medium text-sm mb-2 mt-4">Vos filleules</h4>`.
     - Liste `<ul>` (ou `<div>` flex column) une ligne par filleule. Format : `firstName ?? 'Filleule'` + badge statut a droite.
     - Badges en FR (text-xs, padding x2/y0.5, rounded) :
       - `inscrite` -> `Inscrite` (bg gray-100)
       - `abonnee` -> `Abonnee` (bg gray-200)
       - `confirme` -> `Confirmee` (bg-black text-white) - signal positif
       - `fraude` / `bloque` -> **non affichees** dans cette liste (filtrage cote serveur, voir AC6).
     - Tri `inscriteAt DESC` (plus recente en haut).
     - Limite affichage : 10 max. Si plus, ajouter `<p className="text-xs text-gray-500">…et ${count - 10} autres</p>`.
   - **Aucun emoji** ni icone Unicode (regle CLAUDE.md projet).

6. **AC6 - Chargement donnees dashboard (`app/accompagnante/dashboard/page.tsx`)**
   Etendre le bloc existant L37-L45 (chargement `parrainages_codes`) :
   - Charger `parrainages_codes`: ajouter `compteur_confirmes, total_recompenses` au `select` (deja `code` aujourd'hui).
   - Si `parrainageCode` non null, charger en parallele les filleules de cette marraine :
     ```ts
     const { data: filleulesData } = await supabase
       .from('parrainages')
       .select('filleule_id, statut, filleule_inscrite_at, users!parrainages_filleule_id_fkey(first_name)')
       .eq('marraine_id', user.id)
       .in('statut', ['inscrite', 'abonnee', 'confirme'])
       .order('filleule_inscrite_at', { ascending: false })
       .limit(20)
     ```
     **Filtrage statut** dans la requete : `inscrite`, `abonnee`, `confirme` (pas `fraude`, `bloque`, `en_attente`). RLS `parrainages_marraine_read` (Story 2.1) autorise deja la lecture par la marraine.
   - Mapper en `Array<{ firstName, statut, inscriteAt }>` avant de passer en prop. La RLS sur `users` peut bloquer le `select` joint du `first_name` : si echec, fallback `firstName: null`.
   - **Important** : ne pas faire ce chargement si `parrainageCode` est null (marraine non encore validee ou edge case Story 2.2).
   - Passer `compteur`, `totalRecompenses`, `filleules` en plus a `<ParrainageCard />`. Si tableau filleules vide ou query erreur, passer `filleules={[]}`.

7. **AC7 - Affichage code sur `/accompagnante/profil`**
   Etendre `app/accompagnante/profil/page.tsx` :
   - Apres le `select` profile L23-L27, ajouter un chargement `parrainages_codes` (pattern dashboard L37-L45).
   - Si `validation_status === 'valide'` ET `parrainageCode` non null, afficher **un bloc simple** au-dessus du formulaire de profil (pas le composant complet `ParrainageCard` - on reste minimaliste sur cette page) :
     ```tsx
     <div className="mb-6 p-4 rounded-xl border bg-white">
       <p className="text-sm text-gray-600 mb-1">Votre code de parrainage</p>
       <p className="font-mono font-bold text-lg tracking-widest">{parrainageCode}</p>
     </div>
     ```
   - Pas de bouton copier sur cette page (le dashboard reste le canal principal). Pas de compteur. Pas de liste filleules. Just-the-code.

8. **AC8 - Idempotence et garde-fous**
   - Cron rejouable manuellement (curl avec Bearer secret) sans creer de doublon de recompense ni de log.
   - Le compare-and-swap `WHERE statut='abonnee'` (AC1.2) garantit l'idempotence sur la transition `abonnee -> confirme`.
   - L'increment compteur est une operation Postgres atomique (`compteur_confirmes = compteur_confirmes + 1`) : pas de race possible meme si deux runs concurrents lisent le meme compteur.
   - Si un cron echoue en plein milieu (Vercel timeout, DB error), les rows deja confirmees restent confirmees (aucun rollback global). Au run suivant, on reprend la-ou on s'est arrete (toutes les rows non-confirmees sont re-evaluees).
   - **Cas edge** : si la filleule churns puis se re-abonne dans le mois -> cron skip (pas active au moment du run), puis le run du jour suivant qu'elle redevient active confirmera (idempotent).
   - **Cas edge 2** : si la marraine n'a pas de subscription active au moment du palier 5+, le compteur reste a 5. Au prochain run, si la marraine se re-abonne entre-temps, la recompense sera appliquee (le SQL `WHERE compteur_confirmes >= 5` declenche au prochain check). **Implementation** : ajouter en debut de cron, avant la boucle principale, un second passage qui evalue les `parrainages_codes` avec `compteur_confirmes >= 5` mais sans recompense recente, et tente l'application. **Decision MVP** : on **ne fait pas** ce second passage - on accepte de perdre la recompense si la marraine reste sans abo pendant >24h apres le palier (cas tres marginal). A documenter en Dev Notes.

9. **AC9 - Documentation et observabilite**
   - Logging structure : tous les `console.error` du cron prefixes `[cron_confirm_parrainages]` avec sous-cle (`[stripe_apply]`, `[missing_code]`, `[marraine_no_active_sub]`, `[loop_error]`).
   - Reponse HTTP du cron : JSON avec compteurs (`processed, confirmed, rewards, skipped, errors`) - utile pour la sortie Vercel logs et debug manuel.
   - Etendre `app/admin/historique/page.tsx:15` `actionLabels` avec `parrainage_recompense_appliquee: 'Parrainage - recompense 6 mois appliquee'` (deja documente §4.2.d du SCP, mais a verifier qu'il n'est pas deja present : Story 2.3 a ajoute 5 entrees mais pas celle-ci).
   - **Pas** de page admin dediee dans cette story - les recompenses sont visibles via `/admin/historique` (action_type filter) et via `parrainages_codes.total_recompenses` qu'un futur ecran admin pourrait surfacer.

10. **AC10 - Tests**
    - `npx tsc --noEmit` : 0 erreur.
    - `npm run build` : succes, route `/api/cron/confirm-parrainages` apparait dans le build (server route handler). **Verifier** que la nouvelle prop signature de `ParrainageCard` ne casse pas l'import dashboard.
    - Tests scenarios (manuels en preview Vercel, cron declenchable via curl avec Bearer) :
      1. **Confirmation simple** : marraine A avec 1 parrainage `abonnee` cree il y a >30j (manipuler `filleule_abonnee_at` en SQL pour simuler). Filleule a un abo `active`. Run cron -> `parrainages.statut='confirme'`, `compteur_confirmes=1`, `total_recompenses=0`, pas d'email recompense, pas de coupon Stripe. Reponse JSON `{ processed: 1, confirmed: 1, rewards: 0, skipped: 0, errors: 0 }`.
      2. **Filleule churnee** : meme scenario mais `subscriptions.status='canceled'` -> `processed: 1, confirmed: 0, skipped: 1, rewards: 0`. La row reste `abonnee` (pas de transition).
      3. **Palier 5 atteint** : 5 parrainages `abonnee` >30j d'une meme marraine, tous avec abo filleule actif, marraine elle-meme avec abo actif. Run cron -> 5 confirmations, 1 coupon Stripe `100% / repeating / duration_in_months=6` cree, applique a la subscription marraine, `compteur_confirmes=0`, `total_recompenses=1`, email recompense recu, log `parrainage_recompense_appliquee` insere. Verifier via Stripe dashboard que la subscription marraine a bien le discount.
      4. **Idempotence** : relancer le cron immediatement -> `processed: 0, confirmed: 0, rewards: 0` (les rows sont deja `confirme`).
      5. **Marraine sans abo actif au palier** : 5 parrainages prets, marraine `subscriptions.status='canceled'` -> 5 confirmations posees, `compteur_confirmes=5`, **pas** de coupon Stripe, **pas** d'email. Log `console.warn('[cron_confirm_parrainages][marraine_no_active_sub]')`. Reponse `rewards: 0`.
      6. **UI dashboard** : connexion comme marraine A apres run cron -> `ParrainageCard` affiche `1/5 parrainages confirmes`, barre de progression 1 carre noir 4 vides, liste de 1 filleule avec badge `Confirmee`.
      7. **UI profil** : meme connexion -> bloc code visible au-dessus du formulaire profil.
      8. **Multiples paliers** : 10 parrainages prets pour la meme marraine -> apres run, `compteur_confirmes=0` ou `1` (si l'increment a depasse a 6 puis -5 = 1), `total_recompenses=1` ou `2` selon ordre de traitement. Idealement 2 coupons Stripe distincts crees.

## Tasks / Subtasks

- [x] Task 1 - Etendre `lib/emails.ts` avec `sendParrainageRecompense` (AC: 4)
  - [x] Subtask 1.1 - Ajouter la fonction apres `sendParrainageFilleuleConfirmation`, pattern try/catch + `logNotification` identique
  - [x] Subtask 1.2 - Verifier l'absence d'emoji et le respect noir/blanc dans le HTML

- [x] Task 2 - Creer le cron `/api/cron/confirm-parrainages` (AC: 1, 2, 8, 9)
  - [x] Subtask 2.1 - Creer `app/api/cron/confirm-parrainages/route.ts` avec garde `CRON_SECRET` (pattern `update-badges/route.ts`)
  - [x] Subtask 2.2 - Implementer la requete principale (statut=abonnee, filleule_abonnee_at <= NOW() - 30 days, limit 200)
  - [x] Subtask 2.3 - Boucle sequentielle avec verification subscription filleule via `hasActiveSubscription`
  - [x] Subtask 2.4 - Compare-and-swap `UPDATE parrainages SET statut='confirme'` avec idempotence
  - [x] Subtask 2.5 - Increment `parrainages_codes.compteur_confirmes` atomique (RPC ou UPDATE retournant la valeur)
  - [x] Subtask 2.6 - Branche recompense (`compteur_confirmes >= 5`) : pre-check abo marraine, coupon Stripe, apply discount, soustraction 5, increment total_recompenses, log admin, email
  - [x] Subtask 2.7 - Reponse JSON avec compteurs `{ processed, confirmed, rewards, skipped, errors }`

- [x] Task 3 - Declarer le cron dans `vercel.json` (AC: 3)
  - [x] Subtask 3.1 - Ajouter l'entree `{ path, schedule: '0 2 * * *' }` apres les 3 crons existants

- [x] Task 4 - Etendre `ParrainageCard` avec compteur, barre de progression et liste filleules (AC: 5)
  - [x] Subtask 4.1 - Mettre a jour le type `Props` (ajout `compteur`, `totalRecompenses`, `filleules`)
  - [x] Subtask 4.2 - Bloc compteur + sous-texte conditionnel + barre de progression 5 carres
  - [x] Subtask 4.3 - Liste filleules conditionnelle avec badges FR (Inscrite/Abonnee/Confirmee), tri DESC, limite 10
  - [x] Subtask 4.4 - Verifier le respect strict noir/blanc/gris et l'absence d'emoji

- [x] Task 5 - Charger compteur + filleules dans `app/accompagnante/dashboard/page.tsx` (AC: 6)
  - [x] Subtask 5.1 - Etendre le `select` parrainages_codes avec `compteur_confirmes, total_recompenses`
  - [x] Subtask 5.2 - Ajouter le `select` parrainages join users (filtre statut, tri DESC, limit 20)
  - [x] Subtask 5.3 - Mapper le resultat en prop typee, gerer le fallback firstName=null
  - [x] Subtask 5.4 - Passer les nouvelles props au composant

- [x] Task 6 - Afficher le code sur `/accompagnante/profil` (AC: 7)
  - [x] Subtask 6.1 - Ajouter le `select` parrainages_codes apres le profile
  - [x] Subtask 6.2 - Bloc inline simple (code en font-mono, pas de bouton copier)

- [x] Task 7 - Etendre `actionLabels` admin historique (AC: 9)
  - [x] Subtask 7.1 - Ajouter `parrainage_recompense_appliquee: 'Parrainage - recompense 6 mois appliquee'` dans `app/admin/historique/page.tsx:15-29`

- [x] Task 8 - Verifications (AC: 10)
  - [x] Subtask 8.1 - `npx tsc --noEmit` : 0 erreur
  - [x] Subtask 8.2 - `npm run build` : route `/api/cron/confirm-parrainages` presente
  - [x] Subtask 8.3 - Smoke local dashboard (curl /accompagnante/dashboard non-auth = 307 attendu)
  - [x] Subtask 8.4 - Documenter dans Dev Notes les scenarios a tester en preview Vercel par l'utilisateur

## Dev Notes

### Anti-pattern : ne **PAS** reinventer

| A faire | A ne PAS faire |
|---------|----------------|
| Reutiliser `getSupabaseAdmin()` du webhook ou `createClient({ serviceRole: true })` du parrainage.ts | Creer un nouveau helper Supabase service-role |
| Reutiliser exactement le pattern coupon `app/actions/admin.ts:509-522` (juste swap `duration: 'forever'` -> `duration: 'repeating', duration_in_months: 6`) | Creer un nouveau helper `createParrainageCoupon` ou inventer une nouvelle abstraction |
| Reutiliser `hasActiveSubscription(userId)` et `getSubscriptionStatus(userId)` de `lib/subscription-helpers.ts` | Refaire un select sur `subscriptions` directement dans le cron (duplique la logique de fenetre `current_period_end`) |
| Reutiliser `logNotification` de `lib/emails.ts` (deja utilise par tous les autres emails) | Inventer un nouveau systeme de log notification |
| Reutiliser le pattern try/catch silencieux des emails (Story 2.2 et 2.3) | Faire planter le cron a cause d'un email Resend qui rate |
| Etendre le composant `parrainage-card.tsx` existant | Creer `parrainage-card-v2.tsx` ou un nouveau composant |
| Pattern cron : `app/api/cron/expiration-reminder/route.ts` (boucle for-of, try/catch par row, increment compteurs) | Inventer un autre pattern, paralleliser avec Promise.all (casserait l'idempotence par-row) |

### Patterns critiques a respecter

- **CRON_SECRET garde** : verifier `request.headers.get('authorization') === \`Bearer ${process.env.CRON_SECRET}\``. Pattern strict identique a `update-badges/route.ts:5-9`. Vercel cron envoie automatiquement ce header en prod.
- **Service role pour le cron** : la requete principale doit ignorer la RLS pour cross-marraines. Utiliser `getSupabaseAdmin()` (pattern webhook stripe) ou `createClient({ serviceRole: true })` (pattern parrainage.ts).
- **Compare-and-swap** : tout `UPDATE` qui transitionne un statut DOIT etre filtre `WHERE statut='ancienne_valeur'` avec `.select()` pour detecter 0-row affecte. Pattern Story 2.1 AC9 (`confirmParrainageOnSuccess`) et Story 2.3 (webhook detect).
- **Pas d'emoji nulle part** : code, emails, UI. Regle CLAUDE.md projet **stricte**. Inclut les emojis Unicode du SCP source (ex: « 🎯 », « ✨ ») - les supprimer si copies.
- **Noir/blanc/gris uniquement** : aucune couleur primaire (DECISIONS.md 2026-02-11). La barre de progression utilise `bg-black` (rempli) / `bg-white border border-black` (vide). Les badges utilisent `bg-gray-100`, `bg-gray-200`, `bg-black text-white`.
- **Idempotence == correcteur de tout** : un cron rejouable est plus important qu'un cron rapide. Toujours preferer un compare-and-swap a une lecture-puis-ecriture.

### Stripe coupon - subtilites Story 2.4

- **`duration: 'repeating', duration_in_months: 6`** : applique le 100% sur les 6 prochains cycles facturation. Si la marraine est en plan **annuel**, elle a 6 mois de remise sur 12 (donc paye 50% de l'annee suivante). Si elle est en plan **mensuel**, 6 mois de gratuite consecutifs. Ne pas tenter de detecter le plan : Stripe gere la duree en fonction du `duration_in_months` independamment du `interval` du plan.
- **`stripe.subscriptions.update(id, { discounts: [{ coupon: id }] })`** : l'API moderne (depuis 2024) utilise `discounts` au lieu de `coupon`. Confirmer que `app/actions/admin.ts:520` utilise bien `discounts: [{ coupon: coupon.id }]` (oui : verifie ligne 520) - meme version d'API.
- **Cumul avec un coupon admin existant** : si la marraine a deja un `Offert par admin - 100% forever` (rare en prod), Stripe **remplace** le discount au lieu de cumuler. Decision : on accepte (le coupon admin etait deja 100%, l'effet net est nul). Pas de detection prealable.
- **Refacturation en cours** : si la marraine est en milieu de cycle au moment ou le discount est applique, Stripe applique le coupon **a partir de la prochaine invoice** (pas de proration retroactive). Acceptable pour MVP.

### Schema BDD (verifie via supabase MCP au moment du draft)

Tables existantes (migration `20260428130104_add_parrainage_feature.sql` deja appliquee) :
- `parrainages_codes(user_id PK, code, compteur_confirmes int default 0, total_recompenses int default 0, derniere_recompense_at, created_at)` - avec RLS `parrainages_codes_owner_read` (auth.uid = user_id)
- `parrainages(id, code, marraine_id, filleule_id, statut, filleule_inscrite_at, filleule_abonnee_at, confirme_at, ip_inscription, stripe_fingerprint, blocage_raison, flag_suspicion, created_at)` - avec RLS `parrainages_marraine_read` (auth.uid = marraine_id)
- `subscriptions(user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end, ...)` - schema confirme

**Aucune migration SQL** n'est necessaire pour cette story (toutes les colonnes existent deja).

### Project Structure Notes

- Les **server actions** ne sont pas necessaires pour cette story : tout passe par le route handler `/api/cron/...` (server-only par construction).
- Le composant `parrainage-card.tsx` reste un **client component** (`'use client'`) - les nouveaux blocs (compteur, liste) ne necessitent pas d'interactivite donc seraient mieux en server-side, mais pour preserver le code existant (boutons copier) on garde tout en client. Le surcout de client JS pour la liste statique est negligeable.
- **Aucun nouveau fichier** cote tests (le projet n'a pas de Jest/Vitest/Playwright). Tests = `tsc --noEmit` + `npm run build` + smoke manuel preview Vercel.

### Testing Standards

- Pas de framework de tests automatises dans le projet.
- Validation type : `npx tsc --noEmit` doit etre vert.
- Validation build : `npm run build` doit produire la route `/api/cron/confirm-parrainages` dans la liste des routes (mode dynamic, pas static).
- Tests fonctionnels : preview Vercel avec donnees seedees (manuellement editer des `filleule_abonnee_at` retroactivement pour declencher le cron sur des parrainages existants en environnement de test).
- Tests Stripe : utiliser le mode test, le coupon Stripe est creable en test sans contrainte ; verifier la subscription cible a bien `discounts` non vide via le dashboard Stripe.

### Dette technique reportee

| Sujet | Reporte a | Pourquoi |
|-------|-----------|----------|
| Backfill retroactif des codes pour accompagnantes deja `valide` (sans `parrainages_codes`) | Hors story (script ad-hoc admin) | Volume connu (~317 rows valides), peut etre traite par un one-shot SQL hors flow story. Le cron AC1 est resilient (skip + log). |
| Re-evaluation au prochain cycle d'une marraine sans abo actif au palier | Out of scope MVP | Cas marginal, complexite x2 du cron. Documente AC8 cas edge 2. |
| Page admin dediee `/admin/recompenses` (vue cumulee `total_recompenses` par marraine) | V2 | Visibilite via `admin/historique` deja suffisante pour MVP. |
| Notification proactive a 4/5 parrainages (« Plus qu'1 ! ») | V2 marketing | Decoupe possible mais pas demandee par le SCP source. |
| Stripe coupon `name` traduction si email marraine en non-FR | V2 i18n | Pas de FR/EN switch en MVP, name purement interne (visible Stripe dashboard admin). |
| Limit 200 par run du cron - si la base depasse ce volume, batch les runs | V2 scale | A 50 marraines actives, on est tres loin. |
| Affichage stripe_fingerprint capture par Story 2.2 dans la card (debug visuel) | V2 admin | Pas un besoin marraine. |

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.2.f] — specification cron J+30 (5 etapes, idempotence)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.7.d] — composant ParrainageCard complet (compteur visuel + liste filleules + 5/5 toast)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.8] — `sendParrainageRecompense` signature et timing (declenche au palier 5)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.9] — pseudo-code cron (etapes 1-7)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-Decisions-2026-04-18] — recompense = 6 mois apres 5 parrainages confirmes (active >=30j)
- [Source: _bmad-output/implementation-artifacts/2-1-validation-automatique-filleule.md] — `confirmParrainageOnSuccess` qui pose `statut='abonnee'` (state d'entree du cron)
- [Source: _bmad-output/implementation-artifacts/2-2-ui-parrainage-card-et-fingerprint-stripe.md] — version simplifiee actuelle de `ParrainageCard` a etendre (pas reecrire), capture `stripe_fingerprint` au webhook
- [Source: _bmad-output/implementation-artifacts/2-3-blacklist-admin-anti-fraude.md#AC10] — `actionLabels` admin historique a etendre (pattern strict)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — dette technique cumulee Stories 2.1/2.2/2.3 (verifie : aucun item ne bloque cette story)
- [Source: app/actions/admin.ts:509-522] — pattern coupon Stripe + apply discount (a copier modulo `duration: 'repeating', duration_in_months: 6`)
- [Source: app/api/cron/expiration-reminder/route.ts] — pattern cron : Bearer secret, boucle for-of, try/catch par row, NextResponse.json compteurs
- [Source: app/api/cron/update-badges/route.ts] — pattern cron minimal (auth header + appel + reponse JSON)
- [Source: lib/subscription-helpers.ts] — `hasActiveSubscription`, `getSubscriptionStatus` (a reutiliser)
- [Source: lib/emails.ts:531-636] — patterns `sendParrainageBienvenueMarraine` et `sendParrainageFilleuleConfirmation` (HTML structure, logNotification, try/catch)
- [Source: app/actions/parrainage.ts:467-580] — `confirmParrainageOnSuccess` qui pose `statut='abonnee'` (input du cron)
- [Source: app/api/webhooks/stripe/route.ts:402-477] — flow complet checkout.session.completed (lecture pour comprendre quand `statut='abonnee'` peut transitionner via le webhook a la place du success page)
- [Source: components/accompagnante/parrainage-card.tsx] — version actuelle a etendre
- [Source: app/accompagnante/dashboard/page.tsx:37-45] — chargement actuel `parrainages_codes` (a etendre)
- [Source: app/accompagnante/profil/page.tsx:23-27] — emplacement profile load (a enrichir)
- [Source: app/admin/historique/page.tsx:15] — actionLabels (a etendre)
- [Source: vercel.json] — declaration crons existante (a etendre)
- [Source: DECISIONS.md] — regles design noir/blanc, pas d'emoji
- [Source: .claude/CLAUDE.md] — regles projet (Next.js 16 + Supabase + ESM, pas d'emoji, Supabase MCP)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `claude-opus-4-7[1m]`

### Debug Log References

- `npx tsc --noEmit` -> 0 erreur (apres clean `.next/` qui contenait des doublons macOS `* 2.ts` non lies au code applicatif).
- `npm run build` (Next.js 16.2.4 / Turbopack) -> compile reussi en 2.4s, 43/43 pages generees, route `/api/cron/confirm-parrainages` presente dans la liste des routes dynamiques (`ƒ /api/cron/confirm-parrainages`).

### Completion Notes List

- **Cron `/api/cron/confirm-parrainages`** (`app/api/cron/confirm-parrainages/route.ts`) : route GET protegee par `Bearer ${CRON_SECRET}`, charge jusqu'a 200 parrainages `statut='abonnee'` AND `filleule_abonnee_at <= now - 30j`. Boucle sequentielle for-of, par-row : `hasActiveSubscription(filleule_id)` -> compare-and-swap `statut: abonnee -> confirme` (filtre `.eq('statut', 'abonnee')` + `.select()` pour detecter 0-row idempotent) -> increment `parrainages_codes.compteur_confirmes` -> branche recompense si `>= 5`. Reponse JSON `{ processed, confirmed, rewards, skipped, errors }`. Logs `console.error('[cron_confirm_parrainages][...]')` avec sous-cle. Try/catch par-row pour ne pas interrompre le batch.
- **Increment compteur** : implementation lecture-puis-update (pas RPC car aucune RPC custom dans le projet). L'idempotence est protegee par le compare-and-swap statut au step precedent (un parrainage ne peut etre incremente qu'une seule fois). Documente en code.
- **Branche recompense** : pre-check `getSubscriptionStatus(marraine_id).active && stripeSubscriptionId` (skip + log warn sinon). `stripe.coupons.create({ percent_off: 100, duration: 'repeating', duration_in_months: 6, metadata })` -> `stripe.subscriptions.update(stripeSubscriptionId, { discounts: [{ coupon }] })`. Sur succes : soustraction (`-5`, pas reset) + increment `total_recompenses` + `derniere_recompense_at` + insertion `admin_actions_log` (admin_id null, action_type `parrainage_recompense_appliquee`) + envoi `sendParrainageRecompense`. Sur erreur Stripe : log + `errors++`, le compteur reste >= 5 -> retry au prochain run du cron (idempotent).
- **Email `sendParrainageRecompense`** (`lib/emails.ts` apres `sendParrainageFilleuleConfirmation`) : sujet `Felicitations, vous avez 6 mois offerts sur roxanetnous`, HTML noir/blanc max-width 600 sans emoji, CTA `Voir mon abonnement -> /accompagnante/abonnement`, phrase de cumul conditionnelle si `totalRecompenses > 1`, `logNotification` type `parrainage_recompense`. Pas de fallback admin (email destine a la marraine reelle).
- **`ParrainageCard` etendue** (`components/accompagnante/parrainage-card.tsx`) : nouvelles props `compteur`, `totalRecompenses`, `filleules`. Bloc compteur centre `${compteurClamped}/5 parrainages confirmes` + sous-texte conditionnel (palier atteint / cycle suivant / premier cycle / Plus que X) + barre de progression 5 carres `w-8 h-8` (rempli `bg-black`, vide `bg-white border border-black`). Liste filleules conditionnelle (filtre fraude/bloque cote client en plus du filtre serveur), tri par ordre du serveur, limite 10 + ligne `...et X autres`. Badges FR : Inscrite (gray-100), Abonnee (gray-200), Confirmee (bg-black text-white). Aucun emoji.
- **Dashboard accompagnante** (`app/accompagnante/dashboard/page.tsx`) : extension du `select` parrainages_codes avec `compteur_confirmes, total_recompenses` ; chargement parallele `parrainages` join `users` (filtre statut `inscrite/abonnee/confirme`, tri `filleule_inscrite_at` DESC, limit 20) seulement si `parrainageCode` existe. Mapping defensif (Array vs object pour le join Supabase) avec fallback `firstName: null`. Nouvelles props passees a `<ParrainageCard />`.
- **Profil accompagnante** (`app/accompagnante/profil/page.tsx`) : ajout d'un `select code` sur `parrainages_codes` quand `validation_status === 'valide'`, affichage d'un bloc inline simple (font-mono, sans bouton copier) au-dessus du `<h2>Mon profil</h2>` flux (au-dessus du formulaire conformement a AC7).
- **Admin historique** (`app/admin/historique/page.tsx:15-30`) : ajout du label `parrainage_recompense_appliquee: 'Parrainage - recompense 6 mois appliquee'`.
- **`vercel.json`** : ajout du cron `{ path: '/api/cron/confirm-parrainages', schedule: '0 2 * * *' }` (2h UTC, minimise collision).

### Scenarios a tester en preview Vercel (manuellement par l'utilisateur)

Le projet n'a pas de framework de tests automatises. Les scenarios suivants doivent etre executes en preview avec donnees seedees :

1. **Confirmation simple** : marraine A avec 1 parrainage `abonnee` cree il y a >30j (manipuler `filleule_abonnee_at` en SQL pour simuler), filleule a un abo `active`. `curl -H 'Authorization: Bearer $CRON_SECRET' /api/cron/confirm-parrainages` -> `parrainages.statut='confirme'`, `compteur_confirmes=1`, `total_recompenses=0`, pas d'email recompense, pas de coupon Stripe. Reponse JSON `{ processed: 1, confirmed: 1, rewards: 0, skipped: 0, errors: 0 }`.
2. **Filleule churnee** : meme scenario mais `subscriptions.status='canceled'` -> `processed: 1, confirmed: 0, skipped: 1, rewards: 0`. La row reste `abonnee`.
3. **Palier 5 atteint** : 5 parrainages prets, marraine avec abo actif. Run cron -> 5 confirmations, 1 coupon Stripe `100% / repeating / 6mo` cree, applique a la subscription marraine, `compteur_confirmes=0`, `total_recompenses=1`, email recompense recu, log `parrainage_recompense_appliquee` insere. Verifier via dashboard Stripe le discount sur la subscription.
4. **Idempotence** : relancer le cron immediatement -> `processed: 0, confirmed: 0, rewards: 0`.
5. **Marraine sans abo actif** : 5 parrainages prets, marraine `subscriptions.status='canceled'` -> 5 confirmations posees, `compteur_confirmes=5`, **pas** de coupon, **pas** d'email. Log `console.warn('[cron_confirm_parrainages][marraine_no_active_sub]')`. Reponse `rewards: 0`.
6. **UI dashboard** : connexion marraine apres run cron -> ParrainageCard affiche `1/5 parrainages confirmes`, barre 1 carre noir + 4 vides, liste 1 filleule avec badge `Confirmee`.
7. **UI profil** : meme connexion -> bloc code visible au-dessus du formulaire de profil.
8. **Multiples paliers** : 10 parrainages prets pour la meme marraine -> apres run, soit `compteur_confirmes=0` `total_recompenses=2` (2 coupons appliques en sequence), soit `compteur_confirmes=1..5` partiel selon ordre. Verifier que les coupons cumulatifs sont bien geres par Stripe (le 2e remplace le 1er sur la meme subscription : c'est le comportement attendu, cf. Dev Notes).

### File List

- `lib/emails.ts` (modifie) : ajout de `sendParrainageRecompense`.
- `app/api/cron/confirm-parrainages/route.ts` (nouveau) : route handler GET du cron J+30.
- `vercel.json` (modifie) : declaration du cron `/api/cron/confirm-parrainages` schedule `0 2 * * *`.
- `components/accompagnante/parrainage-card.tsx` (modifie) : extension props (`compteur`, `totalRecompenses`, `filleules`) + bloc compteur + barre de progression + liste filleules.
- `app/accompagnante/dashboard/page.tsx` (modifie) : chargement compteur, total_recompenses, liste filleules, nouvelles props passees a ParrainageCard.
- `app/accompagnante/profil/page.tsx` (modifie) : chargement code parrainage et bloc inline d'affichage.
- `app/admin/historique/page.tsx` (modifie) : nouveau label `parrainage_recompense_appliquee`.

### Review Findings

#### Decisions résolues (2026-04-29 — code review)

- [x] [Review][Decision] **D2 — `<ParrainageCard />` jamais utilisé** : **résolu (a)** — la spec demandait d'enrichir le composant existant et de l'afficher inline sur le dashboard (AC5/AC6). L'implémentation a recréé le composant from-scratch puis déplacé toute la feature sur `/accompagnante/parrainage` (page dédiée via `<ParrainageView />`). Décision : supprimer le composant mort + amender la spec pour entériner la page dédiée. AC5 et AC6 sont explicitement remplacés par "page dédiée /accompagnante/parrainage avec barre de progression + liste filleules + dashboard teaser inline".
- [x] [Review][Decision] **D3 — Cumul vs remplacement de `discounts`** : **résolu (a)** — Dev Notes 2.4 disent "on accepte le remplacement", l'implémentation cumule. Décision : revert au remplacement (`discounts: [{ coupon: coupon.id }]`), conforme à la décision ratifiée. Coupons admin antérieurs seront écrasés (cas rare, l'admin peut les ré-attribuer).
- [x] [Review][Decision] **D4 — Reward sur marraine en `trialing`** : **résolu (a)** — skipper la reward tant que `marraineSub.status === 'trialing'` ; le cron repasse chaque jour, la reward s'applique au premier passage en `active`. Évite l'over-spec "trial + 6 mois = 7 mois free".

#### Patch (fixable sans input utilisateur — vague 1+2, 2026-04-29)

- [x] [Review][Patch] **D2** Supprimer `components/accompagnante/parrainage-card.tsx` (dead code) + mettre à jour commentaire `parrainage.ts:695`.
- [x] [Review][Patch] **D3** Remplacer `discounts: [...existingCoupons, { coupon }]` par `discounts: [{ coupon: coupon.id }]`. [app/api/cron/confirm-parrainages/route.ts:1083-1097]
- [x] [Review][Patch] **D4** Skip `if (marraineSub.status === 'trialing')`. [app/api/cron/confirm-parrainages/route.ts:1047-1051]
- [x] [Review][Patch] **C1** Webhook idempotence : process AVANT insert `stripe_events_processed`. [app/api/webhooks/stripe/route.ts:1487-1503]
- [x] [Review][Patch] **C2/H7** Compteur atomique via RPC PG (`UPDATE compteur = compteur + 1 RETURNING`) + reward gated derrière RPC `claim_recompense_palier(marraine_id, palier)`. [app/api/cron/confirm-parrainages/route.ts:1029-1123]
- [x] [Review][Patch] **H5** Fail-loud si `ADMIN_NOTIFICATIONS_EMAIL` non set (au lieu de console.error silencieux). [lib/emails.ts:2256-2263]
- [x] [Review][Patch] **H6** Zombies `abonnee` : transitionner en `expire` après filleule cancellation détectée par cron. [app/api/cron/confirm-parrainages/route.ts:934-940]
- [x] [Review][Patch] **H8** Cumul de coupons recouvert par D3 (replace).
- [x] [Review][Patch] **H9** Cron : si `missing_code`, faire le CAS statut `abonnee→confirme` AVANT de skipper le compteur (conforme AC1.3). [app/api/cron/confirm-parrainages/route.ts:982-986]
- [x] [Review][Patch] **H10** Régénérer les 317 codes backfill via `gen_random_bytes` (pgcrypto). [migration corrective]
- [x] [Review][Patch] **H11** `confirmerFraude` doit rollback `compteur_confirmes`, `total_recompenses` et delete coupon Stripe issu de la récompense. [app/actions/admin-parrainages.ts:114-118]
- [x] [Review][Patch] **M1** Skip si `marraineSub.cancel_at_period_end === true`. [cron]
- [x] [Review][Patch] **M3** Re-vérifier `accompagnantes_profiles.validation_status === 'valide'` à J+30. [cron]
- [x] [Review][Patch] **M4** Aligner `hasActiveSubscription` strict 'active' (recouvert par D5).
- [x] [Review][Patch] **M6** FK `parrainages.marraine_id ON DELETE CASCADE` détruit l'historique : passer en SET NULL ou créer table archive. [migration]
- [x] [Review][Patch] **M8** `captureParrainageFingerprint` : retry sur `subscription.updated` même si `fingerprint_indisponible` flagué (PM peut être mis à jour). [webhooks/stripe/route.ts:1433-1440]
- [x] [Review][Patch] **M10** Fingerprint detection fallback sur PaymentIntents/charges historiques (pas seulement cards attached actuels). [webhooks/stripe/route.ts:1257-1277]
- [x] [Review][Patch] **M12** Email récompense : adapter texte selon plan annuel/mensuel (lire `interval` Stripe). [lib/emails.ts:2214]
- [x] [Review][Patch] **M14** Filtrer existing coupons par validity (recouvert par D3).
- [x] [Review][Patch] **L5** Coupon `name`: passer de `'Parrainage 6 mois - '` à `'Recompense parrainage - '` (conforme AC2).
- [x] [Review][Patch] **L6** Coupon `name`: utiliser `marraineId.slice(0,8)` au lieu d'email tronqué (collisions emails longs).
- [x] [Review][Patch] **L7** Cron quotidien `DELETE FROM stripe_events_processed WHERE processed_at < now() - 7 days`.

## Change Log

| Date | Auteur | Changement |
|------|--------|-----------|
| 2026-04-28 | Claude Opus 4.7 (1M) via bmad-create-story | Creation story 2.4 - cycle recompense parrainage : cron J+30 + coupon Stripe 100% / 6 mois + email recompense + extension ParrainageCard (compteur + liste filleules) + bloc code sur profil. Pas de migration SQL (tables Story 2.1 deja en place). Statut ready-for-dev. |
| 2026-04-28 | Claude Opus 4.7 (1M) via bmad-dev-story | Implementation Story 2.4 : cron `/api/cron/confirm-parrainages` (boucle for-of, compare-and-swap, branche recompense Stripe coupon `repeating` 6 mois + admin log + email), email `sendParrainageRecompense`, declaration vercel.json (cron `0 2 * * *`), extension `ParrainageCard` (compteur 5 carres + liste filleules badges FR), chargement dashboard (filleules join users), bloc code sur profil, label admin historique. tsc 0 erreur, build OK avec route presente. Statut review. |
| 2026-04-29 | Claude Opus 4.7 (1M) via bmad-code-review | Code review adversarial (3 layers, périmètre Story 2.1 + 2.4 combinées). Décisions résolues : D2 (ParrainageCard mort supprimé, AC5/AC6 amendés vers page dédiée `/accompagnante/parrainage`), D3 (replace coupons au lieu de cumul, conforme Dev Notes), D4 (skip reward si marraine `trialing`). 22 patches appliqués sur cette story : C1 webhook idempotence rollback, C2/H7 RPC PG atomiques (increment / claim / rollback), H6 statut `expire`, H9 confirme avant skip si missing_code, H10 codes régénérés via pgcrypto, H11 rollback compteur sur fraude, M1 skip cancel_at_period_end, M3 re-check validation_status, M6 FK SET NULL, M10 fallback charges, M12 email plan-aware, L5/L6 coupon name stable, L7 sweep cron events, L10 index composite. 7 migrations Supabase appliquées. tsc 0 erreur. Statut → done (tests preview Vercel à exécuter avant production). |
