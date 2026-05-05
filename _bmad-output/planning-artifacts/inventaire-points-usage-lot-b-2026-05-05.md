# Inventaire des points d'usage — Lot B accessibilite

**Date** : 2026-05-05
**Auteur** : cadrage Lot B (post-retro mini-epic 2.5)
**Objet** : decompte exhaustif des fichiers a toucher par story candidate Lot B, **avant** figeage des estimations dans `tech-spec-lot-b-a11y.md`.
**Justification** : Action item AI-2 retrospective Lot A — eviter les derives 2.5.2 (+60 %) et 2.5.5 (+33 %) qui resultaient d'un sous-cadrage des points d'usage. Cet inventaire a valeur contractuelle pour le tech-spec.
**Methode** : `grep` cible sur la branche `main` au commit courant (post-merge 2.5.6, baseline lint 158).

---

## 1. Synthese par story candidate

| ID candidate | Titre court | Fichiers a toucher | Pattern de risque | Effort affine |
|---|---|---|---|---|
| **2.6.1** | Outillage axe-core/Playwright (S0) | 9 fichiers crees + 4 edites | Story d'outillage, pas d'UI — risque maitrise | 0,75 j |
| **2.6.2** | Messagerie a11y (`role="log"`, `aria-live`) | 1 composant central + 2 boutons contact | Composant dynamique realtime — **complexite ARIA elevee** | 1 j |
| **2.6.3** | Onboarding aux : progressbar + focus + erreurs | 1 composant client + 4 sub-steps | Modification structurelle multi-fichiers — risque +30 % deja paye Lot A 2.5.2 | 1 j |
| **2.6.4** | Erreurs inline `role="alert"` (audit blocs rouges) | 23 fichiers porteurs de blocs erreur | **Multi-fichiers massif** — risque +30 % | 1 j |
| **2.6.5** | Carte hero : alternative textuelle | 1 fichier (`hero-carte.tsx`) | Story isolee sure | 0,25 j |
| **2.6.6** | Audit Leaflet + alternative clavier | 2 composants Leaflet + 5 usagers | Composant tiers — risque inconnu, **time-box** | 1 j |
| **2.6.7-A** | h1 — pages publiques + auth | 10 pages a corriger (sur ~14 zone) | Multi-fichiers — zone homogene | 0,5 j |
| **2.6.7-B** | h1 — dashboards accompagnante/accompagne | 11 pages a corriger (sur 13 zone) | Multi-fichiers — zone homogene | 0,5 j |
| **2.6.7-C** | h1 — pages admin | 11 pages a corriger (sur 12 zone) | Multi-fichiers — structure repetitive | 0,25 j |

**Total Lot B : 10 stories, 6,25 j-dev** — vs estimation NFR 5-7 j-dev, en haut de fourchette. Marge +10 % integree par rapport aux derives Lot A.

**Decisions Project Lead 2026-05-05 entrinees** :
- Story 2.6.5 : texte adjacent **visible** (pas `sr-only`). La carte est centrale a la landing, l'information de couverture geographique a une valeur pour tous.
- Story 2.6.7 **decoupee en 3 sous-stories** par zone fonctionnelle plutot qu'en story unique. Justification : 27 pages d'un bloc presente le profil de derive 2.5.2/2.5.5 (multi-fichiers structurel sous-cadre). Les 3 zones sont independantes, testables, mergeables independamment.

---

## 2. Detail story par story

### 2.6.1 — Outillage axe-core/Playwright

**Cible NFR** : E2 (test automatise), AI-1 retro Lot A.

**Fichiers a creer (9)** :
- `playwright.config.ts`
- `tests/a11y/lib/run-axe.ts`
- `tests/a11y/lib/auth-stub.md`
- `tests/a11y/p1-onboarding-aux.spec.ts`
- `tests/a11y/p2-recherche.spec.ts`
- `tests/a11y/p3-messagerie.spec.ts`
- `tests/a11y/p4-inscription-checkout.spec.ts`
- `tests/a11y/p5-landing.spec.ts`
- `tests/a11y/p6-suppression-rgpd.spec.ts`
- `tests/a11y/README.md`
- `scripts/build-axe-baseline.mjs`
- `scripts/check-axe-baseline.mjs`
- `_bmad-output/test-artifacts/axe-core-baseline-2026-05-XX.json`

**Fichiers a editer (4)** : `package.json`, `.gitignore`, `.claude/skills/bmad-create-story/template.md`, `CLAUDE.md`.

