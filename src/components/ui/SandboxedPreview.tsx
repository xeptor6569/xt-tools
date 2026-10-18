import DOMPurify from 'dompurify';
import { useEffect, useState } from 'preact/hooks';
import { href } from '../../lib/href.ts';

interface Props {
  /** Untrusted HTML, e.g. rendered Markdown or an email body. */
  html: string;
  title: string;
  class?: string;
}

/**
 * Renders untrusted HTML in an iframe with an empty sandbox (no scripts, no
 * same-origin access, no forms, no top navigation), after sanitizing it with
 * DOMPurify. The iframe inherits the page CSP, so remote images, fonts and
 * tracking pixels are blocked too. See PLAN.md section 9.5.
 */
export default function SandboxedPreview({ html, title, class: className = 'h-96' }: Props) {
  const [doc, setDoc] = useState('');

  useEffect(() => {
    const clean = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true, svg: true },
      FORBID_TAGS: ['style', 'form'],
      FORBID_ATTR: ['style'],
    });
    setDoc(
      `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${href('preview.css')}"></head><body>${clean}</body></html>`,
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
