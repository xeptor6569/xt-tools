import Toggle from './Toggle.tsx';

interface Props {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
}

/** Opt-in switch for usePersistentState. */
export default function RememberToggle({ enabled, setEnabled }: Props) {
  return (
    <Toggle
      label="Remember on this device"
      checked={enabled}
      onChecked={setEnabled}
      hint="Stored in this browser’s local storage only. Turn off to delete it."
    />
  );
}
