// Builds dist/code.js (plugin sandbox) and dist/ui.html (UI with the script inlined).
// Usage: node build.mjs [--watch]
import { build, context } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

const common = { bundle: true, target: 'es2017', logLevel: 'info' };

const codeOptions = {
  ...common,
  entryPoints: [join(root, 'code.ts')],
  outfile: join(dist, 'code.js'),
};

function inlineUi(script) {
  const html = readFileSync(join(root, 'ui.html'), 'utf8');
  // Escape "</script" so the bundle can't terminate the inline <script> tag early.
  const safe = script.replace(/<\/script/gi, '<\\/script');
  writeFileSync(join(dist, 'ui.html'), html.replace('/*__UI_SCRIPT__*/', () => safe));
}

const uiOptions = {
  ...common,
  entryPoints: [join(root, 'src/ui.ts')],
  write: false,
  plugins: [
    {
      name: 'inline-ui',
      setup(b) {
        b.onEnd((result) => {
          if (result.errors.length || !result.outputFiles) return;
          inlineUi(result.outputFiles[0].text);
          console.log('  dist/ui.html written');
        });
      },
    },
  ],
};

if (process.argv.includes('--watch')) {
  const [codeCtx, uiCtx] = await Promise.all([context(codeOptions), context(uiOptions)]);
  await Promise.all([codeCtx.watch(), uiCtx.watch()]);
  console.log('Watching for changes…');
} else {
  await Promise.all([build(codeOptions), build(uiOptions)]);
}
