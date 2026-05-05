# Instructions projet roxanetnous

## Regles strictes

- **Pas d'emojis** dans le code ni les interfaces.
- **Accessibilite (a11y)** : toute story avec impact UI doit valider la checklist DoD a11y avant merge (labels, focus, contrastes, ARIA, clavier, lecteur d'ecran). Voir `.claude/skills/bmad-create-story/template.md`. La CI Vercel bloque toute regression `eslint-plugin-jsx-a11y` au-dela du baseline (`npm run lint:a11y-check`). En complement, executer `npm run a11y:axe:check` localement avant merge pour valider le baseline dynamique axe-core (6 parcours critiques, voir `tests/a11y/README.md`).

## Contexte technique

- Stack : Next.js 16 + Supabase + TypeScript + TailwindCSS v4
- Package type : ESM ("type": "module")
- Supabase MCP connecte pour les operations BDD
- Les documents bmad dans _bmad-output/ sont la spec initiale mais DECISIONS.md fait autorite en cas de contradiction.
