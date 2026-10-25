import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { robotsSitemap } from './logic.ts';
import meta from './meta.ts';

export default function RobotsSitemapTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => robotsSitemap(input)), [input]);

  return (
    <TwoPane
      inputLabel="Directives and URLs"
      inputPlaceholder={'User-agent: *\nDisallow: /private\nhttps://…'}
      input={input}
      onInput={setInput}
      outputLabel="robots.txt and sitemap.xml"
      output={result.output ?? ''}
      error={result.error}
      controls={
        <p class="text-sm text-muted">
          One directive per line (User-agent, Allow, Disallow, Sitemap, Crawl-delay). Any other line that is an http or
          https URL becomes a sitemap entry.
        </p>
      }
      examples={meta.examples}
    />
  );
}
