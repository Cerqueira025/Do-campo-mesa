import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    'backoffice/app/vendor/**',
    'backoffice/app/storage/**',
    'backoffice/app/bootstrap/cache/**',
    'backoffice/app/public/build/**',
  ]),
  {
    files: [
      'api/**/*.js',
      'backoffice/app/vite.config.js',
      '*.config.mjs',
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['backoffice/app/resources/js/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
