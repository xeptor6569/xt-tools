import CopyButton from './CopyButton.tsx';

export interface Column<Row> {
  key: keyof Row & string;
  label: string;
  mono?: boolean;
}

interface Props<Row extends object> {
  caption: string;
  columns: ReadonlyArray<Column<Row>>;
  rows: readonly Row[];
  /** Show a "Copy as TSV" button. */
  copy?: boolean;
  empty?: string;
}

export default function ResultTable<Row extends object>({
  caption,
  columns,
  rows,
  copy = true,
  empty = 'Nothing to show.',
}: Props<Row>) {
  const tsv = [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => String(r[c.key])))]
    .map((cells) => cells.join('\t'))
    .join('\n');
  return (
    <div class="flex flex-col gap-2">
      <div class="overflow-x-auto rounded-lg border border-border">
        <table class="w-full border-collapse text-left text-sm" data-xt="table">
          <caption class="sr-only">{caption}</caption>
          <thead class="bg-surface">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" class="px-3 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} class="px-3 py-3 text-muted">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} class="border-t border-border">
                  {columns.map((c) => (
                    <td key={c.key} class={`px-3 py-2 align-top ${c.mono ? 'font-mono' : ''}`}>
                      {String(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {copy && rows.length > 0 && (
        <div>
          <CopyButton text={tsv} label="Copy as TSV" />
        </div>
      )}
    </div>
  );
}
