import { useEffect, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { formatWireguard, wireguard } from './logic.ts';

const freshSecret = () => crypto.getRandomValues(new Uint8Array(32));

export default function WireguardTool() {
  const [secret, setSecret] = useState<Uint8Array>();
  const [endpoint, setEndpoint] = useState('');

  useEffect(() => {
    setSecret(freshSecret());
  }, []);

  const result = useMemo(() => {
    if (!secret) return { output: '', error: undefined as string | undefined };
    return runTool(() => formatWireguard(wireguard(secret, endpoint)));
  }, [secret, endpoint]);

  return (
    <TwoPane
      inputLabel="Peer endpoint (optional)"
      input={endpoint}
      onInput={setEndpoint}
      inputPlaceholder="vpn.example.com:51820"
      outputLabel="Keys and configuration"
      output={result.output ?? ''}
      error={result.error}
      controls={
        <Button variant="primary" onClick={() => setSecret(freshSecret())}>
          Generate keys
        </Button>
      }
    />
  );
}
