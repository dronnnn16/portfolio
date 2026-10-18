// Figma plugin entry point (runs in the plugin sandbox).
// Serialises the selected frame and hands scene.json + PNGs to the UI, which copies them to the clipboard or zips them.

import { isExportableRoot, serializeScene } from './src/serialize';

figma.showUI(__html__, { width: 340, height: 330, themeColors: true });

function describeSelection(): { ok: boolean; message: string } {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) {
    return { ok: false, message: sel.length ? `Select exactly one frame (${sel.length} selected).` : 'Select one frame to export.' };
  }
  const node = sel[0];
  if (!isExportableRoot(node)) {
    return { ok: false, message: `"${node.name}" is a ${node.type}. Select a frame, component, instance, section or group.` };
  }
  return { ok: true, message: `Ready: "${node.name}" (${Math.round((node as FrameNode).width)} × ${Math.round((node as FrameNode).height)})` };
}

function postSelection() {
  figma.ui.postMessage({ type: 'selection', ...describeSelection() });
}

figma.on('selectionchange', postSelection);
postSelection();

figma.ui.onmessage = async (msg: { type: string; mode?: 'copy' | 'zip' }) => {
  if (msg.type === 'close') {
    figma.closePlugin();
    return;
  }
  if (msg.type !== 'export') return;

  const status = describeSelection();
  if (!status.ok) {
    figma.ui.postMessage({ type: 'error', message: status.message });
    return;
  }
  const root = figma.currentPage.selection[0];
  try {
    const { scene, images } = await serializeScene(root, {
      imageScale: 2,
      onProgress: (message) => figma.ui.postMessage({ type: 'progress', message }),
    });
    figma.ui.postMessage({
      type: 'export-result',
      mode: msg.mode === 'zip' ? 'zip' : 'copy',
      fileName: root.name,
      scene: JSON.stringify(scene),
      images,
      stats: scene.stats,
    });
  } catch (err) {
    figma.ui.postMessage({ type: 'error', message: `Export failed: ${err instanceof Error ? err.message : String(err)}` });
  }
};
