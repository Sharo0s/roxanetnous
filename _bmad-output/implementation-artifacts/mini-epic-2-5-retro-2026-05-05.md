# Rétrospective — Mini-épic 2.5 (Lot A accessibilité)

**Date** : 2026-05-05
**Project Lead** : Sylvain
**Format** : rétro courte, structure calquée sur `epic-2-retro-2026-05-04.md`. Pas de party-mode.

## Résumé mini-épic

**Périmètre** : Lot A du chantier accessibilité (NFR WCAG 2.2 AA). Mise en place de l'outillage lint a11y, des fondations layout/focus/motion, du composant Input accessible et du header authentifié. Aligné sur le tech-spec `tech-spec-lot-a-a11y.md` et l'audit `audit-a11y-2026-05-04.md`.

**Stories livrées (6/6)**
- 2.5.1 — Outillage ESLint a11y et baseline lint (`eslint-plugin-jsx-a11y`, baseline 160, wrapper `lint:a11y-check`, DoD a11y publiée)
- 2.5.2 — Skip-link `Aller au contenu` et `id="main-content"` sur les `<main>` page-level
- 2.5.3 — Token focus global et palette de contrastes (ring contrasté ≥ 3:1, ≥ 2 px)
- 2.5.4 — `prefers-reduced-motion: reduce` global et carte hero
- 2.5.5 — Composant `<Input>` accessible (`htmlFor`, `aria-describedby`, `aria-invalid`, `aria-required`, suffix « (obligatoire) »)
- 2.5.6 — Header accessible et burger (`aria-expanded`, `aria-controls`, landmarks `<nav>` distincts)

**Branche / merge** : chaque story a été développée sur une branche dédiée `story-2-5-X-*`, mergée sur `main` après CI Vercel verte.

