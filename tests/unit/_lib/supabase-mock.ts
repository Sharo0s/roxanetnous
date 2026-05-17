// Helper test unit Story 9.A.1 : mock Supabase chainable discriminant par nom de table.
// Hérite directement du pattern `buildCronFromMock` introduit en story 8.A.3
// (`tests/unit/parrainage-symetrie.test.ts` lignes 482-520) et le généralise.
//
// Pourquoi : un dispatcher séquentiel positionnel (`callIdx++` sur `tables[]`)
// laisse passer silencieusement un refactor qui inverserait l'ordre des appels
// `supabase.from('users')` / `supabase.from('subscriptions')` -- les tests
// continuent à passer en injectant la mauvaise donnée dans la mauvaise
// branche. Ici, chaque réponse est seedée sous la clé `table_name`, et le
// dispatcher consomme un index par table indépendamment des appels intercalés.
//
// Voir tests/unit/supabase-mock.test.ts pour les garanties testées (AC8 a-f).

import { vi, type Mock } from 'vitest'

export type TableName =
  | 'users'
  | 'subscriptions'
  | 'parrainages'
  | 'parrainages_codes'
  | 'accompagnants_profiles'
  | 'admin_actions_log'
  | 'notifications_log'
  | 'departements_ouverts'
  | 'recherches_stockees'
  | 'annonces'
  | (string & {})

export type SupabaseMockResponse = { data: unknown; error: null }

export type SupabaseMockResponses = Partial<Record<TableName, SupabaseMockResponse[]>>

export type CreateSupabaseFromMockResult = {
  fromMock: Mock<(table: string) => SupabaseChainable>
  calls: string[]
  capturedInserts: Record<string, unknown[]>
  capturedUpdates: Array<{ table: string; payload: unknown }>
}

// Chaîne minimale exposée par le helper — proche d'un PostgrestQueryBuilder
// sans les types stricts (les tests consomment ce que les call sites de
// `app/actions/parrainage.ts` et du cron `confirm-parrainages` chaînent).
type SupabaseChainable = {
  select: Mock
  eq: Mock
  neq: Mock
  not: Mock
  is: Mock
  in: Mock
  order: Mock
  limit: Mock
  lte: Mock
  gte: Mock
  then: (resolve: (value: SupabaseMockResponse) => unknown) => unknown
  single: Mock
  maybeSingle: Mock
  update: Mock
  insert: Mock
}

const emptyResponse = (): SupabaseMockResponse => ({ data: null, error: null })

export function createSupabaseFromMock(
  responses: SupabaseMockResponses = {},
): CreateSupabaseFromMockResult {
  const indices: Record<string, number> = {}
  const calls: string[] = []
  const capturedInserts: Record<string, unknown[]> = {}
  const capturedUpdates: Array<{ table: string; payload: unknown }> = []

  const fromMock = vi.fn((table: string) => {
    calls.push(table)
    indices[table] = indices[table] ?? 0
    const pool = (responses as Record<string, SupabaseMockResponse[] | undefined>)[table] ?? []
    const item = pool[indices[table]++] ?? emptyResponse()

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      // limit est dual-usage : terminal dans le cron (await .select().lte().limit())
      // ET chainable dans les server actions (.limit(1).maybeSingle()).
      // mockReturnThis() gère le chaînage ; then() sur le builder rend awaitable
      // sans terminal explicite.
      limit: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      // then() rend le builder lui-même awaitable (pour `await ...limit(n)` sans
      // terminal .maybeSingle()).
      then: (resolve: (value: SupabaseMockResponse) => unknown) => resolve(item),
      single: vi.fn().mockResolvedValue(item),
      maybeSingle: vi.fn().mockResolvedValue(item),
      update: vi.fn((payload: unknown) => {
        capturedUpdates.push({ table, payload })
        return {
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue(item),
          select: vi.fn().mockResolvedValue(item),
        }
      }),
      insert: vi.fn((payload: unknown) => {
        capturedInserts[table] = capturedInserts[table] ?? []
        capturedInserts[table].push(payload)
        // Double usage : (a) Promise directe pour `admin_actions_log` etc.
        // (b) chaîne `.select().single()` pour `parrainages` qui récupère l'id.
        const insertResult = {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(item),
          maybeSingle: vi.fn().mockResolvedValue(item),
          then: (resolve: (value: SupabaseMockResponse) => unknown) => resolve(item),
        }
        return insertResult
      }),
    }
  })

  return { fromMock, calls, capturedInserts, capturedUpdates }
}
