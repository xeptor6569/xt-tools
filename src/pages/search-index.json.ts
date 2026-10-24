// Static search index consumed by the Ctrl+K search (Phase 3).
import type { APIRoute } from 'astro';
import { allTools } from '../tools/registry.ts';

export const GET: APIRoute = () => {
  const index = allTools().map(({ id, name, description, category, group, keywords, added }) => ({
    id,
    name,
    description,
    category,
    ...(group ? { group } : {}),
    keywords,
    added,
  }));
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
};
