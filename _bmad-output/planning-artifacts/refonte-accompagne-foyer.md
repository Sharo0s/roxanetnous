# Refonte UI espace accompagne - direction "Le foyer"

Feuille de route pour la refonte de l'espace `/accompagne/*` apres livraison de l'espace `/accompagnante/*` le 2026-05-11.

## Contexte

L'espace accompagnante (9 pages + 3 pages partagees) a deja ete refondu selon la direction "Le foyer" : fond `#fefaf8` (page) + `#faf7f2` (header), titres Playfair italic, cartes `rounded-2xl border-[#e8dfd2]`, boutons en pill kraft, tuiles asymetriques sur le dashboard.

L'espace accompagne doit suivre la meme charte pour rester coherent. La memoire `project_refonte_accompagnante_foyer.md` documente tous les patterns, garde-fous et decisions prises.

## Pages a refondre (7 au total)

1. `app/accompagne/dashboard/page.tsx`
2. `app/accompagne/profil/page.tsx`
3. `app/accompagne/annonces/page.tsx` (liste)
4. `app/accompagne/annonces/nouvelle/page.tsx`
5. `app/accompagne/annonces/[id]/modifier/page.tsx`
6. `app/accompagne/abonnement/page.tsx`
7. `app/accompagne/abonnement/success/page.tsx`

## Pages partagees deja partiellement refondues a harmoniser

Ces pages ont deja recu le style foyer sur leur contenu (cartes, listes), mais leur header cote accompagne reste l'ancien `AccompagneHeader`. A harmoniser :

- `/messages` -- liste conversations au style foyer, header `AccompagneHeader` a remplacer
- `/messages/[id]` -- bandeau interlocuteur au style foyer, header `AccompagneHeader` a remplacer
- `/recherche/demandes` -- cartes annonces au style foyer (header public reste comme ca)
- `/accompagne/abonnement` -- `SubscriptionPageContent` deja restyle, mais wrapper accompagne en `bg-kraft` + `h1 font-bold`

## Strategie suggeree

### Etape 1 : Creer `AccompagneDashboardHeader` (composant)
Fichier : `components/layout/accompagne-dashboard-header.tsx`

Symetrique a `AccompagnanteDashboardHeader` mais adapte aux routes accompagne :
- Liens nav : Accueil (`/accompagne/dashboard`), Annonces (`/accompagne/annonces`), Recherche (`/recherche`), Messages (`/messages` avec badge), Favoris (`/favoris`), Profil (`/accompagne/profil`)
- Meme style : fond `bg-[#faf7f2]`, soulignement kraft sur lien actif, badge messages kraft
- Meme prop API : `firstName`, `lastName`, `unreadCount`, `currentPage`
- Type `currentPage` : `'dashboard' | 'annonces' | 'recherche' | 'messages' | 'favoris' | 'profil' | 'abonnement' | 'other'`

### Etape 2 : Refondre les 7 pages /accompagne/* une par une
Methodologie identique a l'accompagnante (memoire le decrit) :
1. Lire la page actuelle
2. Creer un mockup HTML dans `_mockups-dashboard-accompagnante/foyer/accompagne-<page>.html` pour validation visuelle
3. Attendre validation Sylvain
4. Implementer en preservant : server actions, branches conditionnelles, composants partages
5. Verifier : `npx tsc --noEmit && npm run lint && npm run lint:a11y-check && npm run build` exit 0

### Etape 3 : Harmoniser les pages partagees
- `/messages` et `/messages/[id]` : remplacer `<AccompagneHeader>` par `<AccompagneDashboardHeader>` (le conditionnel role est deja en place, juste le composant change)
- `/accompagne/abonnement` : appliquer le pattern wrapper de `/accompagnante/abonnement` (eyebrow + h1 italic centre + footer coherent)

## Patterns a appliquer (rappel)

Reprendre les patterns documentes dans `project_refonte_accompagnante_foyer.md` :

1. `<main className="min-h-screen bg-[#fefaf8] focus:outline-none">`
2. `<AccompagneDashboardHeader firstName lastName unreadCount currentPage="..." />`
3. Conteneur : `max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10` (sauf liste annonces : `max-w-4xl`)
4. Titre page : eyebrow uppercase tracking + h1 Playfair italic centre + sous-titre optionnel
5. Cartes : `bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition`
6. Boutons primaires : pill `rounded-full bg-accent border border-accent hover:bg-kraft hover:border-kraft`
7. Footer en fin de page : `Aide · Confidentialite · Conditions · LogoutButton`

## Garde-fous critiques

- **Pas de modification du composant `AccompagneHeader` existant** (utilise par 14+ pages non refondues, ne pas casser)
- **A11y baseline** : `npm run lint:a11y-check` doit rester a 155 violations
- **Build** : `npm run build` doit passer (52 pages generees)
- **Pas de changement de schema DB, server actions, middleware, redirects**
- **Masculinisation deja faite** : tous nouveaux textes ajoutes doivent etre au masculin (accompagnant, accompagne, filleul, parrain, valide, etc.) sauf accord avec un nom feminin (annonce publiee)
- **Verts semantiques autorises** : Sylvain a valide les indicateurs verts pour les statuts OK (point vert "valide", badge vert "Publie", barre verte filleul valide). Pas d'autre couleur primaire.
- **Format commits projet** : phrase simple sans emoji ni accents, pas de prefix conventional commits, Co-Authored-By Claude

## Composants partages a NE PAS toucher

Liste deja documentee dans la memoire :
- `AccompagneHeader` (pour eviter de casser les pages non refondues)
- `AccompagnanteHeader` (idem cote accompagnante)
- Tous les formulaires (`AccompagnanteProfileForm`, `NouvelleAnnonceForm`, etc.) et `OnboardingClient`
- `ChatWindow`, `CancelModal`, `ExportDataButton`, `DeleteAccountButton`, `LogoutButton`

## Commits attendus

Suivre la structure des 4 commits accompagnante :
1. Composant `AccompagneDashboardHeader` cree (1 fichier)
2. Refonte des 7 pages /accompagne/* + harmonisation pages partagees (10-12 fichiers)
3. Eventuels ajustements visuels apres premier passage

## Liens utiles

- Memoire principale : `~/.claude/projects/-Users-sylvain-Documents-roxanetnous/memory/project_refonte_accompagnante_foyer.md`
- Composants foyer existants : `components/layout/accompagnante-dashboard-header.tsx`, `components/accompagnante/dashboard-portrait.tsx`
- Mockups HTML accompagnante : `_mockups-dashboard-accompagnante/foyer/*.html` (non commits, restent en local pour reference)
- Page exemple refonte accompagnante : `app/accompagnante/dashboard/page.tsx` (post-commit `9e57fac`)
