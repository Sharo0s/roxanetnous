# Instructions projet roxanetnous

## Regles strictes

- **Pas de tarif horaire, PCH, APA** : tout ce qui concerne tarif_horaire, modulation_pch, modulation_apa, aide_sociale, tarif_min, tarif_max, tarif_modulable_pch, tarif_modulable_apa est supprime du projet. Ne jamais reintroduire.
- **Design noir et blanc uniquement** : pas de couleurs (pas de primary-600, green, blue, etc.). Uniquement noir, blanc et nuances de gris. Le client n'a pas choisi les couleurs.
- **Pas d'emojis** dans le code ni les interfaces.

## Contexte technique

- Stack : Next.js 16 + Supabase + TypeScript + TailwindCSS v4
- Package type : ESM ("type": "module")
- Supabase MCP connecte pour les operations BDD
- Les documents bmad dans _bmad-output/ sont la spec initiale mais DECISIONS.md fait autorite en cas de contradiction.