**Risque dominant** : execution Playwright en build Vercel (R1). Mitigation : repli local pre-merge documente.

**Effort affine** : 0,75 j (cf. story 2.6.1 redigee).

---

### 2.6.2 — Messagerie a11y

**Cible NFR** : D3 (regions live), B3 (clavier), C2 (erreurs annoncees).

**Fichiers a toucher (3)** :
- `components/messages/chat-window.tsx` — refonte centrale : `role="log"`, `aria-live="polite"`, label sur `<textarea>` (actuellement sans label visible ni aria-label), bouton envoyer sans `aria-label` (juste icone SVG), zone messages sans landmark.
- `components/messages/contact-button.tsx` — verifier focus + ARIA bouton trigger conversation.
- `components/messages/contact-accompagne-button.tsx` — idem.

**Pages porteuses** (lecture seule, pas d'edition prevue) : `app/messages/page.tsx`, `app/messages/[id]/page.tsx`, `app/admin/messages/page.tsx`, `app/admin/messages/[id]/page.tsx`.

**Pattern de risque** : composant realtime avec optimistic updates + Supabase channel. Annonces `aria-live` doivent etre coordonnees avec l'optimistic update (eviter double-annonce). **Story candidate pour Edge Case Hunter** si retro Lot A reactivee sur ce point.

**Effort affine** : 1 j (vs estimation initiale ~1 j NFR — alignee).

**Decisions a figer dans tech-spec** :
- `aria-live="polite"` (pas `assertive`) pour ne pas couper l'utilisateur en train de taper.
- `role="log"` sur le conteneur scrollable (pattern WAI-ARIA log).
- `<textarea>` recevra un `<label>` masque visuellement (`sr-only`) ou un `aria-label="Ecrire un message a {otherUserName}"`.
- Bouton envoyer : `aria-label="Envoyer le message"` + verifier focus apres send (deja partiellement fait via `inputRef.current?.focus()`).

---

### 2.6.3 — Onboarding aux : progressbar + focus + erreurs

**Cible NFR** : D2 (progressbar), B3 (focus inter-etapes), C2 (erreurs annoncees).

**Fichiers a toucher (5)** :
- `components/accompagnante/onboarding-client.tsx` — central :
  - Progress bar actuelle : 4 `<div>` simples (lignes ~140-155). A transformer en `role="progressbar"` ou structure semantique avec `aria-valuenow`, `aria-valuemax`, `aria-valuetext`.
  - Bloc erreur ligne ~168 : `<div className="...bg-red-50...">{error}</div>` sans `role="alert"` ni `aria-live`. A passer en `role="alert"`.
  - Changement d'etape : `setStep((s) => s + 1)` sans gestion focus. **Critique B3** : focus doit se deplacer sur l'h2 / heading de l'etape suivante apres clic « Suivant ».
- `components/accompagnante/step-diplome.tsx` — verifier presence d'un heading focusable (h2 + tabIndex=-1) au sommet.
- `components/accompagnante/step-specialites.tsx` — idem.
- `components/accompagnante/step-localisation.tsx` — idem.
- `components/accompagnante/step-disponibilites.tsx` — idem.

**Pattern de risque** : modification structurelle multi-fichiers — exactement le pattern derivee Lot A 2.5.2 (+60 %). Mitigation : etape 0 du tech-spec figera la convention « heading focusable au sommet de chaque step » avant decoupage.

**Effort affine** : 1 j (vs ~0,75 j naïf — marge +33 % integree).

**Decisions a figer dans tech-spec** :
- Pattern « heading focusable » : chaque sub-step expose un `<h2 tabIndex={-1} ref={headingRef}>` que le parent focuse au changement.
- Le conteneur `onboarding-client` recoit le `headingRef` via callback.
- Progress bar : adopter `role="progressbar" aria-valuenow={step+1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuetext={STEPS[step]}` sur le conteneur des barres.

---

### 2.6.4 — Erreurs inline `role="alert"` (audit blocs rouges)

**Cible NFR** : C2 (erreurs annoncees globalement, pas seulement dans Input).

**Fichiers a toucher (23 — decompte exhaustif)** :

Composants (17) :
- `components/auth/register-form.tsx`
- `components/admin/delete-user-button.tsx`
- `components/admin/validation-actions.tsx`
- `components/admin/departements-manager.tsx`
- `components/admin/annonce-actions.tsx`
- `components/annonce-delete-button.tsx`
- `components/recherche/favori-button.tsx`
- `components/accompagnante/profile-form.tsx`
- `components/accompagnante/onboarding-client.tsx` (deja prevu en 2.6.3, factoriser)
- `components/accompagnante/nouvelle-annonce-form.tsx`
- `components/accompagnante/status-badge.tsx`
- `components/accompagnante/modifier-annonce-form.tsx`
- `components/accompagne/profile-form.tsx`
- `components/accompagne/nouvelle-annonce-form.tsx`
- `components/accompagne/modifier-annonce-form.tsx`
- `components/contact-form.tsx`
- `components/signalement-button.tsx`

Pages (6) :
- `app/admin/utilisateurs/[id]/page.tsx`
- `app/forgot-password/page.tsx`
- `app/accompagnante/profil/page.tsx`
- `app/accompagnante/dashboard/page.tsx`
- `app/reset-password/page.tsx`
- `app/login/page.tsx`

**Pattern de risque** : multi-fichiers massif — pattern derive Lot A 2.5.2 et 2.5.5. **Critique** : la modification est mecanique (ajout `role="alert"` sur conteneur erreur) mais **le decompte de 23 fichiers** confirme que l'estimation initiale 0,5 j etait sous-cadree.

**Effort affine** : 1 j (mecanique mais volume — inclure validation par grep `grep -r "role=\"alert\"" | wc -l` >= 23).

**Decision a figer dans tech-spec** :
- Aucun systeme toast central a creer (pas de Sonner/shadcn-toast en place, audit confirme). On reste sur le pattern « bloc erreur inline », auquel on ajoute `role="alert"` + condition d'apparition (le `role="alert"` sur element initialement absent du DOM est annonce a son insertion).
- **Pas de nouveau composant `<ErrorAlert>`** : trop de churn vs marginal benefit. La consigne est mecanique.

---

### 2.6.5 — Carte hero : alternative textuelle

**Cible NFR** : A3 (alternatives textuelles).

**Fichiers a toucher (1)** :
- `components/landing/hero-carte.tsx` — actuellement `aria-hidden="true"` + animations infinies. Le Lot A 2.5.4 a deja conditionne les animations `prefers-reduced-motion`. Reste a ajouter un equivalent textuel adjacent (visuellement masque ou texte affiche selon decision design).

**Pattern de risque** : story isolee, faible risque.

**Effort affine** : 0,25 j (alignee avec estimation initiale).

**Decision Project Lead 2026-05-05** : texte adjacent **visible** (pas `sr-only`). La carte est centrale a la landing page et l'information de couverture geographique a une valeur pour tous les utilisateurs, pas seulement les utilisateurs de lecteur d'ecran. Format suggere : sous-titre court ou liste de villes principales adjacent au SVG (ex. « Notre service couvre les principales villes de Bretagne : Rennes, Brest, Lorient, Vannes, Saint-Brieuc, Quimper. »). Forme finale a affiner au moment de la story.

---

### 2.6.6 — Audit Leaflet et alternative clavier

**Cible NFR** : D4 (composants tiers).

**Fichiers a toucher (2 + 5 usagers)** :
- `components/ui/map-radius-inner.tsx` — composant Leaflet avec `<input>` natifs (2 occurrences relevees).
- `components/ui/map-radius.tsx` — wrapper geocoding (logique fetch).
- Usagers (5) — verifier que la a11y du composant se propage correctement :
  - `components/accompagnante/profile-form.tsx`
  - `components/accompagnante/nouvelle-annonce-form.tsx`
  - `components/accompagnante/step-localisation.tsx`
  - `components/accompagnante/modifier-annonce-form.tsx`
  - `components/accompagne/nouvelle-annonce-form.tsx`

**Pattern de risque** : composant tiers, risque inconnu. Time-box stricte 1 j.

**Effort affine** : 1 j.

**Decisions a figer dans tech-spec** :
- Strategie **2 niveaux** :
  1. La carte recoit un `aria-label="Carte de la zone d'intervention"` et reste interactive a la souris/touch.
  2. Une alternative clavier non-visuelle (champ « Rayon en km » + ville saisie) est deja presente dans le formulaire — **a confirmer comme equivalent fonctionnel** lors de l'audit.
- Si l'audit revele que Leaflet pose des problemes de focus piege ou d'annonce ARIA polluante, retomber sur `aria-hidden` + alternative textuelle (« Carte indicative — utilisez les champs de localisation ci-dessus pour ajuster »).
- **Hors scope** : refonte complete d'accessibilite Leaflet (reportee Lot C si necessaire).

---

### 2.6.7 — Landmarks et hierarchie h1

**Cible NFR** : D1 (semantique HTML).

**Fichiers a toucher (~27 pages sans h1, ~36 pages totales)** :

Pages **avec h1 deja present** (9, lecture seule pour validation) :
- `app/not-found.tsx`, `app/page.tsx`, `app/politique-de-confidentialite/page.tsx`, `app/admin/departements/page.tsx`, `app/cgu/page.tsx`, `app/mentions-legales/page.tsx`, `app/accompagnante/parrainage/page.tsx`, `app/accompagnante/abonnement/success/page.tsx`, `app/accompagne/abonnement/success/page.tsx`.

Pages **sans h1** (~27, a auditer et corriger) :
- `app/messages/page.tsx`, `app/favoris/page.tsx`, `app/admin/page.tsx`, `app/recherche/page.tsx`, `app/register/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `app/login/page.tsx`, `app/messages/[id]/page.tsx`, `app/accompagnante/profil/page.tsx`, `app/accompagnante/dashboard/page.tsx`, `app/accompagnante/annonces/page.tsx`, `app/accompagnante/abonnement/page.tsx`, `app/accompagnante/onboarding/page.tsx`, `app/accompagne/profil/page.tsx`, `app/accompagne/dashboard/page.tsx`, `app/accompagne/annonces/page.tsx`, `app/accompagne/abonnement/page.tsx`, `app/admin/historique/page.tsx`, `app/admin/messages/page.tsx`, `app/admin/parrainages/page.tsx`, `app/admin/annonces/page.tsx`, `app/admin/signalements/page.tsx`, `app/admin/utilisateurs/page.tsx`, `app/recherche/demandes/page.tsx`, `app/recherche/[id]/page.tsx`, `app/admin/utilisateurs/[id]/page.tsx`, `app/admin/messages/[id]/page.tsx`, `app/admin/parrainages/blacklist/page.tsx`, `app/admin/validation/[id]/page.tsx`, `app/accompagnante/annonces/nouvelle/page.tsx`, `app/accompagne/annonces/nouvelle/page.tsx`.

**Pattern de risque** : multi-fichiers massif — **plus gros volume du Lot B**. Pattern derive 2.5.2/2.5.5 garanti si pas anticipe.

**Effort affine** : 1,25 j (vs ~0,75 j naïf — marge +66 % integree compte tenu du volume).

**Decisions Project Lead 2026-05-05** :
- Convention : chaque page a **un et un seul** `<h1>` au sommet de son contenu. Le titre du header (lien `roxanetnous`) reste un `<Link>` non-heading.
- Pour les pages dashboard, le h1 peut etre visuellement discret (sr-only-like) si le design l'exige, mais **doit exister structurellement**.
- Verification CI : assertion axe-core sur la presence d'un h1 unique (regle `page-has-heading-one`), couverte par 2.6.1.
- **Decoupage retenu en 3 sous-stories par zone fonctionnelle** (au lieu d'une story unique sur 27 pages). Justification : 27 pages d'un bloc presente le profil de derive 2.5.2/2.5.5 (multi-fichiers structurel sous-cadre). Trois zones homogenes restent testables et mergeables independamment, avec verification axe-core par lot. Total effort inchange (1,25 j cumule).

**Sous-decoupage actif (3 sous-stories independantes)** :

| Sous-story | Zone | Pages a corriger | Effort |
|---|---|---|---|
| **2.6.7-A** | Pages publiques + auth | 10 (messages x2, favoris, recherche x3, register, login, forgot-password, reset-password) | 0,5 j |
| **2.6.7-B** | Dashboards accompagnante/accompagne | 11 (profil x2, dashboard x2, annonces x4, abonnement x2, onboarding) | 0,5 j |
| **2.6.7-C** | Pages admin | 11 (admin root, historique, messages x2, parrainages x2, annonces, signalements, utilisateurs x2, validation) | 0,25 j |

Les 3 sous-stories peuvent etre faites dans n'importe quel ordre relatif. Independantes au merge — pas de fichier partage entre zones. La 2.6.7-C inclut un bilan global axe-core en cloture du Lot B (cf. tech-spec).

---

## 3. Stories ecartees du Lot B (justification)

### Toasts globaux `role="alert"`

**Mention** : NFR §5.2 « toasts en `aria-live` ».

**Decision** : ecarter du Lot B. Aucun systeme toast (Sonner, shadcn-toast, react-hot-toast) n'est installe ; les notifications passent toutes par des blocs erreur inline. La couverture de C2 est assuree par story 2.6.4 (audit blocs rouges). Si un toast est introduit ulterieurement (story metier), la DoD a11y bloquera.

### Audit complet de tous les formulaires (au sens « association labels restants »)

**Mention** : NFR §5.2 « audit complet des formulaires ».

**Decision** : la propagation `Input` 2.5.5 du Lot A a deja fait disparaitre les violations `jsx-a11y/label-has-for` dans les composants utilisant `<Input>` partage. Reste a auditer les **27 fichiers utilisant des champs natifs `<input>/<select>/<textarea>` directement** (decompte fait section 1).

Mais ce travail est **mecanique** (refactor pour passer par `<Input>` ou ajout direct d'`htmlFor`) et tres dependant des choix design fichier par fichier. **Decision** : ne pas creer de story dediee « audit complet formulaires » dans Lot B. Garde-fou herite Lot A : l'ESLint a11y bloque toute nouvelle violation. Le comblement progressif se fait au fil des stories metier qui touchent ces fichiers (DoD a11y oblige a regenerer le baseline a la baisse a chaque story).

**Si une story dediee s'impose**, elle est reportee au Lot C (story « ramener baseline a 0 » avant bascule `warn` -> `error`).

### Page `/accessibilite` publique

**Decision** : NFR §5.4 — Lot C explicite.

---

## 4. Synthese des effets de bord identifies

| Effet | Story candidate touchee | Mitigation |
|---|---|---|
| Modification `chat-window.tsx` peut interferer avec realtime Supabase | 2.6.2 | Test manuel realtime avant merge ; pas de modification de la logique d'optimistic update |
| `role="alert"` sur 23 fichiers peut introduire des annonces redondantes si l'utilisateur clique 2 fois | 2.6.4 | Mecanique simple ; convention `aria-live="polite"` (pas `assertive`) pour les blocs erreurs longuement affiches |
| Heading focusable inter-etapes peut casser le flux clavier si mal place | 2.6.3 | Convention `tabIndex={-1}` strict + tests manuels VoiceOver |
| Ajout massif de h1 peut deplacer la hierarchie SEO | 2.6.7 | Verifier impact sur `metadata.title` Next ; le h1 peut differer de la title meta sans probleme |

---

## 5. Conclusion

**10 stories Lot B identifiees, 6,25 j-dev** :

| ID | Story | Effort |
|---|---|---|
| 2.6.1 | Outillage axe-core/Playwright | 0,75 |
| 2.6.2 | Messagerie a11y | 1,0 |
| 2.6.3 | Onboarding aux progressbar/focus | 1,0 |
| 2.6.4 | Erreurs inline `role="alert"` | 1,0 |
| 2.6.5 | Carte hero alternative textuelle (visible) | 0,25 |
| 2.6.6 | Audit Leaflet | 1,0 |
| 2.6.7-A | h1 — pages publiques + auth (10 pages) | 0,5 |
| 2.6.7-B | h1 — dashboards accompagnante/accompagne (11 pages) | 0,5 |
| 2.6.7-C | h1 — pages admin (11 pages) + bilan cloture Lot B | 0,25 |

**Coherent avec NFR PRD (5-7 j-dev)**. Marge +10-15 % integree par rapport aux derives Lot A (3,25 -> 3,5 j-dev, +8 %).

**Sequencement recommande pour le tech-spec** :
1. **2.6.1** strictement en premier (bloquante, peut demarrer en parallele du tech-spec global).
2. **2.6.5** + **2.6.4** apres 2.6.1 (mecaniques, sans interference).
3. **2.6.2** seule (criticite cœur produit, demande attention dediee).
4. **2.6.3** seule (modif structurelle multi-fichiers).
5. **2.6.6** time-boxee.
6. **2.6.7-A**, **2.6.7-B**, **2.6.7-C** en cloture (volume reparti par zone, garanti par le scaffolding axe-core de 2.6.1, ordre relatif libre car independantes au merge).

**Pre-requis bascule warn -> error sur ESLint a11y** : ce serait premature — bascule reportee a fin Lot C apres baseline a 0.
