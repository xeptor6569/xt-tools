import { useEffect, useState } from 'preact/hooks';
import Button from '../ui/Button.tsx';
import Input from '../ui/Input.tsx';
import { toolHref } from '../../lib/href.ts';
import {
  childCollections,
  createCollection,
  renameCollection,
  toggleToolInCollection,
  type PersonalCollection,
  type Pin,
} from '../../lib/library.ts';
import {
  LIBRARY_EVENT,
  deleteStoredCollection,
  loadCollections,
  loadPins,
  saveCollections,
} from '../../lib/library-store.ts';
import { allTools } from '../../tools/registry.ts';
import type { ToolMeta } from '../../tools/types.ts';

function StarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-4"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function readAddTool(tools: readonly ToolMeta[]): string | null {
  const hash = location.hash.replace(/^#/, '');
  if (!hash.startsWith('add-')) return null;
  const id = hash.slice('add-'.length);
  return tools.some((tool) => tool.id === id) ? id : null;
}

export default function CollectionsApp() {
  const tools = allTools();
  const [collections, setCollections] = useState<PersonalCollection[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [addToolId, setAddToolId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [subNames, setSubNames] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setCollections(loadCollections());
      setPins(loadPins());
    };
    const hash = () => setAddToolId(readAddTool(tools));
    refresh();
    hash();
    setReady(true);
    window.addEventListener(LIBRARY_EVENT, refresh);
    window.addEventListener('hashchange', hash);
    return () => {
      window.removeEventListener(LIBRARY_EVENT, refresh);
      window.removeEventListener('hashchange', hash);
    };
  }, [tools]);

  const addTool = tools.find((tool) => tool.id === addToolId);
  const parents = collections.filter((collection) => collection.parentId === null);

  function onCreate(event: { preventDefault(): void }) {
    event.preventDefault();
    const result = createCollection(loadCollections(), name, null);
    if (result.error || !result.id) {
      setError(result.error ?? 'Could not create that collection.');
      return;
    }
    let next = result.collections;
    if (addTool) {
      const added = toggleToolInCollection(next, result.id, addTool.id);
      if (!added.error && added.collections) next = added.collections;
    }
    saveCollections(next);
    setName('');
    setError('');
    setStatus(
      addTool
        ? `Created ${result.collections.at(-1)?.name ?? 'collection'} with ${addTool.name}.`
        : `Created ${result.collections.at(-1)?.name ?? 'collection'}.`,
    );
  }

  function onCreateSub(event: { preventDefault(): void }, parentId: string) {
    event.preventDefault();
    const result = createCollection(loadCollections(), subNames[parentId] ?? '', parentId);
    if (result.error) {
      setError(result.error);
      return;
    }
    saveCollections(result.collections);
    setSubNames((current) => ({ ...current, [parentId]: '' }));
    setError('');
    setStatus('Created a sub-collection.');
  }

  function onRename(event: { preventDefault(): void }, id: string) {
    event.preventDefault();
    const result = renameCollection(loadCollections(), id, draft);
    if (result.error) {
      setError(result.error);
      return;
    }
    saveCollections(result.collections);
    setRenaming(null);
    setError('');
    setStatus('Renamed the collection.');
  }

  function onDelete(id: string) {
    deleteStoredCollection(id);
    setConfirmDelete(null);
    setError('');
    setStatus('Deleted the collection.');
  }

  function onToggleTool(collectionId: string, toolId: string) {
    const result = toggleToolInCollection(loadCollections(), collectionId, toolId);
    if (result.error) {
      setError(result.error);
      return;
    }
    saveCollections(result.collections);
    setError('');
  }

  function renderTools(collection: PersonalCollection) {
    const items = collection.toolIds
      .map((id) => tools.find((tool) => tool.id === id))
      .filter((tool): tool is ToolMeta => tool !== undefined);
    if (items.length === 0) return <p class="text-sm text-muted">No tools in this collection yet.</p>;
    return (
      <ul class="flex flex-col gap-1">
        {items.map((tool) => (
          <li key={tool.id} class="flex flex-wrap items-center gap-2">
            <a href={toolHref(tool.id)}>{tool.name}</a>
            <button
              type="button"
              class="text-sm text-muted underline"
              onClick={() => onToggleTool(collection.id, tool.id)}
              aria-label={`Remove ${tool.name} from ${collection.name}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function renderPicker(collection: PersonalCollection) {
    if (pickerFor !== collection.id) {
      return (
        <Button
          onClick={() => {
            setPickerFor(collection.id);
            setQuery('');
          }}
        >
          Add a tool
        </Button>
      );
    }
    const needle = query.trim().toLowerCase();
    const matches =
      needle.length === 0
        ? []
        : tools
            .filter((tool) => {
              const hay = `${tool.name} ${tool.id} ${tool.keywords.join(' ')}`.toLowerCase();
              return hay.includes(needle) && !collection.toolIds.includes(tool.id);
            })
            .slice(0, 8);
    return (
      <div class="flex flex-col gap-2 rounded-md border border-border p-3">
        <Input label={`Find a tool to add to ${collection.name}`} value={query} onValue={setQuery} />
        {needle.length === 0 ? (
          <p class="text-sm text-muted">Type a tool name.</p>
        ) : matches.length === 0 ? (
          <p class="text-sm text-muted">No matching tools.</p>
        ) : (
          <ul class="flex flex-col gap-1">
            {matches.map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  class="text-left text-sm text-accent underline"
                  onClick={() => onToggleTool(collection.id, tool.id)}
                >
                  Add {tool.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          onClick={() => {
            setPickerFor(null);
            setQuery('');
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  function renderCollection(collection: PersonalCollection, nested = false) {
    const pinned = pins.some((pin) => pin.kind === 'collection' && pin.id === collection.id);
    const pinLabel = `the ${collection.name} collection`;
    const children = childCollections(collections, collection.id);
    const Title = nested ? 'h3' : 'h2';
    return (
      <article
        key={collection.id}
        id={`c-${collection.id}`}
        class={`scroll-mt-24 rounded-lg border border-border bg-surface p-4 ${nested ? 'ml-4' : ''}`}
        aria-labelledby={`title-${collection.id}`}
      >
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <Title id={`title-${collection.id}`} class={nested ? 'text-base font-semibold' : 'text-lg font-semibold'}>
            {collection.name}
          </Title>
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-bg hover:text-fg"
            data-xt-pin={`collection:${collection.id}`}
            data-xt-pin-label={pinLabel}
            aria-pressed={pinned}
            aria-label={`${pinned ? 'Unpin' : 'Pin'} ${pinLabel}`}
            title={`${pinned ? 'Unpin' : 'Pin'} ${pinLabel}`}
          >
            <StarIcon />
          </button>
          {renaming === collection.id ? (
            <form class="flex flex-wrap items-end gap-2" onSubmit={(event) => onRename(event, collection.id)}>
              <Input label={`New name for ${collection.name}`} value={draft} onValue={setDraft} />
              <Button type="submit" variant="primary">
                Save name
              </Button>
              <Button onClick={() => setRenaming(null)}>Cancel</Button>
            </form>
          ) : (
            <Button
              onClick={() => {
                setRenaming(collection.id);
                setDraft(collection.name);
                setConfirmDelete(null);
              }}
            >
              Rename
            </Button>
          )}
          {confirmDelete === collection.id ? (
            <>
              <span class="text-sm">
                {children.length > 0
                  ? `Delete ${collection.name} and its sub-collections?`
                  : `Delete ${collection.name}?`}
              </span>
              <Button onClick={() => onDelete(collection.id)}>Delete</Button>
              <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            </>
          ) : (
            <Button
              onClick={() => {
                setConfirmDelete(collection.id);
                setRenaming(null);
              }}
            >
              Delete
            </Button>
          )}
        </div>
        {renderTools(collection)}
        <div class="mt-3">{renderPicker(collection)}</div>
        {children.length > 0 && (
          <div class="mt-4 flex flex-col gap-3">{children.map((child) => renderCollection(child, true))}</div>
        )}
        {!nested && (
          <form class="mt-4 flex flex-wrap items-end gap-2" onSubmit={(event) => onCreateSub(event, collection.id)}>
            <Input
              label={`New sub-collection in ${collection.name}`}
              value={subNames[collection.id] ?? ''}
              onValue={(value) => setSubNames((current) => ({ ...current, [collection.id]: value }))}
              hint="One level of sub-collections."
            />
            <Button type="submit">Add sub-collection</Button>
          </form>
        )}
      </article>
    );
  }

  return (
    <div data-xt="collections-app" class="flex flex-col gap-6">
      <p class="sr-only" aria-live="polite">
        {status}
      </p>
      {addTool && (
        <section aria-labelledby="add-tool-title" class="rounded-lg border border-border bg-surface p-4">
          <h2 id="add-tool-title" class="mb-1 text-lg font-semibold">
            Add {addTool.name}
          </h2>
          <p class="mb-3 text-sm text-muted">
            Tick a collection to keep this tool there. Creating a collection below includes it too.
          </p>
          {collections.length === 0 ? (
            <p class="text-sm">No collections yet.</p>
          ) : (
            <ul class="flex flex-col gap-1">
              {collections.map((collection) => {
                const parent = collection.parentId
                  ? collections.find((item) => item.id === collection.parentId)
                  : undefined;
                const checked = collection.toolIds.includes(addTool.id);
                return (
                  <li key={collection.id}>
                    <label class="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleTool(collection.id, addTool.id)}
                        class="size-4 accent-accent"
                      />
                      {parent ? `${parent.name} / ${collection.name}` : collection.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <form class="flex flex-wrap items-end gap-2" onSubmit={onCreate}>
        <Input
          label="New collection"
          value={name}
          onValue={setName}
          hint="Up to 40 characters. Stays in this browser."
        />
        <Button type="submit" variant="primary">
          Create collection
        </Button>
      </form>
      {error && (
        <p role="alert" class="text-sm text-danger">
          {error}
        </p>
      )}

      {ready && parents.length === 0 ? (
        <p>No collections yet. Name one above, then add the tools you want together.</p>
      ) : (
        <div class="flex flex-col gap-4">{parents.map((collection) => renderCollection(collection))}</div>
      )}
    </div>
  );
}
