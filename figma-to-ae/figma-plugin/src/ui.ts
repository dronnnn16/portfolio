// Plugin UI script (runs in the iframe). Receives scene.json + images from code.ts and
// either copies everything to the clipboard (pasted into the After Effects panel's box)
// or packs it into a ZIP download.

import { buildClipboardText, PASTE_BOX_SAFE_CHARS } from './clipboard';
import { createZip, utf8, ZipEntry } from './zip';

interface ExportResult {
  type: 'export-result';
  mode: 'copy' | 'zip';
  fileName: string;
  scene: string;
  images: { path: string; bytes: Uint8Array }[];
  stats: { nodes: number; images: number };
}

const copyButton = document.getElementById('copy') as HTMLButtonElement;
const zipButton = document.getElementById('zip') as HTMLButtonElement;
const retryButton = document.getElementById('retry') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const selectionEl = document.getElementById('selection') as HTMLDivElement;

let selectionOk = false;
let busy = false;
let pendingCopy = '';

function setStatus(text: string, kind: 'info' | 'error' | 'ok' = 'info') {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
}

function refreshButtons() {
  copyButton.disabled = zipButton.disabled = busy || !selectionOk;
}

function zipName(frameName: string): string {
  const base = frameName.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'frame';
  return `${base}-figma-ae.zip`;
}

function download(bytes: Uint8Array<ArrayBuffer>, name: string) {
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// navigator.clipboard is blocked inside Figma plugin iframes; execCommand works,
// but only shortly after a click, so a slow export may need a second click.
function copyText(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (err) {
    ok = false;
  }
  area.remove();
  return ok;
}

let lastSize = 0;

function copied(stats: { nodes: number; images: number }) {
  pendingCopy = '';
  retryButton.hidden = true;
  const kb = Math.max(1, Math.round(lastSize / 1024));
  let text =
    `Copied ${stats.nodes} layers and ${stats.images} images (${kb} KB).\n` +
    `In After Effects: click the box in the FigmaToAE panel, press Ctrl+V, then click "Import pasted data".`;
  if (lastSize > PASTE_BOX_SAFE_CHARS) {
    text +=
      `\nThis export is large. If After Effects says the data is cut off, click "or download a ZIP instead" ` +
      `and use "Load Figma ZIP..." in the panel.`;
  }
  setStatus(text, 'ok');
}

function startExport(mode: 'copy' | 'zip') {
  busy = true;
  refreshButtons();
  retryButton.hidden = true;
  setStatus('Exporting…');
  parent.postMessage({ pluginMessage: { type: 'export', mode } }, '*');
}

copyButton.onclick = () => startExport('copy');
zipButton.onclick = () => startExport('zip');

let lastStats = { nodes: 0, images: 0 };
retryButton.onclick = () => {
  if (pendingCopy && copyText(pendingCopy)) copied(lastStats);
  else setStatus('Copy failed. Use "Download ZIP" instead.', 'error');
};

window.onmessage = async (event: MessageEvent) => {
  const msg = event.data && event.data.pluginMessage;
  if (!msg) return;
  if (msg.type === 'selection') {
    selectionEl.textContent = msg.message;
    selectionOk = msg.ok;
    refreshButtons();
  } else if (msg.type === 'progress') {
    setStatus(msg.message);
  } else if (msg.type === 'error') {
    setStatus(msg.message, 'error');
    busy = false;
    refreshButtons();
  } else if (msg.type === 'export-result') {
    const result = msg as ExportResult;
    lastStats = result.stats;
    if (result.mode === 'zip') {
      const pretty = JSON.stringify(JSON.parse(result.scene), null, 2);
      const entries: ZipEntry[] = [{ path: 'scene.json', data: utf8(pretty) }];
      for (const img of result.images) entries.push({ path: img.path, data: img.bytes });
      const name = zipName(result.fileName);
      download(createZip(entries), name);
      setStatus(`Saved ${name}: ${result.stats.nodes} nodes, ${result.stats.images} images.`, 'ok');
    } else {
      const text = await buildClipboardText(result.fileName, result.scene, result.images);
      lastSize = text.length;
      if (copyText(text)) {
        copied(result.stats);
      } else {
        pendingCopy = text;
        retryButton.hidden = false;
        setStatus('Export ready. Click "Copy to clipboard" to finish.', 'info');
      }
    }
    busy = false;
    refreshButtons();
  }
};
