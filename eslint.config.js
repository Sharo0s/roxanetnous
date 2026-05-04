import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'

const a11yRecommendedRulesRaw =
  jsxA11y.flatConfigs?.recommended?.rules ??
  jsxA11y.configs?.recommended?.rules

if (!a11yRecommendedRulesRaw || Object.keys(a11yRecommendedRulesRaw).length === 0) {
  throw new Error(
    'eslint-plugin-jsx-a11y: cannot resolve recommended rules. ' +
      'Plugin export shape may have changed (check flatConfigs.recommended.rules / configs.recommended.rules).',
  )
}

const a11yRecommendedRules = Object.fromEntries(
  Object.entries(a11yRecommendedRulesRaw).map(([rule, value]) => {
    if (Array.isArray(value)) {
      return [rule, ['warn', ...value.slice(1)]]
    }
    return [rule, 'warn']
  }),
)

const downgradeErrorsToWarn = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([rule, value]) => {
      if (Array.isArray(value)) {
        const [level, ...rest] = value
        return [rule, [level === 'error' || level === 2 ? 'warn' : level, ...rest]]
      }
      if (value === 'error' || value === 2) return [rule, 'warn']
      return [rule, value]
    }),
  )

const jsRecommendedDowngraded = {
  ...js.configs.recommended,
  rules: downgradeErrorsToWarn(js.configs.recommended.rules ?? {}),
}

const tsRecommendedDowngraded = tseslint.configs.recommended.map((cfg) =>
  cfg.rules ? { ...cfg, rules: downgradeErrorsToWarn(cfg.rules) } : cfg,
)

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '_bmad-output/**',
      '_bmad/**',
      'public/**',
      '.vercel/**',
      'supabase/migrations/**',
      'next-env.d.ts',
    ],
  },
  jsRecommendedDowngraded,
  ...tsRecommendedDowngraded,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        global: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        FormData: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
    },
    rules: {
      ...a11yRecommendedRules,
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
