interface Props {
  text: string;
}

/** Inline warning for a legacy algorithm or mode (island version of LegacyWarning.astro). */
export default function LegacyNotice({ text }: Props) {
  return (
    <p role="note" class="rounded-lg border border-warning bg-warning-bg p-3 text-sm text-fg" data-xt="legacy">
      <strong class="text-warning">Legacy:</strong> {text}
    </p>
  );
}
