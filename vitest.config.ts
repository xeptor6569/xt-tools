import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'xt-jq-web-factory',
      transform(code, id) {
        if (!id.replace(/\\/g, '/').endsWith('/jq-web/jq.js')) return null;
        return code.replace(
          /jq\s*=\s*jq\(\)\.then\(\s*module\s*=>\s*\{\s*return\s*\{\s*json:\s*module\.json,\s*raw:\s*module\.raw\s*\};\s*\}\s*\);/,
          'const _jqFactory = jq; jq = (moduleArg) => _jqFactory(moduleArg).then(module => ({ json: module.json, raw: module.raw }));',
        );
      },
    },
  ],
  define: {
    __XT_BUILD_DATE__: JSON.stringify('2026-10-24'),
    __XT_VERSION__: JSON.stringify('test'),
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    server: {
      deps: {
        inline: ['jq-web'],
      },
    },
  },
});
