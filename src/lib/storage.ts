/** Returns a warning string when browser storage is running low, else null. */
export async function storageWarning(): Promise<string | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.quota || !est.usage) return null;
    const pct = est.usage / est.quota;
    if (pct > 0.8) return `Browser storage is ${Math.round(pct * 100)}% full. Please export a backup (Medasium JSON) and remove old photos.`;
  } catch { /* ignore */ }
  return null;
}
/** Ask the browser not to evict our data. Best effort. */
export const requestPersist = () => navigator.storage?.persist?.().catch(() => false);

const MAX_EDGE = 1280, MAX_BYTES = 700_000;
/** Resize and compress an image file to a JPEG data URL under the size cap. */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  let q = 0.72, url = c.toDataURL('image/jpeg', q);
  while (url.length * 0.75 > MAX_BYTES && q > 0.3) { q -= 0.1; url = c.toDataURL('image/jpeg', q); }
  if (url.length * 0.75 > MAX_BYTES) {
    c.width = Math.round(c.width / 2); c.height = Math.round(c.height / 2);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', 0.5);
  }
  return url;
}
