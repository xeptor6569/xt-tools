// Styles for SandboxedPreview and exported documents. Embedded inline (its
// SHA-256 is added to the CSP in astro.config.ts), so previews make no
// request at all and work inside an opaque-origin sandbox.
export const PREVIEW_CSS =
  "html{color-scheme:light}body{margin:0;padding:1rem;font:16px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827;background:#fff;overflow-wrap:anywhere}img,video,svg{max-width:100%;height:auto}pre,code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}pre{padding:.75rem;overflow:auto;background:#f4f5f7;border-radius:6px}table{border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:.25rem .5rem}blockquote{margin:0;padding-left:1rem;border-left:4px solid #d1d5db;color:#4b5563}a{color:#1d4ed8}[data-xt-blocked]{display:inline-block;padding:.25rem .5rem;border:1px dashed #9ca3af;color:#4b5563;font-size:.85em}@media print{body{padding:0}}";
