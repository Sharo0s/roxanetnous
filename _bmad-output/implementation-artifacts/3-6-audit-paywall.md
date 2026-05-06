# Audit soft paywall - Story 3.6

**Date :** 2026-05-07
**Auteur :** dev agent (BMad)
**Story origine :** [3-6-audit-soft-paywall-et-corrections-d-alignement-code-prd.md](./3-6-audit-soft-paywall-et-corrections-d-alignement-code-prd.md)
**Reference :** [DECISIONS.md#2026-05-06 - Soft paywall](../../DECISIONS.md), PRD FR16/FR27

---

## Section 1 - Matrice canonique (DECISIONS A 2026-05-06)

Reproduite integralement depuis `DECISIONS.md:62-90` pour reference executable.

| Action | Visiteur non connecte | Connecte sans abonnement | Abonne actif |
|---|---|---|---|
| Voir landing page | OK | OK | OK |
| Recherche + filtres | OK | OK | OK |
| Voir un profil auxiliaire | OK | OK | OK |
| Voir favoris | login requis | OK | OK |
| Ajouter aux favoris | login requis | OK | OK |
| **Envoyer un message** | login requis | **paywall** | OK |
| **Publier annonce auxiliaire** | login requis | **paywall** | OK |
| Pages legales (CGU, RGPD, accessibilite) | OK | OK | OK |

**Regle DECISIONS A** : « Ne jamais ajouter d'enforcement bloquant sur la lecture. Ne jamais retirer l'enforcement existant sur l'envoi de message ni la publication d'annonce auxiliaire. »

**Implication implicite (deduite + ratifiee dans cette story)** : la matrice cite explicitement « Envoyer un message » et « Publier annonce auxiliaire ». Par homogeneite et sur la base de FR27 (« Deux utilisateurs **abonnes** peuvent echanger des messages »), on etend le paywall aux **ouvertures de conversation** (initiation de mise en relation = action de mise en relation par excellence) et a la **publication d'annonce beneficiaire** (deja paywallee dans le code, conservee).

---

## Section 2 - Inventaire call sites `hasActiveSubscription`

Resultat brut `grep -rn "hasActiveSubscription" app/ lib/ components/` execute le 2026-05-07.

| # | Fichier:ligne | Fonction parent | Decision audit |
|---|---|---|---|
| 1 | `lib/subscription-helpers.ts:39` | `export async function hasActiveSubscription` | Helper canonique. **Conserver tel quel** (D7 story 3.6). |
| 2 | `app/actions/annonces.ts:5` | import | Import du helper. Conserver. |
| 3 | `app/actions/annonces.ts:39` | `createAnnonceAccompagnante` | Check pre-INSERT. **Conserver** (paywall publication annonce auxiliaire = matrice canonique). |
| 4 | `app/actions/annonces.ts:220` | `createAnnonceAccompagne` | Check pre-INSERT. **Conserver** (paywall publication annonce beneficiaire = etendu par homogeneite + FR27 implicite, deja en place). |
| 5 | `app/accompagnante/annonces/page.tsx:6` | import | Import. Conserver. |
| 6 | `app/accompagnante/annonces/page.tsx:32` | Render Server Component | Flag UI uniquement (`subscribed` conditionne CTA « Nouvelle annonce »). **Conserver** (UX, pas blocage). |
| 7 | `app/api/cron/confirm-parrainages/route.ts:4` | import | Import (cron). Conserver, hors scope. |
| 8 | `app/api/cron/confirm-parrainages/route.ts:48` | `confirmParrainages` (cron) | Check eligibilite recompense parrainage. **Conserver, hors scope**. |
| 9 | `app/actions/parrainage.ts:381` | commentaire | Commentaire en reference (asymetrie corrigee). Aucun appel. Conserver. |

**Resume avant story 3.6** : 4 call sites applicatifs (3 + 1 cron) + 1 helper. **Aucun** dans `app/actions/messages.ts` malgre FR27. C'est l'**ecart principal** corrige par cette story.

**Apres story 3.6, call sites ajoutes** :
- `app/actions/messages.ts:sendMessage` (paywall envoi message, conditionne par D1 admin skip).
- `app/actions/messages.ts:getOrCreateConversation` (paywall ouverture conversation cote beneficiaire, conditionne par D3 idempotence).
- `app/actions/messages.ts:getOrCreateConversationAsAccompagnante` (paywall ouverture conversation cote auxiliaire, conditionne par D3 idempotence).

**Total cible apres story 3.6** : 7 call sites applicatifs (+1 cron + 1 helper). Aucune nouvelle fonction helper transversale (D2 ratifie : pas de wrapper `requireSubscription`).

---

## Section 3 - Audit action par action (mise en relation)

Une ligne par action de mise en relation listee en AC2-AC6.

### 3.1 - Envoi message (`app/actions/messages.ts:sendMessage`)

| Element | Etat avant story 3.6 | Decision audit | Etat apres story 3.6 |
|---|---|---|---|
| Check `hasActiveSubscription` | **NON present** (l. 183-280) | **Ajouter** (FR27 + matrice canonique) | Check ajoute apres membership, avant INSERT message. Skip si `adminUserId !== null` (D1) ou si sender est admin (`isAdmin === true`). |
| Erreur retournee | (n/a) | `'Abonnement requis pour envoyer un message.'` | OK |
| Test manuel a planifier | (n/a) | AC2.a / AC2.b / AC2.c | Documente Section 5 |

**Decision** : ajouter check.

### 3.2 - Ouverture conversation cote beneficiaire (`getOrCreateConversation`)

| Element | Etat avant story 3.6 | Decision audit | Etat apres story 3.6 |
|---|---|---|---|
| Check `hasActiveSubscription` | **NON present** (l. 12-77) | **Ajouter, mais APRES check existence** (D3 idempotence) | Check ajoute uniquement avant INSERT (apres `existing` null) |
| Idempotence preservee | n/a | Si conversation existe : retour sans paywall | OK (l. 58-60 inchange) |
| Erreur retournee | (n/a) | `'Abonnement requis pour contacter une accompagnante.'` | OK |
| Test manuel | (n/a) | AC3 | Documente Section 5 |

**Decision** : ajouter check apres check existence.

### 3.3 - Ouverture conversation cote auxiliaire (`getOrCreateConversationAsAccompagnante`)

Symetrique 3.2.

| Element | Etat avant story 3.6 | Decision audit | Etat apres story 3.6 |
|---|---|---|---|
| Check `hasActiveSubscription` | **NON present** (l. 79-134) | **Ajouter** (symetrique 3.2) | Check ajoute apres `existing` null, avant INSERT |
| Erreur retournee | (n/a) | `'Abonnement requis pour contacter un beneficiaire.'` | OK |
| Test manuel | (n/a) | AC4 | Documente Section 5 |

**Decision** : ajouter check apres check existence.

### 3.4 - Conversation admin (`getOrCreateAdminConversation`)

| Element | Etat avant story 3.6 | Decision audit | Etat apres story 3.6 |
|---|---|---|---|
| Check `hasActiveSubscription` | **NON present** (l. 136-181) | **Conserver sans check** (AC5) | Inchange |
| Justification | n/a | Admin = staff, hors modele commercial. Cf. DECISIONS A implicite + AC5 story 3.6. | Documente |

**Decision** : conserver sans check.

### 3.5 - Publication annonce auxiliaire (`createAnnonceAccompagnante`)

Deja paywallee (l. 39). **Conserver**.

### 3.6 - Modification annonce auxiliaire (`updateAnnonceAccompagnante`)

| Element | Etat avant story 3.6 | Decision audit | Etat apres story 3.6 |
|---|---|---|---|
| Check `hasActiveSubscription` | **NON present** (l. 98-145) | **Ajouter** (D5 : modification = mise en relation continue) | Check ajoute apres profil, avant UPDATE |
| Erreur retournee | (n/a) | `'Un abonnement actif est requis pour modifier une annonce.'` | OK |

**Decision** : ajouter check (D5).

### 3.7 - Toggle statut annonce auxiliaire (`updateAnnonceAccompagnanteStatus`)

| Element | Etat avant story 3.6 | Decision audit | Etat apres story 3.6 |
|---|---|---|---|
| Check `hasActiveSubscription` | **NON present** (l. 148-180) | **Ajouter conditionnellement** (D5 asymetrie) | Check ajoute uniquement quand `status === 'publiee'` (re-publication implicite). Pas de check sur archivage (`'archivee'`). |
| Justification | n/a | Reactivation `archivee -> publiee` = republication = mise en relation. Desactivation `publiee -> archivee` = retrait, droit utilisateur. | Documente |

**Decision** : ajouter check uniquement sur `status === 'publiee'`.

### 3.8 - Publication annonce beneficiaire (`createAnnonceAccompagne`)

Deja paywallee (l. 220). **Conserver**.

### 3.9 - Modification annonce beneficiaire (`updateAnnonceAccompagne`)

Symetrique 3.6. **Decision** : ajouter check (D5).

### 3.10 - Suppression annonce auxiliaire (`deleteAnnonceAccompagnante`)

| Element | Etat avant story 3.6 | Decision audit | Etat apres story 3.6 |
|---|---|---|---|
| Check `hasActiveSubscription` | **NON present** (l. 378-404) | **Conserver sans check** (D4 : retrait = droit RGPD) | Inchange |
| Justification | n/a | Suppression != mise en relation. Utilisateur conserve droit de retrait independamment de son statut abonnement. | Documente |

**Decision** : pas de check (D4).

### 3.11 - Suppression annonce beneficiaire (`deleteAnnonceAccompagne`)

Symetrique 3.10. **Decision** : pas de check (D4).

### 3.12 - Toggle statut annonce beneficiaire (`updateAnnonceAccompagneStatus`)

Symetrique 3.7. **Decision** : ajouter check uniquement sur `status === 'publiee'` (D5 asymetrie).

---

## Section 4 - Audit pages lecture (sans paywall bloquant)

Verification que les pages de lecture restent libres conformement a DECISIONS A.

| Route | Grep `hasActiveSubscription` | Decision | Conforme matrice |
|---|---|---|---|
| `/recherche` | 0 occurrence | Lecture libre | OUI |
| `/recherche/[id]` | 0 occurrence | Lecture libre | OUI |
| `/recherche/demandes` | 0 occurrence | Lecture libre | OUI |
| `/messages` | 0 occurrence | Lecture libre (liste) | OUI |
| `/messages/[id]` | 0 occurrence | Lecture libre (historique conversation) | OUI |
| `/favoris` | 0 occurrence | Lecture libre | OUI |
| `/abonnement` | 0 occurrence | Page de souscription, pas de paywall lecteur | OUI |
| `/accompagnante/annonces` | 1 occurrence (l. 32) **flag UI** | Conserver : la page est lisible meme sans abonnement, le flag conditionne uniquement le CTA « Nouvelle annonce » (UX). | OUI (AC8) |

**Conclusion Section 4** : alignement deja correct sur les pages lecture. **Aucune correction code requise**. La seule occurrence sur `/accompagnante/annonces` est un usage UI (flag), pas un blocage.

---

## Section 5 - Conclusion + plan tests manuels

### 5.1 - Bilan ecarts

| Categorie | Avant story 3.6 | Corrige par story 3.6 | Accepte (non bloquant) | Requalifie |
|---|---|---|---|---|
| Mise en relation (envoi message) | 1 ecart (`sendMessage`) | 1 | 0 | 0 |
| Mise en relation (ouverture conv) | 2 ecarts (cote beneficiaire + cote auxiliaire) | 2 | 0 | 0 |
| Modification annonce | 2 ecarts (`updateAnnonceAccompagnante`, `updateAnnonceAccompagne`) | 2 | 0 | 0 |
| Toggle statut annonce | 2 ecarts (`updateAnnonceAccompagnanteStatus`, `updateAnnonceAccompagneStatus`) | 2 (paywall sur `'publiee'` uniquement) | 0 | 0 |
| Suppression annonce | 0 (decision D4 = pas de paywall) | 0 | 2 (deletes acceptes sans paywall, justification RGPD) | 0 |
| Conversation admin | 0 (AC5 = inchange) | 0 | 1 (admin hors modele commercial) | 0 |
| Lecture pages | 0 (alignement deja correct) | 0 | 1 (`/accompagnante/annonces` flag UI) | 0 |
| **Total** | **7 ecarts trouves** | **7 corriges** | **4 acceptes documentes** | **0** |

**Verdict global** : **MATRICE A 2026-05-06 RESPECTEE** apres livraison story 3.6.

### 5.2 - Plan tests manuels (AC17)

Tests **a executer en environnement local ou staging**. Documentes ici, **execution effective reportee** Epic 4 selon convention projet (cf. `epic-3.md - dette tests`).

| # | Test | AC couvert | Procedure | Resultat attendu |
|---|---|---|---|---|
| (a) | sendMessage non abonne | AC2.a | User connecte non abonne ouvre conversation existante (pre-3.6 valide) puis tape message + clic envoi | `{ error: 'Abonnement requis pour envoyer un message.' }`. BDD `messages` non mutee. |
| (b) | sendMessage abonne actif | AC2.b | User abonne actif idem | Message inserte. |
| (c) | sendMessage admin | AC2.c | Admin envoie depuis conversation `admin_id` non null | Message inserte (skip D1). |
| (d) | getOrCreateConversation beneficiaire non abonne, nouvelle | AC3 | Beneficiaire non abonne clic « Envoyer un message » sur `/recherche/[id]` (annonce dont il n'a jamais contacte l'auxiliaire) | UI : bouton desactive + lien `/abonnement` (defense en profondeur). Bypass devtools : `{ error: 'Abonnement requis pour contacter une accompagnante.' }`. |
| (d') | getOrCreateConversation idempotence | AC3 | Beneficiaire dont l'abonnement vient d'expirer, mais qui avait deja une conversation ouverte avec cet auxiliaire avant | `{ conversationId }` retourne. **Pas** de `error` (D3 idempotence). |
| (e) | getOrCreateConversationAsAccompagnante non abonnee | AC4 | Auxiliaire non abonnee clic « Contacter » sur `/recherche/demandes` | UI : bouton desactive. Bypass : `{ error: 'Abonnement requis pour contacter un beneficiaire.' }`. |
| (f) | UI defense en profondeur contact-button | AC9 | User non abonne navigue `/recherche/[id]` | Bouton « Envoyer un message » : `disabled aria-disabled="true" aria-describedby` pointant vers message + lien `/abonnement` visible. Click bypass devtools : server action retourne erreur (cf. d). |
| (g) | UI defense en profondeur chat-window | AC10 | User non abonne ouvre conversation existante (D3) | Lecture historique OK. Textarea + bouton « Envoyer » : `disabled`. Message d'aide + lien `/abonnement` visible. Bypass : server action erreur (cf. a). |

**Procedure compte test** : reutiliser un compte test deja cree pour Story 3.5 ou creer ad-hoc dans Supabase (insertion directe `users` + `accompagnes_profiles` ou `accompagnantes_profiles` selon role, pas de row dans `subscriptions`).

### 5.3 - Bilan livrables

- **Code** : `app/actions/messages.ts` (3 fonctions modifiees), `app/actions/annonces.ts` (4 fonctions modifiees), 3 composants Client + 3 pages parentes pour la prop `subscribed` / `conversationHasAdmin`.
- **Documentation** : ce rapport `3-6-audit-paywall.md`.
- **DoD a11y** : check baseline 155 stable (lint), 0 violations Critical/Serious axe-core (re-run pre-commit).
- **Tests** : 7 tests manuels documentes, executions reportees Epic 4.

### 5.4 - References pour audit futur

- Ce rapport reste dans `_bmad-output/implementation-artifacts/` comme reference pour audits Epic 4.x ou retros.
- Si la matrice canonique evolue (DECISIONS B+), refaire ce grep + comparer aux call sites listes Section 2.
- En cas d'introduction d'une nouvelle action de mise en relation (ex : envoi visio), referencer cette story et le pattern `if (!isXxx) { const subscribed = await hasActiveSubscription(user.id); if (!subscribed) return { error: '...' } }`.
