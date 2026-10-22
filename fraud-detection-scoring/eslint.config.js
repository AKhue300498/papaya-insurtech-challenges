import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '*.min.js',
      '.agents/**',
      '.specify/**',
      'tmp/**',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
];
