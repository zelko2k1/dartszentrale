import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // eslint-plugin-react-hooks v7 bringt React-Compiler-Advisories als Fehler mit.
      // Wir setzen den React Compiler (noch) nicht ein – das sind Optimierungs-Hinweise,
      // keine Korrektheits-Bugs → als Warnungen statt Fehler. rules-of-hooks bleibt Fehler.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      // Unterstrich-Präfix = absichtlich ungenutzt (Standard-Konvention, z. B. Positionsargumente
      // wie in den QR-Maskenfunktionen (r, _c) oder ignorierte catch-Fehler).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
])
