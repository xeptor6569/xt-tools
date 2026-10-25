/// <reference types="astro/client" />

/** Build version, injected by astro.config.ts from the VERSION env var. */
declare const __XT_VERSION__: string;

/** Calendar date of the build (`YYYY-MM-DD`). Drives the "New" badge. */
declare const __XT_BUILD_DATE__: string;
