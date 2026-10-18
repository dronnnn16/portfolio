// Clipboard transfer: the whole export (scene.json + PNGs) as one ASCII text block,
// so the After Effects panel can import it straight from the clipboard.
//
//   FIGMA_TO_AE_CLIPBOARD 1
//   NAME <frame name as a JSON string>
//   SCENE
//   <scene.json on one line>
//   IMAGE images/img_001_Photo.png
//   <base64 on one line>
//   END
//
// Pure ASCII and one item per line keeps it trivial to parse in ExtendScript (ES3)
// and safe through PowerShell's Get-Clipboard.

export const CLIPBOARD_HEADER = 'FIGMA_TO_AE_CLIPBOARD 1';

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
  return text.replace(/[\u007f-\uffff]/g, (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
}

export function buildClipboardText(frameName: string, sceneJson: string, images: { path: string; bytes: Uint8Array }[]): string {
  const lines = [CLIPBOARD_HEADER, 'NAME ' + asciiOnly(JSON.stringify(frameName)), 'SCENE', asciiOnly(sceneJson)];
  for (const img of images) {
    lines.push('IMAGE ' + img.path, base64(img.bytes));
  }
  lines.push('END');
  return lines.join('\n');
}
