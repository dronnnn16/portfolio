// Plugin UI script (runs in the iframe). Receives scene.json + images from code.ts,
// packs them into a ZIP and triggers a download.

import { createZip, utf8, ZipEntry } from './zip';

interface ExportResult {
  type: 'export-result';
  fileName: string;
  scene: string;
  images: { path: string; bytes: Uint8Array }[];
  stats: { nodes: number; images: number };
}

const button = document.getElementById('export') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const selectionEl = document.getElementById('selection') as HTMLDivElement;

function setStatus(text: string, kind: 'info' | 'error' | 'ok' = 'info') {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
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

button.onclick = () => {
  button.disabled = true;
  setStatus('Exporting…');
  parent.postMessage({ pluginMessage: { type: 'export' } }, '*');
};

window.onmessage = (event: MessageEvent) => {
  const msg = event.data && event.data.pluginMessage;
  if (!msg) return;
  if (msg.type === 'selection') {
    selectionEl.textContent = msg.message;
    button.disabled = !msg.ok;
  } else if (msg.type === 'progress') {
    setStatus(msg.message);
  } else if (msg.type === 'error') {
    setStatus(msg.message, 'error');
    button.disabled = false;
  } else if (msg.type === 'export-result') {
    const result = msg as ExportResult;
    const entries: ZipEntry[] = [{ path: 'scene.json', data: utf8(result.scene) }];
    for (const img of result.images) entries.push({ path: img.path, data: img.bytes });
    const name = zipName(result.fileName);
    download(createZip(entries), name);
    setStatus(`Saved ${name}: ${result.stats.nodes} nodes, ${result.stats.images} images.`, 'ok');
    button.disabled = false;
  }
};
