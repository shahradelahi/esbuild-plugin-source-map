import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/index.ts', 'src/runtime/node.ts', 'src/runtime/browser.ts'],
  external: ['esbuild', 'source-map'],
  format: ['cjs', 'esm'],
  outDir: 'dist',
  shims: true,
  target: 'esnext',
});
