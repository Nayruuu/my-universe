import eslint from '@eslint/js';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import local from './eslint-rules/index.mjs';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      '.angular',
      'coverage',
      'playwright-report',
      'test-results',
      'blob-report',
      'tools/**',
      'eslint-rules/**',
    ],
  },

  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/component-max-inline-declarations': [
        'error',
        { template: 0, styles: 0, animations: 0 },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
      ],
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'public-decorated-field',
            'protected-decorated-field',
            'private-decorated-field',

            'public-static-field',
            'public-instance-field',

            'protected-static-field',
            'protected-instance-field',

            'private-static-field',
            'private-instance-field',

            'constructor',

            'public-static-method',
            'public-instance-method',

            'protected-static-method',
            'protected-instance-method',

            'private-static-method',
            'private-instance-method',
          ],
        },
      ],
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-namespace': 'off',
      'no-empty-pattern': 'off',
      'newline-before-return': 'error',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },
      ],
    },
  },

  {
    files: ['src/app/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    plugins: { local },
    rules: {
      'local/prefer-signal-primitives': 'error',
    },
  },

  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {
      '@angular-eslint/template/eqeqeq': [
        'error',
        { allowNullOrUndefined: true },
      ],
    },
  },

  prettier,

  {
    files: ['**/*.ts'],
    rules: {
      curly: ['error', 'all'],
    },
  },
);
