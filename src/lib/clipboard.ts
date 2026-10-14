// Copies text to the clipboard. Falls back to execCommand('copy') when the
// async Clipboard API is unavailable (plain HTTP outside localhost).

export async function copyText(text: string): Promise<boolean> {
  if (globalThis.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or document not focused: try the fallback.
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.className = 'fixed -left-[9999px] top-0';
  document.body.append(el);
  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  el.select();
  let ok: boolean;
  try {
    // Deprecated but still the only option outside a secure context.
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  el.remove();
  if (previous && selection) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }
  return ok;
}
