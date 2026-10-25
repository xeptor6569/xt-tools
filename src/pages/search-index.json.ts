// Static search index. The header search loads it the first time someone types.
import type { APIRoute } from 'astro';
import { getCategory, getGroup } from '../categories.ts';
import { allTools } from '../tools/registry.ts';

export const GET: APIRoute = () => {
  const index = allTools().map((tool) => {
    const category = getCategory(tool.category);
    const group = tool.group && category ? getGroup(category.id, tool.group) : undefined;
    return {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      categoryLabel: category?.label ?? tool.category,
      ...(group ? { groupLabel: group.label } : {}),
      keywords: tool.keywords,
      tags: tool.tags,
      added: tool.added,
    };
  });
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
};
