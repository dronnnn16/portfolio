// Clipboard transfer: the whole export (scene.json + PNGs) as one ASCII text block,
// which the user pastes into the After Effects panel's box (Ctrl+V).
//
//   FIGMA_TO_AE_CLIPBOARD 2
//   NAME <frame name as a JSON string>
//   SCENEZ
//   <base64 of the raw-deflated scene.json, one line>
//   IMAGE images/img_001_Photo.png
//   <base64 PNG, one line>
//   END
//
// The scene is compressed because paste boxes on Windows may only take ~32,000
// characters. Version 1 (no compression) uses "SCENE" + the JSON itself; it is
// still written when the runtime has no CompressionStream, and the panel reads both.
// Pure ASCII and one item per line keeps it easy to parse in ExtendScript (ES3).

export const CLIPBOARD_HEADER_V1 = 'FIGMA_TO_AE_CLIPBOARD 1';
export const CLIPBOARD_HEADER_V2 = 'FIGMA_TO_AE_CLIPBOARD 2';

/** Typical safe size for a pasted text on Windows (edit controls default to 32,767 chars). */
export const PASTE_BOX_SAFE_CHARS = 30000;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64(bytes: Uint8Array): string {
  const out: string[] = [];
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out.push(B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out.push(B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==');
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out.push(B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=');
  }
  return out.join('');
}

/** Escapes every non-ASCII character as \uXXXX (valid inside JSON strings). */
export function asciiOnly(text: string): string {
  return text.replace(/[\u007f-￿]/g, (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
}

/** Raw DEFLATE via the browser's CompressionStream; null when unavailable. */
export async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (err) {
    return null;
  }
}

export async function buildClipboardText(
  frameName: string,
  sceneJson: string,
  images: { path: string; bytes: Uint8Array }[],
  options: { compress?: boolean } = {},
): Promise<string> {
  const scene = asciiOnly(sceneJson);
  const compressed = options.compress === false ? null : await deflateRaw(new TextEncoder().encode(scene));
  const lines = compressed
    ? [CLIPBOARD_HEADER_V2, 'NAME ' + asciiOnly(JSON.stringify(frameName)), 'SCENEZ', base64(compressed)]
    : [CLIPBOARD_HEADER_V1, 'NAME ' + asciiOnly(JSON.stringify(frameName)), 'SCENE', scene];
  for (const img of images) {
    lines.push('IMAGE ' + img.path, base64(img.bytes));
  }
  lines.push('END');
  return lines.join('\n');
}
