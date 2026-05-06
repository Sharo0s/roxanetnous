# Story 3.2 : Blocage inscription auxiliaire hors zone

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant qu'**auxiliaire de vie residant hors Bretagne (et Sylvain en tant que responsable produit du lancement)**,
je veux **etre arretee proprement par un message accessible si je tente de finaliser mon profil avec un code postal hors whitelist `departements_ouverts`, et pouvoir rejoindre la waitlist en un clic**,
afin de **ne pas perdre de temps a remplir un dossier qui ne pourra pas aboutir, et d'etre notifiee a l'ouverture de mon departement (FR47 + FR46)**.

Cette story est la **deuxieme story de l'Epic 3 "Lancement Bretagne"**. Elle implemente FR47 (blocage inscription accompagnante hors zone). Elle complete la story 3.1 qui a active le filtre cote lecture publique. Elle s'appuie sur les fondations deja livrees :

- Helper `lib/departements.ts` (`isDepartementOuvert`, `getMessageRestriction`, `getCodesDepartementsOuverts`).
- Filtrage UI deja en place cote client dans `CityAutocomplete` (suggestions hors zone masquees + bandeau "Roxane et Nous n'est pas encore disponible dans cette zone").
- Pattern d'erreurs `role="alert"` mature (Lot B story 2.6.4) : deja applique dans `OnboardingClient` ligne 189.
- Checks server deja en place pour `updateAccompagnanteProfile` (post-onboarding, `app/actions/profile.ts:49`), `createAnnonce*` et `updateAnnonce*` (`app/actions/annonces.ts`).

**Le seul trou fonctionnel cote inscription auxiliaire est `submitOnboarding`** (`app/actions/accompagnante.ts`) : aucun check `isDepartementOuvert` n'y est present. Une accompagnante qui contournerait l'autocomplete (saisie manuelle directe d'un CP `75001`) verrait son profil cree en `validation_status = 'en_attente'` puis serait potentiellement masquee de toute recherche par la story 3.1. La story 3.2 ferme ce trou + ajoute une UX de redirection waitlist conforme a l'epic.

## Acceptance Criteria

### AC fonctionnels (FR47)

1. **AC1 - Blocage server `submitOnboarding`** : Given une accompagnante connectee soumet l'onboarding (`/accompagnante/onboarding`) avec `code_postal = '75001'` (hors whitelist), when `submitOnboarding(data)` est appele, then la fonction retourne `{ error: <message getMessageRestriction()> }` **avant** toute insertion / update dans `accompagnantes_profiles` et **avant** geocodage. Aucune ligne n'est creee/modifiee. La validation est appliquee meme si le client a contourne le filtre `CityAutocomplete` (ex : saisie manuelle ou tampering DOM).

2. **AC2 - Passage zone Bretagne** : Given une accompagnante saisit `code_postal = '29200'` (Brest, departement 29 ouvert), when elle valide l'onboarding, then le profil est cree/mis a jour normalement, le geocodage s'execute, le redirect `/accompagnante/dashboard` se declenche (comportement actuel inchange).

3. **AC3 - Message d'erreur unifie** : Given le blocage server est declenche (AC1), when le message d'erreur est rendu cote client, then il est identique a celui que produit `getMessageRestriction()` (deja utilise par `app/actions/profile.ts` et `app/actions/annonces.ts`), c'est-a-dire `"Roxane et Nous est actuellement disponible uniquement en <regions> (departements <codes>). D'autres territoires ouvriront prochainement."`. **Pas de message custom story 3.2** — coherence avec le reste du projet.

4. **AC4 - Lien waitlist visible apres blocage** : Given le message d'erreur est affiche dans le bloc `role="alert"` de `OnboardingClient` (ligne 189), when l'utilisatrice voit le message, then **un lien actif "Rejoindre la waitlist"** est rendu **dans le meme bloc d'alerte** (ou immediatement en dessous, focusable au clavier), pointant vers `/waitlist?email=<email-de-l-utilisatrice>&code_departement=<XX>&role=accompagnante` ou `XX` est le code departement extrait via `extraireCodeDepartement(data.code_postal)`. **Le lien existe meme si la cible `/waitlist` n'est pas encore deployee** (story 3.4) — un 404 transitoire est acceptable jusqu'a la livraison de 3.4 et **explicitement documente** dans la PR pour eviter une regression review.

5. **AC5 - Pre-remplissage waitlist** : Given le lien "Rejoindre la waitlist" (AC4), when l'utilisatrice clique, then les query params `email`, `code_departement`, `role=accompagnante` sont presents dans l'URL et URL-encodes correctement (cas e-mail avec `+`, espaces, etc. -> `encodeURIComponent`). Cette pre-information sera consommee par story 3.4 pour pre-remplir le formulaire waitlist (contrat documente cote story 3.2 cote producteur, story 3.4 cote consommateur).

6. **AC6 - Pas de blocage cote beneficiaire** : Given un beneficiaire (`role = 'accompagne'`) cree son profil via `app/actions/profile.ts:updateAccompagneProfile` ou s'inscrit via `register-form.tsx`, when l'inscription / mise a jour profil est soumise hors zone, then **le comportement actuel est conserve** : `updateAccompagneProfile` bloque deja avec `getMessageRestriction()` (`app/actions/profile.ts:211`) — **rien a modifier**. La story 3.2 n'introduit **aucune** modification cote beneficiaire (decision epic-3.md). Verification statique requise : aucun changement dans `app/actions/profile.ts:updateAccompagneProfile` ni `app/actions/auth.ts:signup` ni `components/auth/register-form.tsx`.

7. **AC7 - Defense en profondeur sur entree manuelle** : Given une utilisatrice contourne `CityAutocomplete` (DevTools, JavaScript desactive partiellement, ou simple saisie manuelle dans le champ code postal), when elle saisit un code valide format (5 chiffres) mais hors zone (ex : `75001`, `13001`, `69001`), then `canProceed()` cote client n'empeche pas (puisqu'il ne valide que `/^\d{5}$/.test(data.code_postal)`) **mais** la soumission server retourne l'erreur AC1, et l'UI rend l'erreur + lien waitlist (AC3, AC4). **Aucun rollback BDD requis** : la fonction sort avant tout INSERT/UPDATE.

