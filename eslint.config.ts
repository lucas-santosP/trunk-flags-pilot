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
    ignores: ['src/app.tsx'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: '__ENV_PANEL__',
          message:
            'O painel de ambientes só pode ser lido em src/app.tsx, atrás do guard de produção.',
        },
      ],
    },
  },
)
