import { useEffect, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { chunkText, localVoices, type VoiceInfo } from './logic.ts';

type State = 'idle' | 'speaking' | 'paused';

export default function TextToSpeechTool() {
  const [text, setText] = useState('Everything you type here is read aloud by your device. Nothing is sent anywhere.');
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState('1');
  const [pitch, setPitch] = useState('1');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const supported = useRef(false);

  useEffect(() => {
    supported.current = 'speechSynthesis' in window;
    if (!supported.current) return;
    const load = () => {
      const list = localVoices(speechSynthesis.getVoices());
      setVoices(list);
      setVoiceURI((current) => current || list[0]?.voiceURI || '');
    };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', load);
      speechSynthesis.cancel();
    };
  }, []);

  const speak = () => {
    try {
      const voice = speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI && v.localService);
      if (!voice) {
        setError('No on-device voice is selected.');
        return;
      }
      speechSynthesis.cancel();
      const chunks = chunkText(text);
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = Math.min(3, Math.max(0.5, Number(rate) || 1));
        u.pitch = Math.min(2, Math.max(0, Number(pitch) || 1));
        if (i === chunks.length - 1) u.onend = () => setState('idle');
        u.onerror = (e) => {
          if (e.error !== 'interrupted' && e.error !== 'canceled') setError(`Speech failed: ${e.error}`);
          setState('idle');
        };
        speechSynthesis.speak(u);
      });
      setError('');
      setState(chunks.length ? 'speaking' : 'idle');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <TextArea label="Text" value={text} onValue={setText} rows={8} data-xt="input" />
      <div class="flex flex-wrap items-end gap-4">
        {voices.length > 0 ? (
          <Select
            label="On-device voice"
            value={voiceURI}
            options={voices.map((v) => ({
              value: v.voiceURI,
              label: `${v.name} (${v.lang})${v.default ? ' – default' : ''}`,
            }))}
            onValue={setVoiceURI}
          />
        ) : (
          <p class="text-sm text-muted" role="status">
            No on-device voices are available in this browser. Voices that send text to a server are never used.
          </p>
        )}
        <Input label="Speed (0.5–3)" value={rate} onValue={setRate} inputMode="decimal" class="w-24" />
        <Input label="Pitch (0–2)" value={pitch} onValue={setPitch} inputMode="decimal" class="w-24" />
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="primary" onClick={speak} disabled={!voices.length || !text.trim()}>
          {state === 'idle' ? 'Speak' : 'Restart'}
        </Button>
        <Button
          disabled={state === 'idle'}
          onClick={() => {
            if (state === 'paused') {
              speechSynthesis.resume();
              setState('speaking');
            } else {
              speechSynthesis.pause();
              setState('paused');
            }
          }}
        >
          {state === 'paused' ? 'Resume' : 'Pause'}
        </Button>
        <Button
          disabled={state === 'idle'}
          onClick={() => {
            speechSynthesis.cancel();
            setState('idle');
          }}
        >
          Stop
        </Button>
      </div>
      {error && (
        <p role="alert" class="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
