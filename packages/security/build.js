import * as esbuild from 'esbuild';
import { execSync } from 'child_process';

// Build ESM
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  sourcemap: true,
});

// Build CJS
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/index.cjs',
  sourcemap: true,
});

// Generate type declarations
execSync('npx tsc --emitDeclarationOnly --outDir dist', { stdio: 'inherit' });

console.log('✅ Build complete');
