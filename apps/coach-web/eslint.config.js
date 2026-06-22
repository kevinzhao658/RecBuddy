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
      // Supabase nested-select responses are hard to type without generated DB
      // types (tracked follow-up); surface `any` but don't block the build.
      '@typescript-eslint/no-explicit-any': 'warn',
      // `_`-prefixed bindings are intentionally unused (e.g. destructured props
      // kept for signature/positional reasons).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // A context module unavoidably co-exports its provider component and its
      // `useX` hook; this is an HMR-only optimization, not a correctness rule.
      'react-refresh/only-export-components': 'warn',
      // New (react-hooks v7) opinionated rules that false-positive on idiomatic
      // patterns here: dnd-kit's `setNodeRef` callback-ref spread, and an
      // intentional documented reset-on-close effect. Surface, don't block.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // Backstop for the file-size standard (see CLAUDE.md): ~150 lines is a
      // review-time "split for responsibility?" trigger; this only flags genuine
      // monsters without nagging cohesive files. Warning, never blocks.
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Test files lean on `any` for mocks and intentionally bind unused values,
    // and may run long (many cases); the size backstop doesn't apply.
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
])
