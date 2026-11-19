/**
 * ESLint (flat config) — `npm run lint`.
 * Extension code runs in the browser (pages, content scripts, service worker);
 * tests and scripts run in Node.
 */

import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'dist/', 'tests/e2e/fixtures/.build/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions, ...globals.serviceworker },
    },
  },
  {
    files: ['src/content/loader.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    files: ['tests/**/*.{js,cjs}', 'scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node, ...globals.browser, chrome: 'readonly', aiRouter: 'readonly' },
    },
  },
  {
    files: ['tests/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    files: ['tests/e2e/fixtures/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'object-shorthand': 'error',
      'no-console': ['error', { allow: ['debug', 'info', 'warn', 'error'] }],
    },
  },
];
