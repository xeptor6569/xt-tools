// Splits a category's tools into its curated groups, preserving group order.
import type { Category } from '../categories.ts';

export interface ToolGroupSection<T> {
  id?: string;
  label?: string;
  description?: string;
  tools: T[];
}

export function groupTools<T extends { group?: string | undefined }>(
  category: Category,
  tools: readonly T[],
): ToolGroupSection<T>[] {
  const groups = category.groups;
  if (!groups || groups.length === 0) return [{ tools: [...tools] }];

  const buckets = new Map<string, T[]>(groups.map((group) => [group.id, []]));
  const other: T[] = [];
  for (const tool of tools) {
    const bucket = tool.group ? buckets.get(tool.group) : undefined;
    if (bucket) bucket.push(tool);
    else other.push(tool);
  }

  const sections: ToolGroupSection<T>[] = [];
  for (const group of groups) {
    const items = buckets.get(group.id) ?? [];
    if (items.length === 0) continue;
    sections.push({ id: group.id, label: group.label, description: group.description, tools: items });
  }
  if (other.length > 0) sections.push({ id: 'other', label: 'Other', tools: other });
  return sections;
}
