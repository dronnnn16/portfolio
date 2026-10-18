// Bundles the plugin's serializer and zip writer for Node so tests run the real code.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const pluginDir = join(here, '..', '..', 'figma-plugin');
export const requirePlugin = createRequire(join(pluginDir, 'package.json'));

export async function loadPluginModules() {
  const esbuild = requirePlugin('esbuild');
  const outdir = join(here, '..', '.build');
  await esbuild.build({
    entryPoints: { serialize: join(pluginDir, 'src/serialize.ts'), zip: join(pluginDir, 'src/zip.ts'), clipboard: join(pluginDir, 'src/clipboard.ts') },
    outdir,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2017',
    outExtension: { '.js': '.mjs' },
    logLevel: 'silent',
  });
  const serialize = await import(pathToFileURL(join(outdir, 'serialize.mjs')).href);
  const zip = await import(pathToFileURL(join(outdir, 'zip.mjs')).href);
  const clipboard = await import(pathToFileURL(join(outdir, 'clipboard.mjs')).href);
  return { serialize, zip, clipboard };
}
