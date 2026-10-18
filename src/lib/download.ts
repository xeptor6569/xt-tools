// Saves data as a file without any network round-trip.

export type Downloadable = string | Uint8Array | Blob;

export function toBlob(data: Downloadable, mime = 'application/octet-stream'): Blob {
  if (data instanceof Blob) return data;
  return new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type: mime });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
