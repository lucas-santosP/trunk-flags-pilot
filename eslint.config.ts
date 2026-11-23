import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', '.wrangler'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      curly: ['error', 'all'],
      'func-style': ['error', 'declaration'],
      'id-length': ['error', { min: 2, exceptions: ['e'], properties: 'never' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/flags/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: '__FLAGS__',
          message: 'Leia flags apenas via useFlag/isFlagEnabled/<Feature> de src/flags.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/flags/*.json'],
              message: 'Leia flags apenas via useFlag/isFlagEnabled/<Feature> de src/flags.',
            },
          ],
        },
      ],
    },
  },
)