**Code reviews** : reviews intégrées au workflow `bmad-dev-story` (pas de session multi-agent dédiée comme sur 2.3 — le périmètre a11y se prête mieux à la validation par axe lint + test manuel lecteur d'écran).

## Successes identifiés

- **Première baisse historique du baseline a11y : 160 → 158**. La 2.5.5 (composant Input) a fait disparaître la violation `jsx-a11y/label-has-for (1)` sur `components/ui/input.tsx` et incidemment 1 sur `register-form.tsx`. C'est le premier mouvement à la baisse depuis la mise en place du baseline le 2026-05-04. Le wrapper `lint:a11y-check` a confirmé `158 = 158` après regénération du fichier `a11y-lint-baseline-2026-05-05.txt`. Le mécanisme `findLatestBaseline()` (tri lexicographique ISO) a fonctionné sans intervention manuelle — décision de design 2.5.1 validée a posteriori.
- **Pattern statut `review` → `done` après CI Vercel verte adopté et tenu sur les 6 stories**. Chaque story a suivi le double commit : `Story 2.5.X : <titre>` (livraison) puis `Story 2.5.X : statut done apres CI Vercel verte` (clôture). Donne une trace git claire de la frontière dev/CI et permet de revenir précisément au point de bascule en cas de régression future. Pattern à conserver pour les stories Lot B et Lot C.
- **DoD a11y comme garde-fou opérationnel**. Publiée par 2.5.1 dans `bmad-create-story/template.md` et `CLAUDE.md`, elle a été cochée systématiquement sur les 5 stories suivantes. Le couple `eslint-plugin-jsx-a11y` (CI bloquante) + checklist DoD (revue humaine) a empêché toute régression : aucun nouveau `jsx-a11y/*` introduit malgré la modification de 2 layouts, 4 formulaires, 1 composant primitif et 2 headers. La règle « la CI Vercel bloque toute régression au-delà du baseline » du `CLAUDE.md` projet est désormais matériellement appliquée.
- **Approche progressive `warn` → `error`** : démarrer le baseline en mode `warn` (160 violations admises) plutôt que de tout casser à 0 a permis de livrer le Lot A sans bloquer le développement parallèle. La bascule en `error` est planifiée post-Lot C.

## Challenges et observations

- **Dérive d'effort 2.5.2 : +60 % (0,25 j → 0,4 j-dev)**. Cause : l'inventaire des `<main>` page-level a élargi la charge au-delà du simple skip-link. Le tech-spec annonçait l'approche (a) — `<main>` centralisé au layout root — mais l'audit Task 5 a forcé l'approche (b) (`id="main-content"` ajouté à chaque `<main>` existant) à cause du styling métier divergent (`min-h-screen kraft`, `flex-1 max-w-3xl`, `flex items-center justify-center`). Décision techniquement saine mais sous-estimée au cadrage.
- **Dérive d'effort 2.5.5 : +33 % (0,75 j → 1 j-dev)**. Cause double : (1) divergence interne du tech-spec entre la synthèse « Solution » (0,75 j) et le détail des Tasks 15+16+17 (1 j) ; (2) la propagation aux 4 fichiers usagers (`login`, `register-form`, `forgot-password`, `reset-password`) et le test VoiceOver élargi (cas mixte requis/optionnel sur `/register?role=accompagnante`) absorbent du temps non comptabilisé. Total Lot A : **3,5 j-dev livrés vs 3,25 j prévus** (+8 %).
- **Pattern à retenir** : les stories de **refonte de composant primitif diffusé** (2.5.5) et de **modification structurelle multi-fichiers** (2.5.2) sont systématiquement sous-cadrées. Pour le Lot B / Lot C, prévoir une étape « inventaire des points d'usage » formalisée dans le tech-spec (avec décompte explicite des fichiers usagers) avant figeage de l'estimation.
- **Tests automatisés a11y absents** : `@axe-core/playwright` mentionné dans le NFR PRD comme outillage cible n'a pas été mis en place dans le Lot A (hors périmètre). À planifier en début de Lot B sinon le NFR « 0 violation Critical/Serious sur les 6 parcours critiques » restera non vérifié automatiquement.
- **Aucune session multi-agent type Blind/Edge/Acceptance Hunter** sur les stories 2.5.x, contrairement à la 2.3. Pas de manque ressenti — le couple lint a11y + test lecteur d'écran couvre l'essentiel. À reconsidérer si une story Lot B introduit des composants ARIA complexes (dialog modal, combobox, treeview).

## Décisions prises pendant le mini-épic

- **D1 (2.5.1)** : baseline en mode `warn` + wrapper `lint:a11y-check` qui compare le compteur total. Bascule `error` reportée à la fin du Lot C. Acté dans `eslint.config.js` et `package.json`.
- **D2 (2.5.1)** : regénération du baseline non verrouillée techniquement (CODEOWNERS / diff vs main). Garde-fou social dans le header du fichier baseline et de `build-a11y-baseline.mjs` : « Ne pas regénérer pour faire passer la CI sans justification dans le PR ». Acceptable à l'échelle solo, à reévaluer si l'équipe grossit.
- **D3 (2.5.2)** : approche (b) du tech-spec retenue (`id="main-content"` sur les `<main>` existants page-level) plutôt que centralisation au layout root, à cause du styling métier divergent. Audit Task 5 garantit la couverture.
- **D4 (Lot A global)** : pattern de double commit `livraison` puis `statut done apres CI Vercel verte` adopté comme convention de projet. À reproduire sur les Lots B et C.

## Action items reportés

- **AI-1** : mettre en place `@axe-core/playwright` sur les 6 parcours critiques avant de démarrer le Lot B. Owner : Sylvain. Bloquant pour la conformité NFR.
- **AI-2** : ajouter une section « Inventaire des points d'usage » au template tech-spec / story dès qu'une refonte de composant primitif ou une modification multi-fichiers est en jeu. Owner : Sylvain (à intégrer au prochain `bmad-create-story`).
- **AI-3** : planifier la bascule `eslint-plugin-jsx-a11y` `warn` → `error` après livraison Lot C. À ce stade, le baseline doit être à 0. Owner : Sylvain.
- **AI-4** : décider du périmètre Lot B (formulaires complets : labels manquants restants, gestion d'erreurs, ARIA states) vs Lot C (composants complexes : modales, toasts, region live messagerie). Aucun document de cadrage n'existe pour le moment.

## Statut de clôture

- Mini-épic 2.5 (Lot A) : **complet**, 6/6 stories à `done`.
- Baseline a11y : **158** (vs 160 initial). Première baisse historique.
- DoD a11y : opérationnelle et appliquée sur les 6 stories.
- CI Vercel : verte sur `main` après merge 2.5.6.
- TypeScript : 0 erreur.
- Pattern `review` → `done` : tenu sur les 6 stories.

## Prochain mini-épic / Lot B

**Non défini formellement**. Aucun fichier `tech-spec-lot-b-a11y.md` dans `_bmad-output/planning-artifacts/`. Les pré-requis identifiés :

1. **Cadrage Lot B** : choisir entre poursuite formulaires (gestion erreurs, validations, toasts) ou attaque composants complexes (modales, messagerie live region).
2. **Mise en place axe-core/playwright** (AI-1) : pré-requis technique avant de pouvoir mesurer l'impact des stories Lot B sur les parcours critiques.
3. **PRD à jour** : la modification non commitée `_bmad-output/planning-artifacts/prd.md` (NFR a11y étendu) reste en working tree — à committer avant cadrage Lot B pour que les futures stories y fassent référence.

**Recommandation** : avant de démarrer le Lot B, lancer un `bmad-create-architecture` léger ou une rédaction directe de `tech-spec-lot-b-a11y.md`, en intégrant la règle « inventaire des points d'usage » (AI-2) au cadrage.

## Notes de session

- Rétro produite à la demande du Project Lead immédiatement après le merge de 2.5.6 sur `main` et la bascule de la story à `done`.
- Format condensé volontaire (pas de party-mode, pas de dialogue multi-agent), aligné sur la rétro Epic 2 du 2026-05-04.
- Points appuyés explicitement à la demande : baisse baseline 160→158, pattern `review` → `done` après CI Vercel verte, dérives 2.5.2 et 2.5.5, DoD a11y comme garde-fou.
- Aucun `sprint-status.yaml` existant — la mise à jour automatique `epic-X-retrospective: done` du workflow ne s'applique pas. Ce fichier de rétro fait office de marqueur de clôture.
