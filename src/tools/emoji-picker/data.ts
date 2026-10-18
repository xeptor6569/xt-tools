// Emoji data from emojibase (MIT, https://emojibase.dev), loaded only when the
// tool opens so other pages never pay for it.
export interface Emoji {
  emoji: string;
  label: string;
  hexcode: string;
  group: number;
  tags: string[];
  shortcodes: string[];
  /** Skin tone variants, light to dark. */
  skins: string[];
}

export interface EmojiData {
  emoji: Emoji[];
  groups: Array<{ id: number; label: string }>;
}

interface CompactEmoji {
  hexcode: string;
  label: string;
  unicode: string;
  group?: number;
  order?: number;
  tags?: string[];
  skins?: Array<{ unicode: string }>;
}

export async function loadEmoji(): Promise<EmojiData> {
  const [compact, shortcodes, messages] = await Promise.all([
    import('emojibase-data/en/compact.json'),
    import('emojibase-data/en/shortcodes/github.json'),
    import('emojibase-data/en/messages.json'),
  ]);
  const codes = shortcodes.default as Record<string, string | string[]>;
  const list = (compact.default as CompactEmoji[])
    // Group 2 is skin-tone and hair components; they aren't useful on their own.
    .filter((e) => e.group !== undefined && e.group !== 2)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((e) => {
      const sc = codes[e.hexcode];
      return {
        emoji: e.unicode,
        label: e.label,
        hexcode: e.hexcode,
        group: e.group ?? 0,
        tags: e.tags ?? [],
        shortcodes: sc === undefined ? [] : Array.isArray(sc) ? sc : [sc],
        skins: (e.skins ?? []).map((s) => s.unicode),
      };
    });
  const groups = (messages.default as { groups: Array<{ order: number; message: string }> }).groups
    .filter((g) => g.order !== 2)
    .map((g) => ({ id: g.order, label: g.message.charAt(0).toUpperCase() + g.message.slice(1) }));
  return { emoji: list, groups };
}
