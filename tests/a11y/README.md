# Suite a11y axe-core / Playwright (Lot B)

Cette suite outille la mesure dynamique de l'accessibilité sur les **6 parcours
critiques** (P1-P6) du projet roxanetnous. Elle complète le scan statique
`eslint-plugin-jsx-a11y` (Lot A, `npm run lint:a11y-check`) avec une couche
runtime via [`axe-core`](https://github.com/dequelabs/axe-core) exécuté dans
[`Playwright`](https://playwright.dev/).

## Commandes

```bash
# Lance la suite complete (utilise le webServer Playwright qui demarre `npm run dev`)
npm run a11y:axe

# Genere/regenere le baseline JSON (a committer dans _bmad-output/test-artifacts/)
npm run a11y:axe:baseline

# Compare la suite courante au dernier baseline ; sort en code != 0 si delta Critical/Serious
npm run a11y:axe:check
```

> **Important** : `npm run a11y:axe` **n'est pas un gate de regression**. Cette commande sert au debug local (`--ui`, `--trace`) et au rapport HTML. Les specs attachent les violations via `testInfo.attach` mais ne contiennent pas d'assertion bloquante per-spec (decision Sub 4.5). **La regression est bloquee par `npm run a11y:axe:check`** qui compare structurellement la suite courante au baseline. Lancer `a11y:axe` seul renvoie toujours vert, meme avec de nouvelles violations Critical.

## Parcours audites

| ID  | Spec                              | URL auditee                    | Note                                                     |
| --- | --------------------------------- | ------------------------------ | -------------------------------------------------------- |
| P1  | `p1-onboarding-aux.spec.ts`       | `/login` (proxy)               | Onboarding accompagnante — voir `lib/auth-stub.md`       |
| P2  | `p2-recherche.spec.ts`            | `/recherche`                   | Audit hors `<div class="leaflet-container">`             |
| P3  | `p3-messagerie.spec.ts`           | `/login` (proxy)               | Messagerie auth-required — voir `lib/auth-stub.md`       |
| P4  | `p4-inscription-checkout.spec.ts` | `/register?role=accompagnante` (entree `p4-register`) + `/login` (entree `p4-login`) — 2 sous-entrees dans le baseline | Audit complet — Input refonte 2.5.5                      |
| P5  | `p5-landing.spec.ts`              | `/`                            | Audit hors carte SVG hero (story 2.6.5 dediee)           |
| P6  | `p6-suppression-rgpd.spec.ts`     | `/login` (proxy)               | Suppression RGPD auth-required — voir `lib/auth-stub.md` |

## Baseline

Format : `_bmad-output/test-artifacts/axe-core-baseline-YYYY-MM-DD.json`.

```json
{
  "_comment": ["Ne pas regenerer ce baseline pour faire passer la CI sans justification dans le PR."],
  "generatedAt": "2026-05-XXTHH:MM:SSZ",
  "commitSha": "...",
  "totals": { "violations": N, "nodes": N },
  "parcours": [
    { "id": "p1-onboarding-aux", "url": "/login", "proxy": true, "violations": [] },
    ...
  ]
}
```

### Garde-fou social

> **Ne pas regenerer ce baseline pour faire passer la CI sans justification
> dans le PR.** Toute regeneration doit etre motivee : montee de version
> `axe-core`, livraison story Lot B reduisant les violations, ou correction
> massive justifiee.

Pattern hérité du baseline Lot A (`scripts/build-a11y-baseline.mjs` + 2.5.1 D2
de la rétrospective).

### Re-générer le baseline

1. Corriger les violations ou faire évoluer la suite (story Lot B en cours),
2. Lancer `npm run a11y:axe:baseline`,
3. Vérifier le diff JSON avec `git diff _bmad-output/test-artifacts/`,
4. Committer le **nouveau** fichier daté ; conserver les anciens fichiers comme
   trace historique (le wrapper `check` prend toujours le plus récent par tri ISO).

## Strategie d'authentification

Voir [`lib/auth-stub.md`](./lib/auth-stub.md). Décision Lot B : pas de compte
test, audit de la page `/login` comme proxy pour P1, P3, P6. Re-évaluation Lot C.

## Exclusions documentees

- **`p2-recherche`** exclut `.leaflet-container`, `.leaflet-pane`,
  `[data-a11y-deferred="map"]` — la carte Leaflet est traitée par la story 2.6.6.
- **`p5-landing`** exclut `svg[aria-hidden="true"]` et
  `[data-a11y-deferred="hero-map"]` — la carte SVG hero est traitée par la story 2.6.5.

## Integration CI Vercel

**État actuel (story 2.6.1)** : la commande `npm run a11y:axe:check` est
exécutée **localement avant merge** par le développeur. Elle **n'est pas**
ajoutée au `buildCommand` Vercel pour les raisons suivantes :

1. La suite Playwright nécessite `npm run dev` (Next dev server) ; or la
   build Vercel exécute `next build` (mode prod), incompatible avec
   `webServer.command: 'npm run dev'` du `playwright.config.ts`.
2. Le téléchargement Chromium (~165 Mo) à chaque build augmente le temps et
   le risque de flake.
3. Pattern Lot A respecté : `lint:a11y-check` est statique (OK en build),
   `axe:check` est dynamique (autre mécanisme requis).

**Plan de bascule (story de clôture Lot B ou Lot C)** :

- Option A : worker GitHub Actions dédié (job a11y) lancé sur PR.
- Option B : Vercel deploy hook post-Preview avec `next start` + Playwright
  ciblant l'URL Preview.
- Le mode bloquant (`|| true` retiré) sera activé une fois l'option choisie
  stable.

**Mécanisme actuel pour le développeur** : avant merge d'une PR Lot B,
exécuter `npm run a11y:axe:check`. Si delta Critical/Serious, corriger ou
documenter dans la PR (avec mise à jour baseline le cas échéant).

## Architecture

- `playwright.config.ts` (racine) — config TS ESM, 1 projet `chromium`,
  reporter `list` + `html`.
- `tests/a11y/lib/run-axe.ts` — helper `runAxe(page, options)` filtré
  Critical/Serious, tags `wcag2a`, `wcag2aa`, `wcag22aa`, `best-practice`.
- `tests/a11y/lib/auth-stub.md` — décision auth.
- `tests/a11y/p*-*.spec.ts` — 6 specs smoke.
- `scripts/build-axe-baseline.mjs` — generator (calque Lot A).
- `scripts/check-axe-baseline.mjs` — wrapper check (calque
  `findLatestBaseline()` Lot A).

## References

- [Story 2.6.1 — outillage axe-core/Playwright](../../_bmad-output/implementation-artifacts/2-6-1-outillage-axe-core-playwright.md)
- [Tech-spec Lot B a11y](../../_bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md)
- [Retro mini-epic 2.5 — AI-1 axe-core](../../_bmad-output/implementation-artifacts/mini-epic-2-5-retro-2026-05-05.md)
