// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import pluginSecurity from 'eslint-plugin-security'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import globals from 'globals'

export default tseslint.config(
  // Global ignores (replaces ignorePatterns)
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.js']
  },

  // Base configs
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // React plugin
  {
    files: ['**/*.{ts,tsx}'],
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat['jsx-runtime'],
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.node
      },
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },

  // React Hooks (only the two classic rules, not the React Compiler rules added in v7)
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },

  // Security
  pluginSecurity.configs.recommended,

  // Custom rules
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      'security/detect-object-injection': 'off'
    }
  },

  // File-specific overrides
  {
    files: ['src/main/services/**/*.ts', 'src/main/ipc/**/*.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off'
    }
  },

  // Prettier must be last
  eslintConfigPrettier
)
