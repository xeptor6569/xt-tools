/**
 * OpenPGP.js 6 throws from `getWebCrypto()` at module load when `crypto.subtle`
 * is missing. Container e2e serves the site over plain HTTP (`http://site:8080`),
 * which is not a secure context, so importing the browser bundle crashes the
 * worker before a passphrase decrypt can run.
 *
 * The rest of the library already treats a missing WebCrypto result as "use the
 * bundled noble/nacl fallback", but the Curve25519 paths only take that fallback
 * when the error is named `NotSupportedError`. Calling a method on the missing
 * object throws `TypeError` instead, including while a new key signs itself.
 * This rewrite matches both the minified browser bundle Vite ships and the
 * unminified build.
 */
const PLAIN_HTTP_GUARDS = 7;

export function patchOpenPgpPlainHttp(code: string): string {
  if (!code.includes('The WebCrypto API is not available')) return code;

  let next = code.replace(
    /if\(!t\)throw Error\((["'`])The WebCrypto API is not available\1\);return t/g,
    'if(!t)return;return t',
  );
  next = next.replace(/throw new Error\((["'`])The WebCrypto API is not available\1\);/g, 'return undefined;');
  if (next.includes('The WebCrypto API is not available')) {
    throw new Error('OpenPGP WebCrypto guard did not match this build.');
  }

  let guards = 0;
  next = next.replace(
    /try\{const ([A-Za-z$_][\w$]*)=([A-Za-z$_][\w$]*)\.getWebCrypto\(\),/g,
    (_match: string, binding: string, owner: string) => {
      guards++;
      return `try{const ${binding}=${owner}.getWebCrypto();if(!${binding})throw{name:"NotSupportedError"};const `;
    },
  );
  next = next.replaceAll(
    '                const webCrypto = util.getWebCrypto();\n',
    "                const webCrypto = util.getWebCrypto();\n                if (!webCrypto) { const missing = new Error('WebCrypto unavailable'); missing.name = 'NotSupportedError'; throw missing; }\n",
  );
  guards += (next.match(/missing\.name = 'NotSupportedError'/g) ?? []).length;
  if (guards !== PLAIN_HTTP_GUARDS) {
    throw new Error(`OpenPGP plain-HTTP patch expected ${PLAIN_HTTP_GUARDS} WebCrypto guards, found ${guards}.`);
  }

  // AES-KW caches WebCrypto at module scope and only falls back when the
  // thrown error is named NotSupportedError. A missing cache is a TypeError.
  const missingSubtle = 'new Proxy({},{get:()=>()=>{throw{name:"NotSupportedError"}}})';
  if (next.includes('const Cr=N.getWebCrypto();')) {
    next = next.replace('const Cr=N.getWebCrypto();', `const Cr=N.getWebCrypto()||${missingSubtle};`);
  } else if (next.includes('const webCrypto$6 = util.getWebCrypto();')) {
    next = next.replace(
      'const webCrypto$6 = util.getWebCrypto();',
      `const webCrypto$6 = util.getWebCrypto() || ${missingSubtle};`,
    );
  } else {
    throw new Error('OpenPGP AES-KW WebCrypto cache was not found.');
  }
  return next;
}
