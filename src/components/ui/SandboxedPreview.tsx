import { useEffect, useState } from 'preact/hooks';
import { PREVIEW_CSS } from '../../lib/preview-css.ts';
import { sanitizeHtml } from '../../lib/sanitize.ts';

interface Props {
  /** Untrusted HTML, e.g. rendered Markdown or an email body. */
  html: string;
  title: string;
  class?: string;
}

/**
 * Renders untrusted HTML in an iframe with an empty sandbox (no scripts, no
 * same-origin access, no forms, no top navigation), after sanitizing it with
 * DOMPurify and removing remote resources. The iframe also inherits the page
 * CSP. See PLAN.md section 9.5.
 */
export default function SandboxedPreview({ html, title, class: className = 'h-96' }: Props) {
  const [doc, setDoc] = useState('');

  useEffect(() => {
    setDoc(
      `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_CSS}</style></head><body>${sanitizeHtml(html)}</body></html>`,
    );
  }, [html]);

  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={doc}
      referrerpolicy="no-referrer"
      class={`w-full rounded-lg border border-border bg-white ${className}`}
      data-xt="preview"
    />
  );
}
