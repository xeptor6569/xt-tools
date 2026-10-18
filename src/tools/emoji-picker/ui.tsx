import { useEffect, useMemo, useState } from 'preact/hooks';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { copyText } from '../../lib/clipboard.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { loadEmoji, type Emoji, type EmojiData } from './data.ts';
import { codePoints, searchEmoji, withSkin } from './logic.ts';

const TONES = [
  { value: '0', label: 'Default' },
  { value: '1', label: 'Light' },
  { value: '2', label: 'Medium-light' },
  { value: '3', label: 'Medium' },
  { value: '4', label: 'Medium-dark' },
  { value: '5', label: 'Dark' },
];
const PAGE = 400;

export default function EmojiPickerTool() {
  const [data, setData] = useState<EmojiData>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [tone, setTone] = useState('0');
  const [selected, setSelected] = useState<Emoji>();
  const [limit, setLimit] = useState(PAGE);
  const [status, setStatus] = useState('');
  const q = useDebounced(query, 100);

  useEffect(() => {
    loadEmoji().then(setData, (e: unknown) => setError(errorMessage(e)));
  }, []);
  useEffect(() => setLimit(PAGE), [q, group]);

  const matches = useMemo(
    () => (data ? searchEmoji(data.emoji, q, group === 'all' ? undefined : Number(group)) : []),
    [data, q, group],
  );
  const shown = matches.slice(0, limit);
  const current = selected ? withSkin(selected, Number(tone)) : '';

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <div class="min-w-64 flex-1">
          <Input
            label="Search"
            type="search"
            value={query}
            onValue={setQuery}
            placeholder="heart, :rocket:, thumbs up…"
            data-xt="input"
          />
        </div>
        <Select
          label="Group"
          value={group}
          options={[
            { value: 'all', label: 'All groups' },
            ...(data?.groups.map((g) => ({ value: String(g.id), label: g.label })) ?? []),
          ]}
          onValue={setGroup}
        />
        <Select label="Skin tone" value={tone} options={TONES} onValue={setTone} />
      </div>
      <OutputRegion label="Emoji" busy={!data && !error}>
        {!data && !error && <LoadingState label="Loading emoji…" />}
        {data && (
          <>
            <p class="text-sm text-muted">
              {matches.length} emoji. Click one to copy it.{' '}
              <span role="status" class="text-fg">
                {status}
              </span>
            </p>
            <ul class="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1" aria-label="Matching emoji">
              {shown.map((e) => {
                const ch = withSkin(e, Number(tone));
                return (
                  <li key={e.hexcode}>
                    <button
                      type="button"
                      title={e.label}
                      aria-label={e.label}
                      class="flex size-12 items-center justify-center rounded-md text-2xl hover:bg-surface"
                      onClick={async () => {
                        setSelected(e);
                        setStatus((await copyText(ch)) ? `Copied ${e.label}.` : 'Copy failed.');
                      }}
                    >
                      {ch}
                    </button>
                  </li>
                );
              })}
            </ul>
            {matches.length > limit && (
              <div>
                <button type="button" class="text-sm text-accent underline" onClick={() => setLimit((l) => l + PAGE)}>
                  Show more ({matches.length - limit} left)
                </button>
              </div>
            )}
          </>
        )}
        {selected && (
          <div class="flex flex-col gap-2">
            <p class="text-5xl" aria-hidden="true">
              {current}
            </p>
            <KeyValueList
              items={[
                { label: 'Emoji', value: current },
                { label: 'Name', value: selected.label, mono: false },
                { label: 'Code points', value: codePoints(current) },
                ...(selected.shortcodes.length ? [{ label: 'Shortcode', value: `:${selected.shortcodes[0]}:` }] : []),
                {
                  label: 'HTML',
                  value: [...current].map((c) => `&#x${(c.codePointAt(0) ?? 0).toString(16)};`).join(''),
                },
              ]}
            />
            <div>
              <CopyButton text={current} label="Copy emoji" />
            </div>
          </div>
        )}
        <ErrorMessage message={error} />
      </OutputRegion>
      <p class="text-xs text-muted">Emoji data: Emojibase (MIT). How emoji look depends on your device’s fonts.</p>
    </div>
  );
}