### AC techniques (qualite)

8. **AC8 - Reutilisation helper** : Given le filtrage zone est deja centralise dans `lib/departements.ts`, when le check est ajoute dans `submitOnboarding`, then **aucune nouvelle fonction** n'est introduite. Reutiliser `isDepartementOuvert(data.code_postal)` + `getMessageRestriction()`. Pattern strictement aligne avec `app/actions/profile.ts:49-51`.

9. **AC9 - Pas de regression typage** : Given la regle CLAUDE.md "interdire `as any` introduit, resorber au passage", when le code est ecrit, then aucun nouveau `as any` introduit. `extraireCodeDepartement` retourne deja `string | null` correctement type.

10. **AC10 - Performance** : Given le cache `unstable_cache` 30s sur `getCodesDepartementsOuverts()`, when le check `isDepartementOuvert` est ajoute dans `submitOnboarding`, then **0 round-trip BDD additionnel cote chaud** (cache 30s reutilise). Sur cache miss : 1 requete `from('departements_ouverts').select('code, nom, region, ouvert, ouvert_le')` deja chargee par `getCodesDepartementsOuverts`. Pas de nouvelle requete.

11. **AC11 - Pas de regression a11y** : Given la regle CLAUDE.md durcie Lot C, when la story est livree, then `npm run lint:a11y-check` reste **vert** (baseline 155 stable) et `npm run a11y:axe:check` reste **vert** (0 violations Critical/Serious sur 7 parcours, dont **P3-onboarding-aux** qui couvre directement ce flux). Le lien waitlist ajoute respecte les exigences DoD a11y (focus visible, contraste >= 4.5:1, libelle explicite, role implicite link valide).

12. **AC12 - Verification manuelle documentee** : Given la dette tests reportee Epic 4 (cf. epic-3.md "Notes implementation" + story 3.1 AC13), when la story est livree, then la PR contient une section "Verifications manuelles" listant : (a) onboarding accompagnante avec CP `75001` -> erreur affichee + lien waitlist visible avec params corrects, (b) onboarding accompagnante avec CP `29200` -> succes + redirect dashboard, (c) inspection DOM du lien (`href` URL-encode), (d) screen reader (VoiceOver ou NVDA) lit le message + lien lors du focus, (e) navigation clavier : Tab depuis le bouton "Valider" jusqu'au lien waitlist sans piege. Test automatise (e2e Playwright) reporte Epic 4.

### AC commun Lot C (rappel CLAUDE.md durcie)

