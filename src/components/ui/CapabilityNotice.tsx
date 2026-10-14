import { useEffect, useState } from 'preact/hooks';
import { missingCapabilities, type CapabilityInfo } from '../../capabilities.ts';

interface Props {
  requires: readonly string[];
}

/** Lists required browser capabilities that are unavailable. Renders nothing on the server. */
export default function CapabilityNotice({ requires }: Props) {
  const [missing, setMissing] = useState<CapabilityInfo[]>([]);

  useEffect(() => {
    setMissing(missingCapabilities(requires));
  }, [requires]);

  if (missing.length === 0) return null;

  return (
    <div role="status" class="rounded-lg border border-warning bg-warning-bg p-4 text-sm text-fg">
      <p class="font-semibold text-warning">Some features are unavailable here</p>
      <ul class="mt-1 list-disc pl-5">
        {missing.map((c) => (
          <li key={c.id}>
            <strong>{c.label}:</strong> {c.missing}
          </li>
        ))}
      </ul>
    </div>
  );
}
