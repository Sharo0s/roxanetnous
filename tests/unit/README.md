# tests/unit

Tests unitaires Vitest (sans Supabase ni dépendance BDD réelle). Tous les
mocks de modules (`@/lib/...`, `@sentry/nextjs`, `next/server`, etc.) sont
définis dans chaque fichier de test via `vi.mock(...)` + `vi.hoisted(...)`.

Lancer la suite :

```bash
npm run test:unit
```

## Helpers — Mocks Supabase

### `createSupabaseFromMock` (`./_lib/supabase-mock.ts`)

Helper de mock pour le client Supabase qui **discrimine par nom de table**.
À utiliser à la place du dispatcher séquentiel positionnel
(`callIdx++ sur un tableau de réponses ordonnées`) qui laisse passer
silencieusement un refactor de l'ordre des `supabase.from(...)` du code
applicatif.

Import :

```ts
import { createSupabaseFromMock } from './_lib/supabase-mock'
```

Usage minimal — 2 tables `users` + `subscriptions` :

```ts
const { fromMock, calls, capturedInserts, capturedUpdates } = createSupabaseFromMock({
  users: [
    { data: { role: 'accompagne', first_name: 'Alice' }, error: null },
  ],
  subscriptions: [
    { data: { status: 'active' }, error: null },
  ],
})

mockCreateClient.mockResolvedValue({ from: fromMock, rpc })
```

Le helper retourne :

- `fromMock` — la fonction `vi.fn((table: string) => chainableBuilder)` à
  brancher sur le mock du client Supabase.
- `calls: string[]` — liste ordonnée des noms de table passés à `from(...)`.
  Utile pour `expect(fromMock).toHaveBeenCalledWith('accompagnants_profiles')`
  ou `expect(calls).toEqual([...])`.
- `capturedInserts: Record<string, unknown[]>` — payloads des `.insert(...)`
  groupés par table. Idéal pour `admin_actions_log`.
- `capturedUpdates: Array<{ table, payload }>` — payloads des `.update(...)`
  avec le nom de la table source.

Chaque pool de réponses par table est consommé dans l'ordre par appels
successifs `from('table')`. Pool épuisé ou table absente de `responses` →
`{ data: null, error: null }` (compatible `.maybeSingle()` / `.single()` /
`.limit()`).

### Différence avec le pattern dispatcher positionnel

L'ancien pattern utilisait `let callIdx = 0` + un tableau ordonné
`tables[]` indexé par compteur global, ignorant complètement le nom de la
table demandée. Un refactor qui inversait `from('users')` et
`from('subscriptions')` dans le code applicatif faisait silencieusement
passer les tests avec la mauvaise réponse injectée dans la mauvaise
branche. Le helper supprime ce piège en exigeant une clé par nom de table.

Exemple de référence en migration complète :
[`tests/unit/parrainage-symetrie.test.ts`](./parrainage-symetrie.test.ts)
(scénarios SC1–SC5 et SC8–SC11).