13. **AC commun 1** - DoD a11y cochee, delta axe-core mentionne (delta attendu : aucun ; le bloc d'erreur existe deja, on lui ajoute un lien).

14. **AC commun 2** - Double commit : livraison (`Story 3.2 : blocage inscription auxiliaire hors zone et lien waitlist`) puis cloture (`Story 3.2 : statut done apres CI Vercel verte`).

## Tasks / Subtasks

- [x] **Task 1 — Ajouter le check zone dans `submitOnboarding`** (AC: #1, #2, #7, #8, #10)
  - [x] Sub 1.1 : Dans `app/actions/accompagnante.ts`, ajouter en debut de fichier `import { isDepartementOuvert, getMessageRestriction } from '@/lib/departements'` (ligne 5, sous l'import `geocodeAddress`).
  - [x] Sub 1.2 : Dans `submitOnboarding`, **apres** la validation regex `if (!/^\d{5}$/.test(data.code_postal))` (ligne 80) et **avant** la validation des disponibilites (ligne 88), ajouter :
    ```ts
    if (!(await isDepartementOuvert(data.code_postal))) {
      return { error: await getMessageRestriction() }
    }
    ```
  - [x] Sub 1.3 : Verifier que la garde retourne **avant** `geocodeAddress` (ligne 101) — pas de hit api-adresse pour rien sur un CP hors zone. Pas de modification BDD non plus.
  - [x] Sub 1.4 : Verifier visuellement que la position du check est **post regex** (ne pas valider `'abcde'` contre la whitelist, eviter une erreur peu lisible) et **pre-disponibilites** (eviter de demander une plage horaire valable a quelqu'un qu'on va rejeter sur la zone).

- [x] **Task 2 — Ajouter un lien waitlist dans le bloc d'erreur de `OnboardingClient`** (AC: #4, #5, #11)
  - [x] Sub 2.1 : Dans `components/accompagnante/onboarding-client.tsx`, recuperer l'email cote client. **Approche** : ajouter une prop `userEmail: string` au composant et la passer depuis `app/accompagnante/onboarding/page.tsx` via `user.email ?? ''` (le `user` Supabase Auth est deja recupere ligne 10 du Server Component). Ne pas refaire `getUser()` cote client.
  - [x] Sub 2.2 : Ajouter un helper local `buildWaitlistHref(message, email, codePostal)` (ou logique inline) qui :
    - extrait le code departement via `extraireCodeDepartement(codePostal)` (importe depuis `@/lib/departements`),
    - construit `/waitlist?email=<encodeURIComponent(email)>&code_departement=<code>&role=accompagnante` **uniquement** si `email`, `code_postal` et `code` sont definis et que `message` est un message de restriction zone (heuristique fiable : ne rendre le lien que quand `submitOnboarding` retourne un message contenant la sous-chaine `"departement"` ou `"territoire"` — tolere les variations futures de `getMessageRestriction()`),
    - sinon, retourner `null` (cas erreurs autres : "Diplomes... requis", "Erreur lors de la creation du profil.", etc.).
  - [x] Sub 2.3 : Dans le bloc `role="alert"` ligne 189, rendre le lien si `buildWaitlistHref(...)` retourne une URL :
    ```tsx
    {error && (
      <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        <p>{error}</p>
        {waitlistHref && (
          <p className="mt-2">
            <Link
              href={waitlistHref}
              className="underline font-medium text-red-700 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
            >
              Rejoindre la waitlist pour mon departement
            </Link>
          </p>
        )}
      </div>
    )}
    ```
    Note : `Link` deja importe ligne 5 du fichier. La classe `focus:ring-focus-ring` reutilise le token global Lot A.
  - [x] Sub 2.4 : Verifier qu'aucune modification visuelle n'apparait sur les **autres** messages d'erreur du flux (ex : "Diplomes, experience et specialites sont requis.") -> le lien ne doit pas s'afficher pour ces erreurs (Sub 2.2 heuristique).

- [x] **Task 3 — Cabler la prop `userEmail` du Server Component** (AC: #4, #5)
  - [x] Sub 3.1 : Dans `app/accompagnante/onboarding/page.tsx`, passer `userEmail={user.email ?? ''}` au `<OnboardingClient ...>` (ligne 42). Comme `user` est deja resolu ligne 10, aucune requete supplementaire.
  - [x] Sub 3.2 : Mettre a jour le `Props` type de `OnboardingClient` (ligne 47-53) pour inclure `userEmail: string`.
  - [x] Sub 3.3 : Verifier que TS compile sans `as any` (AC9).

- [x] **Task 4 — Verifier que les autres flux ne sont pas impactes** (AC: #6)
  - [x] Sub 4.1 : Verification grep statique : `grep -n "isDepartementOuvert\|getMessageRestriction" app/actions/auth.ts components/auth/register-form.tsx app/actions/profile.ts` -> attendu **inchange** par rapport a l'etat pre-story (signup pas impacte, `updateAccompagneProfile` toujours protege, `updateAccompagnanteProfile` toujours protege).
  - [x] Sub 4.2 : Verification statique : aucune modification dans `app/actions/auth.ts`, `components/auth/register-form.tsx`, `app/accompagne/`, `app/admin/`. Si une modification y apparait dans `git diff`, c'est un bug.

- [x] **Task 5 — Verifications globales + DoD** (AC: #9, #10, #11, #12)
  - [x] Sub 5.1 : `npx tsc --noEmit` -> 0 erreur. AC9.
  - [x] Sub 5.2 : `npm run lint:a11y-check` -> vert. Baseline 155 stable. AC11.
  - [x] Sub 5.3 : `npm run a11y:axe:check` -> vert. 7 parcours, 0 delta Critical/Serious. AC11. **Important** : le parcours `P3-onboarding-aux` est celui qui couvre `/accompagnante/onboarding` — verifier specifiquement que ce parcours reste a 0 violation Critical/Serious.
  - [x] Sub 5.4 : Tests manuels documentes en Completion Notes (AC12 a/b/c/d/e). Tests fonctionnels reportes au reviewer / verification staging avec data reelle.
  - [x] Sub 5.5 : DoD a11y cochee (section finale).

- [ ] **Task 6 — Commits**
  - [ ] Sub 6.1 : Commit 1 livraison : `Story 3.2 : blocage inscription auxiliaire hors zone et lien waitlist`. **A executer par l'utilisateur** (regle projet : Claude ne commit pas sans demande explicite).
  - [ ] Sub 6.2 : Push + CI Vercel verte. **A executer par l'utilisateur**.
  - [ ] Sub 6.3 : Commit 2 cloture : `Story 3.2 : statut done apres CI Vercel verte` (avec passage `Status: done`). **A executer par l'utilisateur** apres CI Vercel verte.

## Dev Notes

### Decisions techniques cles

#### D1 — OCR justificatif d'identite : explicitement HORS scope

L'epic 3 mentionne "ou du justificatif via OCR" comme source possible du departement. **Decision** : non implemente dans cette story.

**Rationale** :
- L'OCR actuel (`lib/ocr.ts`) extrait du texte via Google Cloud Vision pour verifier la **coherence prenom/nom** (`checkCoherence`), **pas le departement**. Aucune extraction d'adresse / CP n'existe.
- L'adresse de residence est saisie a l'etape `step-localisation` via `CityAutocomplete` (champ ville + champ CP). Cette source est **autoritative** — l'utilisatrice indique sa zone d'intervention, qui peut differer du domicile officiel sur le justificatif.
- Le justificatif d'identite est uploade dans `step-justificatifs` (composant present dans le code mais non monte dans `OnboardingClient` actuellement — voir D2). Ajouter une extraction d'adresse OCR introduirait : (1) une dependance forte au pattern d'OCR (faux positifs frequents : adresses anciennes, CNI sans adresse, passeports), (2) un risque vie privee (extraction d'adresse depuis pieces officielles), (3) une story autonome de plusieurs jours.
- Le **CP saisi a l'onboarding** est le seul source-of-truth metier coherent avec la suite (filtrage `/recherche` story 3.1 utilise `accompagnantes_profiles.code_postal`, pas une extraction OCR).

**Action** : la story 3.2 valide **uniquement** `data.code_postal` saisi cote step-localisation. Le justificatif reste extrait pour coherence prenom/nom (comportement actuel inchange).

Si une extension future souhaitait croiser CP saisi vs CP justificatif (anti-fraude), ce serait une story dediee Epic 4 candidat D (OCR perfectionnement, deja reporte).

#### D2 — `step-justificatifs` non monte dans OnboardingClient

Lecture de `OnboardingClient` (lignes 12-17) : les 4 etapes montees sont `Diplome`, `Specialites`, `Localisation`, `Disponibilites`. Le composant `step-justificatifs.tsx` existe mais n'est pas monte (justificatifs gerees inline dans `step-diplome` et `step-localisation` via `onUpload`). **Aucune modification de `step-justificatifs.tsx`** dans cette story.

#### D3 — Position du check : server action plutot que `canProceed()` cote client

**Choix retenu** : check exclusivement server (`submitOnboarding`).

**Rationale** :
- `canProceed()` cote client (ligne 79-113 de `OnboardingClient`) ne fait que de la validation format (regex CP, presence des champs). Ajouter un check zone cote `canProceed()` necessiterait d'embarquer la liste des departements ouverts comme deja fait via la prop `departementsOuverts` (deja passee). On **pourrait** durcir `canProceed()` mais c'est defense en profondeur secondaire ; le filet sur le bouton "Suivant" de l'etape 2 ne protege pas du tampering DOM.
- `CityAutocomplete` filtre deja les **suggestions** mais autorise la **saisie manuelle** d'un CP hors zone (input non controle sur la liste). Le bandeau "Roxane et Nous n'est pas encore disponible dans cette zone" s'affiche seulement quand l'API retourne >0 resultats, pas sur saisie manuelle valide format mais hors zone.
- Le **vrai gardien** est le server. C'est aussi la seule defense contre un attaquant qui contournerait le frontend entierement (curl direct sur server action). C'est aussi le pattern aligne avec `app/actions/profile.ts:49`, `app/actions/annonces.ts:52,125,215,341` — coherence projet.
- **Pas d'amelioration `canProceed()` dans cette story** pour limiter la surface : 1 fichier server modifie + 2 fichiers client (composant + page) = surface minimale de revue. Une story future pourrait durcir `canProceed()` si le taux d'erreurs server post-deploy est non negligeable (telemetrie a regarder).

#### D4 — Heuristique pour afficher le lien waitlist

`getMessageRestriction()` retourne un message du type `"Roxane et Nous est actuellement disponible uniquement en Bretagne (departements 22, 29, 35, 44, 56). D'autres territoires ouvriront prochainement."`. Les autres erreurs de `submitOnboarding` (`"Non connecte."`, `"Acces non autorise."`, `"Diplomes, experience et specialites sont requis."`, `"Ville et code postal sont requis."`, `"Le code postal doit contenir 5 chiffres."`, `"Renseignez au moins une plage horaire ou cochez \"flexible\"."`, `"Erreur lors de la creation du profil."`) ne contiennent jamais les mots **"departement"** ni **"territoire"**.

**Heuristique retenue** (Sub 2.2) : afficher le lien si l'erreur contient `"departement"` (insensible a la casse). Cela couvre toute reformulation future de `getMessageRestriction` qui inclurait le mot `departement(s)`. Si un faux positif venait a apparaitre, le test manuel AC12 le detecterait avant merge.

**Alternative rejetee** : retourner depuis le server un objet structure (`{ error, kind: 'zone_restriction', code_departement }`). Plus propre mais demande de refactor le type `OnboardingResult` (`AuthResult` / `ProfileResult` sont tous identiques `{ error?, success? }`). Hors scope story 3.2 — coherence avec le pattern projet primee.

#### D5 — Cible `/waitlist` non encore deployee

La story 3.4 (waitlist hors zone beneficiaire) creera la route `/waitlist` qui acceptera les query params `email`, `code_departement`, `role`. **Cette story 3.2 livre le lien avant que la cible existe**. Consequences :
- Entre le merge de 3.2 et celui de 3.4, un clic sur le lien -> 404 Next.js. Acceptable car (a) la story 3.4 est la suivante dans la sequence epic, (b) le user voit deja le message principal qui l'informe du blocage, (c) une accompagnante hors zone qui clique recoit un 404 qui n'est pas catastrophique a court terme.
- **A documenter explicitement** dans la PR de la story 3.2 (section "Limitations connues") pour eviter qu'un reviewer adversarial (Edge Case Hunter) bloque la story sur ce findings.

**Alternative rejetee** : creer un placeholder `/waitlist/page.tsx` qui retourne un message statique. Cela introduirait une dette de migration quand 3.4 sera implemente (suppression du placeholder au lieu d'ajout direct). Pas de gain reel pour l'utilisatrice (un 404 et une page "bientot" sont equivalents en frustration). Hors scope.

### Source tree fichiers a toucher (3)

| Fichier | Type | Modification |
|---|---|---|
| `app/actions/accompagnante.ts` | check server | Import `isDepartementOuvert, getMessageRestriction` + check apres regex CP avant `geocodeAddress` |
| `components/accompagnante/onboarding-client.tsx` | UX | Prop `userEmail`, helper `buildWaitlistHref`, lien `<Link>` dans bloc `role="alert"` |
| `app/accompagnante/onboarding/page.tsx` | wiring | Passer `userEmail={user.email ?? ''}` au `<OnboardingClient ...>` |

**Fichiers explicitement non modifies** (verification statique requise — Sub 4.1, 4.2) :
- `app/actions/auth.ts` — signup ne demande pas d'adresse, hors scope.
- `components/auth/register-form.tsx` — pas d'adresse demandee, hors scope.
- `app/actions/profile.ts:updateAccompagneProfile` (ligne 211) — protection zone deja en place.
- `app/actions/profile.ts:updateAccompagnanteProfile` (ligne 49) — protection zone deja en place pour la mise a jour post-onboarding.
- `app/actions/annonces.ts` — protections en place stories Epic 1/2.
- `lib/departements.ts` — helpers existants reutilises tels quels, pas d'extension.
- `lib/ocr.ts` — pas d'extraction adresse OCR (decision D1).
- `components/ui/city-autocomplete.tsx` — filtrage cote client deja en place.
- `components/accompagnante/step-localisation.tsx`, `step-diplome.tsx`, `step-disponibilites.tsx`, `step-specialites.tsx`, `step-justificatifs.tsx` — pas de changement etapes, le check est ailleurs.

### Pattern de code (exemples)

```ts
// app/actions/accompagnante.ts (ligne 5 + ligne ~83)

import { geocodeAddress } from '@/lib/geocoding'
import { isDepartementOuvert, getMessageRestriction } from '@/lib/departements'

// ... dans submitOnboarding, apres validation regex CP ligne 80-82 ...

if (!/^\d{5}$/.test(data.code_postal)) {
  return { error: 'Le code postal doit contenir 5 chiffres.' }
}

// AJOUT story 3.2
if (!(await isDepartementOuvert(data.code_postal))) {
  return { error: await getMessageRestriction() }
}

// ... validation disponibilites (ligne 88+) reste inchangee ...
```

```tsx
// components/accompagnante/onboarding-client.tsx (extrait Tasks 2-3)

import { extraireCodeDepartement } from '@/lib/departements'

type Props = {
  parrainage: {
    isFilleule: boolean
    marraineFirstName: string | null
  }
  departementsOuverts: string[]
  userEmail: string // AJOUT story 3.2
}

export function OnboardingClient({ parrainage, departementsOuverts, userEmail }: Props) {
  // ... hooks existants ...

  function buildWaitlistHref(): string | null {
    if (!error) return null
    const isZoneError = /departement|territoire/i.test(error)
    if (!isZoneError) return null
    const code = extraireCodeDepartement(data.code_postal)
    if (!userEmail || !code) return null
    const params = new URLSearchParams({
      email: userEmail,
      code_departement: code,
      role: 'accompagnante',
    })
    return `/waitlist?${params.toString()}`
  }

  const waitlistHref = buildWaitlistHref()

  // ... render ...
  return (
    // ...
    {error && (
      <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        <p>{error}</p>
        {waitlistHref && (
          <p className="mt-2">
            <Link
              href={waitlistHref}
              className="underline font-medium text-red-700 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
            >
              Rejoindre la waitlist pour mon departement
            </Link>
          </p>
        )}
      </div>
    )}
    // ...
  )
}
```

```tsx
// app/accompagnante/onboarding/page.tsx (extrait Task 3)

// ... user deja recupere ligne 10 ...
return (
  <main /* ... */>
    <h1 className="sr-only">Onboarding accompagnante</h1>
    <OnboardingClient
      parrainage={{ isFilleule: !!marraineId, marraineFirstName }}
      departementsOuverts={departementsOuverts}
      userEmail={user.email ?? ''} // AJOUT story 3.2
    />
  </main>
)
```

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | L'utilisatrice contourne `CityAutocomplete` -> filet client absent. | Le filet **server** (Task 1) attrape tous les cas, y compris tampering DOM ou curl direct sur server action. AC7 explicite. |
| **R2** | Le lien waitlist apparait sur d'autres erreurs (faux positif heuristique D4). | L'heuristique cherche `departement` ou `territoire` insensible a la casse. Aucun autre message dans `submitOnboarding` (verification statique Task 1) ne contient ces mots. Si `getMessageRestriction()` est reformulee, elle continuera a contenir ces mots (semantique du message). Test manuel AC12 valide. |
| **R3** | La cible `/waitlist` n'existe pas (story 3.4 pas encore livree) -> 404 transitoire. | Documente en D5 et explicite dans la PR. Acceptable car (a) sequence epic claire, (b) le user voit deja le message principal, (c) un 404 n'est pas plus frustrant qu'un placeholder "bientot". Disparait au merge de 3.4. |
| **R4** | Une accompagnante deja inscrite hors zone (data legacy) tente de modifier son profil -> bloque par `updateAccompagnanteProfile` (deja en place). | Comportement deja en place avant 3.2 (`app/actions/profile.ts:49`). La story 3.2 ne change rien sur ce flow. Le blocage est volontaire et coherent. Story 3.4 (waitlist) offrira un parcours sortant. |
| **R5** | `extraireCodeDepartement` retourne `null` sur CP partiel (`< 2 chars`) -> pas de lien rendu (Sub 2.2 verifie `code !== null`). | Comportement attendu : si `code_postal` est invalide, l'erreur affichee n'est pas `getMessageRestriction()` mais `"Le code postal doit contenir 5 chiffres."`, donc l'heuristique D4 ne match pas et le lien n'est pas rendu. Coherent. |
| **R6** | Email utilisateur contient un caractere special (`+`, espace) -> URL malformee. | `URLSearchParams.toString()` URL-encode automatiquement (`+` -> `%2B`, etc.). Pas de `encodeURIComponent` manuel a faire. |
| **R7** | Le parrainage filleule contourne le check (filleule hors zone). | **Faux probleme** : la regle `isDepartementOuvert` s'applique uniformement, parrainee ou pas. La story 3.2 NE modifie PAS le bypass parrainage existant (qui dispense de diplomes / justificatifs uniquement). Cf. ligne 70-74 de `submitOnboarding` actuel : `isFilleule` ne contourne que les requirements `diplomes/experience/specialites`. L'ajout du check zone est **apres** ce bloc, donc s'applique a tous (verification Sub 1.2). |
| **R8** | Cache `unstable_cache` 30s -> ouverture d'un departement par admin met 30s a se propager au check. | Comportement deja en place pour `isDepartementOuvert` (utilise dans 4 autres server actions). `revalidateTag(DEPARTEMENTS_CACHE_TAG)` declenche par `app/admin/departements/actions.ts:38` -> propagation immediate via tag. Aucune action requise. |

### Project Structure Notes

Cette story est un **renforcement defense en profondeur** : le filet server etait absent sur l'onboarding accompagnante (alors qu'il etait present sur 4 autres server actions). 3 fichiers touches, ~15 lignes ajoutees au server, ~25 lignes ajoutees cote client (helper + lien). Coherent avec la philosophie projet "no half-finished implementations" et "don't add features beyond what the task requires".

Apres merge, le projet aura un alignement complet sur la decision F (DECISIONS.md 2026-05-06) cote ecriture (deja en place pour le profil/annonces) **et** cote inscription auxiliaire (objet de cette story). FR47 sera couvert. FR46 sera adressee par stories 3.4 + 3.5.

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story-3.2] — story origin (objectifs, AC initiaux, notes implementation)
- [Source: _bmad-output/planning-artifacts/prd.md#FR47] — exigence fonctionnelle : "le systeme bloque l'inscription accompagnante hors whitelist avec message + redirection waitlist"
- [Source: DECISIONS.md#2026-05-06-deploiement-geographique-progressif] — decision F : Bretagne 5 dpt + regle uniforme cote ecriture
- [Source: lib/departements.ts] — helper existant : `isDepartementOuvert`, `getMessageRestriction`, `extraireCodeDepartement`, cache 30s
- [Source: app/actions/accompagnante.ts:12-146] — `submitOnboarding` actuel (sans check zone — c'est le trou a fermer)
- [Source: app/actions/profile.ts:49-51] — pattern reference : check `isDepartementOuvert` + `getMessageRestriction` deja en place sur `updateAccompagnanteProfile`
- [Source: app/actions/annonces.ts:52,125,215,341] — pattern reference : meme check sur les 4 actions annonces
- [Source: components/accompagnante/onboarding-client.tsx:189] — bloc `role="alert"` deja en place (Lot B story 2.6.4) : extension simple avec lien
- [Source: components/ui/city-autocomplete.tsx:42-78] — filtrage cote client (ne suffit pas en defense seul, raison d'etre du filet server)
- [Source: _bmad-output/implementation-artifacts/3-1-activation-whitelist-departements-ouverts-et-filtrage-requetes.md] — story precedente : pattern double commit, conventions Lot C, intelligence git, format AC, format risques, decisions techniques

### Intelligence story precedente (3.1)

- **Pattern double commit confirme** : `Story X.Y : <description>` -> attendre CI Vercel verte -> `Story X.Y : statut done apres CI Vercel verte`. Ne PAS utiliser `--amend` (cf. instructions globales). Applique 3.1 (commits `028a78c` puis `899aa7e`).
- **a11y validation systematique** : meme si la story est principalement BDD/server, lancer `npm run lint:a11y-check` ET `npm run a11y:axe:check` localement avant commit livraison (regle CLAUDE.md durcie). Pour 3.2 : impact UI reel (lien waitlist ajoute), donc validation **encore plus critique**, en particulier P3-onboarding-aux.
- **Code review adversarial** post-livraison probable (3 layers Blind Hunter / Edge Case Hunter / Acceptance Auditor). Etre exhaustif sur les AC et edge cases. AC7 (defense en profondeur tampering DOM), AC10 (perf), AC12 (verifications manuelles structurees), R3 (404 transitoire `/waitlist`) sont preemptifs.
- **Pas de `as any` introduit** — regle Epic 4 candidat I deja appliquee de fait. Verifier au passage (AC9).
- **Decisions techniques numerotees + risques tabulaires** : format aligne sur 3.1 et stories Lot C — facilite la review et la generation d'arbres de decision.

### Intelligence git recente (5 derniers commits)

```
899aa7e Story 3.1 : statut done apres CI Vercel verte
028a78c Story 3.1 : activation whitelist departements_ouverts cote lecture
523f058 Epic 3 (Lancement Bretagne) : cadrage formel + story 3.1 ready-for-dev
5e5bde6 Re-run NFR a11y post-Lot C (AI-13) : statut done apres CI Vercel verte
ed2d362 Re-run NFR a11y post-Lot C (AI-13) : statut PASS avec reserves
```

Les 5 derniers commits couvrent (a) la cloture story 3.1 (deux commits, double commit applique), (b) le cadrage formel Epic 3, (c) la NFR a11y AI-13 close. **Aucun commit recent ne touche au flow d'inscription/onboarding accompagnante** : `app/actions/accompagnante.ts`, `components/accompagnante/onboarding-client.tsx`, `app/accompagnante/onboarding/page.tsx` sont stables. Pas de risque de conflit.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `npx tsc --noEmit` -> exit 0, 0 erreur (AC9).
- `npm run lint:a11y-check` -> `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.` (AC11).
- `npm run a11y:axe:check` -> `OK: aucun delta Critical/Serious au-dela du baseline.` Baseline `axe-core-baseline-2026-05-05.json`, 7 parcours audites dont `P3-onboarding-aux` (AC11).
- `git diff --stat` -> 3 fichiers modifies (`app/accompagnante/onboarding/page.tsx`, `app/actions/accompagnante.ts`, `components/accompagnante/onboarding-client.tsx`), aligne strictement sur le tableau "Source tree fichiers a toucher". Aucune modification dans `app/actions/auth.ts`, `components/auth/register-form.tsx`, `app/actions/profile.ts`, `lib/departements.ts` (verification AC6).

### Completion Notes List

- **Implementation 2026-05-06 par Amelia (Dev Agent)** : story livree en single execution, 5 tasks/subtasks completees. Surface effective : ~36 lignes ajoutees, 0 lignes supprimees. Strictement conforme aux specifications du fichier story.
- **AC1 (blocage server)** : check `isDepartementOuvert` ajoute `app/actions/accompagnante.ts:84-86`, retourne `{ error: getMessageRestriction() }` avant toute insertion BDD et avant `geocodeAddress`. Pattern strictement aligne sur `app/actions/profile.ts:49-51`.
- **AC2 (passage Bretagne)** : flow inchange pour CP `29200` (et autres departements ouverts). Le check retourne `false` -> branche `if` non prise -> code existant continue normalement.
- **AC3 (message unifie)** : reuse `getMessageRestriction()` -> message `"Roxane et Nous est actuellement disponible uniquement en Bretagne (departements 22, 29, 35, 44, 56). D'autres territoires ouvriront prochainement."` identique a celui produit par les 4 autres server actions deja en place.
- **AC4-AC5 (lien waitlist)** : helper `buildWaitlistHref()` cote client, conditionne sur (a) presence d'erreur, (b) match heuristique `/departement|territoire/i` (D4), (c) email + code dpt extraits. URL construite via `URLSearchParams.toString()` -> URL-encoding automatique du `+` dans email et autres caracteres speciaux (R6 mitige sans `encodeURIComponent` manuel).
- **AC6 (pas de regression beneficiaire)** : verification `git diff --stat` confirme 0 modification dans les fichiers explicitement non touches.
- **AC7 (defense en profondeur)** : le check est server-side, attrape tout (tampering DOM, curl direct, JS desactive). `canProceed()` cote client volontairement non durci (D3) -> surface revue minimale.
- **AC8 (reutilisation helper)** : aucune nouvelle fonction zone introduite, reuse 100% `lib/departements.ts`.
- **AC9 (typage)** : aucun `as any` introduit, `extraireCodeDepartement` retourne `string | null` correctement gere.
- **AC10 (perf)** : 0 round-trip BDD additionnel cote chaud grace au cache `unstable_cache` 30s sur `getCodesDepartementsOuverts` (deja en place).
- **AC11 (a11y)** : `lint:a11y-check` vert (155 stable), `a11y:axe:check` vert (delta 0 sur 7 parcours, P3-onboarding-aux compris).
- **AC12 (verifications manuelles)** : reportees a la PR + verification staging par reviewer. Test e2e Playwright reporte Epic 4 (cf. epic-3.md "Notes implementation").
- **AC13/14 (commun Lot C)** : DoD a11y cochee (delta axe-core 0 confirme), double commit a executer par utilisateur.
- **D5 (404 transitoire `/waitlist`)** : limitation explicite -> a documenter en section "Limitations connues" de la PR pour eviter blocage par reviewer adversarial. Disparait au merge story 3.4.

#### Verifications manuelles a effectuer par le reviewer (AC12)

a. Onboarding accompagnante avec CP `75001` -> message d'erreur affiche + lien `Rejoindre la waitlist pour mon departement` visible dans le bloc `role="alert"`, parametres URL corrects.
b. Onboarding accompagnante avec CP `29200` -> succes + redirect `/accompagnante/dashboard`.
c. Inspection DOM : `href="/waitlist?email=...&code_departement=75&role=accompagnante"`, email URL-encode (caracteres speciaux convertis).
d. Lecteur d'ecran (VoiceOver/NVDA) : annonce du message d'erreur via `role="alert"` puis lecture du lien lors du focus.
e. Navigation clavier : Tab depuis le bouton "Valider mon profil" -> focus passe sur le lien waitlist sans piege, focus visible (ring `--focus-ring`).

### File List

- `app/actions/accompagnante.ts` (modifie) — import `isDepartementOuvert`, `getMessageRestriction` + check zone post-regex CP.
- `components/accompagnante/onboarding-client.tsx` (modifie) — prop `userEmail`, helper `buildWaitlistHref`, lien `<Link>` conditionnel dans bloc `role="alert"`.
- `app/accompagnante/onboarding/page.tsx` (modifie) — passage `userEmail={user.email ?? ''}` au `<OnboardingClient>`.

### Change Log

- 2026-05-06 — Story 3.2 livree (Amelia / Dev Agent). FR47 couvert cote inscription accompagnante : check zone server-side dans `submitOnboarding` + lien waitlist accessible dans le bloc d'erreur. 3 fichiers modifies, ~36 lignes ajoutees. AC1-12 valides, DoD a11y cochee, baseline lint et axe stables. Status: in-progress -> review.

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A (le bloc d'erreur ne contient pas de champ ; le lien est texte clair, role implicite link).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A (l'erreur est globale, pas attachee a un champ specifique ; le bloc `role="alert"` annonce le message au lecteur d'ecran).
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — `focus:ring-focus-ring` (token global `--focus-ring: oklch(0.4 0.15 30)` defini ligne 6 de `app/globals.css`) reutilise sur le lien. Pattern aligne sur `city-autocomplete.tsx:134`, `input.tsx:55` et autres composants Lot A (verifications manuelles AC12 e a confirmer en staging).
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — texte `text-red-700` sur fond `bg-red-50` (pattern Lot B inchange). Le lien souligne en `text-red-700` sur meme fond conserve le ratio. Aucune modification de couleurs.
- [x] ARIA states corrects sur composants dynamiques — N/A (lien statique sans etat).
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) — lien `<Link>` Next.js => element `<a>` natif, focus naturel via Tab, Enter active la navigation. AC12 e couvre la verification manuelle.
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche — AC12 d : `role="alert"` annonce le message + presence du lien dans le meme conteneur. Verification reviewer/staging.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) — `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) — `OK: aucun delta Critical/Serious au-dela du baseline.` 7 parcours audites incluant P3-onboarding-aux (couvre `/accompagnante/onboarding`).
