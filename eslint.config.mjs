import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    'backoffice/vendor/**',
    'backoffice/storage/**',
    'backoffice/bootstrap/cache/**',
    'backoffice/public/build/**',
  ]),
  {
    files: [
      'api/**/*.js',
      'backoffice/vite.config.js',
      '*.config.mjs',
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['backoffice/resources/js/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
