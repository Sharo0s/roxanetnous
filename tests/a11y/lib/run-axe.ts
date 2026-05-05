import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import type { AxeResults, Result, ImpactValue } from 'axe-core'

export type AxeImpact = Extract<ImpactValue, 'critical' | 'serious' | 'moderate' | 'minor'>

export interface RunAxeOptions {
  include?: string | string[]
  exclude?: string | string[]
  tags?: string[]
}

export interface AxeNodeSummary {
  target: string[]
  failureSummary?: string
}

export interface AxeViolationSummary {
  ruleId: string
  impact: AxeImpact | null
  count: number
  help: string
  helpUrl: string
  nodes: AxeNodeSummary[]
}

export interface RunAxeResult {
  raw: AxeResults
  violations: Result[]
  criticalSerious: Result[]
  inapplicable: Result[]
  incomplete: Result[]
}

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag22aa', 'best-practice']

const toSelectorList = (value?: string | string[]): string[] => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export async function runAxe(page: Page, options: RunAxeOptions = {}): Promise<RunAxeResult> {
  let builder = new AxeBuilder({ page }).withTags(options.tags ?? DEFAULT_TAGS)

  for (const selector of toSelectorList(options.include)) {
    builder = builder.include(selector)
  }
  for (const selector of toSelectorList(options.exclude)) {
    builder = builder.exclude(selector)
  }

  const raw = await builder.analyze()

  const criticalSerious = raw.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')

  return {
    raw,
    violations: raw.violations,
    criticalSerious,
    inapplicable: raw.inapplicable,
    incomplete: raw.incomplete,
  }
}

export function formatViolation(v: Result): AxeViolationSummary {
  return {
    ruleId: v.id,
    impact: (v.impact ?? null) as AxeImpact | null,
    count: v.nodes.length,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.map((n) => ({
      target: (Array.isArray(n.target) ? n.target : [n.target]).map((t) => String(t)),
      failureSummary: n.failureSummary ?? undefined,
    })),
  }
}

export function summarizeCriticalSerious(violations: Result[]): AxeViolationSummary[] {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map(formatViolation)
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId))
}
