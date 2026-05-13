# Instructions projet roxanetnous

## Regles strictes

- **Pas d'emojis** dans le code ni les interfaces.
- **Accessibilite (a11y)** : toute story avec impact UI doit valider la checklist DoD a11y avant merge (labels, focus, contrastes, ARIA, clavier, lecteur d'ecran). Voir `.claude/skills/bmad-create-story/template.md`. La CI Vercel bloque toute regression `eslint-plugin-jsx-a11y` au-dela du baseline (`npm run lint:a11y-check`). Avant tout commit livraison story (`Story X.Y.Z : ...`), **executer `npm run a11y:axe:check` localement et confirmer exit 0** (baseline 0 violations Critical/Serious sur 7 parcours critiques, voir `tests/a11y/README.md`). Tout commit livraison story sans cette validation est rejete au code review.
- **Genre du mot "accompagnant"** : dans toute nouvelle copy UI (libelles, messages, emails, helper text) ET dans toute proposition de texte presentee a l'utilisateur, utiliser **systematiquement le masculin neutre** : "un accompagnant", "accompagnant valide", "les accompagnants". Ne JAMAIS proposer ni ecrire "accompagnante" / "accompagnantes" dans la copy nouvelle ou reformulee, meme si du texte existant alentour est au feminin. Le code metier historique (`role === 'accompagnante'`, routes `/accompagnante/*`, colonnes BDD `accompagnante_id`) reste au feminin par dette technique et fera l'objet d'un renommage global dedie ; ne pas le toucher au fil de l'eau.

## Contexte technique

- Stack : Next.js 16 + Supabase + TypeScript + TailwindCSS v4
- Package type : ESM ("type": "module")
- Supabase MCP connecte pour les operations BDD
- Les documents bmad dans _bmad-output/ sont la spec initiale mais DECISIONS.md fait autorite en cas de contradiction.
