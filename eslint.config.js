// ESLint flat config. The no-restricted-* rules enforce the privacy rules in
// PLAN.md section 9.2; don't loosen them to make code pass.
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const networkGlobals = [
  { name: 'fetch', message: 'Network access is banned. Use loadLocalAsset() for same-origin files.' },
  { name: 'XMLHttpRequest', message: 'Network access is banned.' },
  { name: 'WebSocket', message: 'Network access is banned.' },
  { name: 'EventSource', message: 'Network access is banned.' },
  { name: 'RTCPeerConnection', message: 'WebRTC can leak local IP addresses and is banned.' },
  { name: 'webkitRTCPeerConnection', message: 'WebRTC can leak local IP addresses and is banned.' },
];

const restrictedProperties = [
  { object: 'navigator', property: 'sendBeacon', message: 'Network access is banned.' },
  { object: 'window', property: 'fetch', message: 'Network access is banned.' },
  { object: 'globalThis', property: 'fetch', message: 'Network access is banned.' },
  { object: 'self', property: 'fetch', message: 'Network access is banned.' },
  {
    object: 'Math',
    property: 'random',
    message: 'Use crypto.getRandomValues() (or a seeded PRNG where determinism is the point).',
  },
  { object: 'document', property: 'write', message: 'document.write is banned.' },
  { object: 'document', property: 'writeln', message: 'document.writeln is banned.' },
];

const restrictedSyntax = [
  { selector: "CallExpression[callee.name='eval']", message: 'eval is banned (CSP blocks it).' },
  { selector: "NewExpression[callee.name='Function']", message: 'new Function is banned (CSP blocks it).' },
  {
    selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
    message: 'Assigning HTML is banned. Render untrusted content in <SandboxedPreview>.',
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'insertAdjacentHTML is banned. Render untrusted content in <SandboxedPreview>.',
  },
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'dangerouslySetInnerHTML is banned.' },
  {
    selector: "JSXAttribute[name.name='href'] > Literal[value=/^\\u002F(?!\\u002F)/]",
    message: 'Use href() from src/lib/href.ts so links respect the base path.',
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: 'Inline style attributes are blocked by CSP. Use classes or set CSS custom properties from an effect.',
  },
  { selector: 'ImportExpression > Literal[value=/^(https?:)?\\u002F\\u002F/]', message: 'Remote imports are banned.' },
];

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'build/',
      '.astro/',
      'node_modules/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'scripts/templates/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx,astro}'],
    languageOptions: { globals: { ...globals.browser, __XT_VERSION__: 'readonly', __XT_BUILD_DATE__: 'readonly' } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-restricted-globals': ['error', ...networkGlobals],
      'no-restricted-properties': ['error', ...restrictedProperties],
      'no-restricted-syntax': ['error', ...restrictedSyntax],
    },
  },
  {
    files: ['src/**/*.tsx'],
    ...jsxA11y.configs.recommended,
    rules: {
      ...jsxA11y.configs.recommended.rules,
      // Labels are associated with htmlFor/id or by wrapping; both are fine.
      'jsx-a11y-x/label-has-associated-control': ['error', { assert: 'either' }],
    },
  },
  {
    // Pure logic: no DOM, storage or framework.
    files: ['src/tools/*/logic.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...networkGlobals,
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location', 'indexedDB'].map(
          (name) => ({
            name,
            message: 'logic.ts must be pure: no DOM, storage or browser APIs. Move this to ui.tsx.',
          }),
        ),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['preact', 'preact/*', '*.tsx', '**/components/**'],
              message: 'logic.ts must not import UI code.',
            },
          ],
        },
      ],
    },
  },
  {
    // The single sanctioned place for same-origin fetches.
    files: ['src/lib/load-local-asset.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // The single sanctioned place for allowlisted cross-origin lookups.
    files: ['src/lib/network.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // Node scripts and tests run outside the browser and may use the network
    // (e.g. Playwright, refresh-data) and Node globals.
    files: ['scripts/**/*.ts', 'tests/**/*.ts', '*.config.{js,ts}', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
);
