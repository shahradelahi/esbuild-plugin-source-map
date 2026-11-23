import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import esbuild from 'esbuild';
import { describe, expect, it } from 'vitest';

import SourceMapSupportPlugin from './index.js';

const execFileAsync = promisify(execFile);

describe('SourceMapSupportPlugin', () => {
  it('maps stack traces back to original TypeScript lines with linked sourcemaps', async () => {
    const inputPath = './test-temp-entry.ts';
    const outputPath = './test-temp-bundle.cjs';

    await fs.writeFile(
      inputPath,
      [
        'class Demo {',
        '  run(): void {',
        '    this.fail();',
        '  }',
        '  fail(): void {',
        '    throw new Error("boom");',
        '  }',
        '}',
        'const err = (() => { try { new Demo().run(); } catch (e) { return e as Error; } })();',
        'console.log(err?.stack);',
      ].join('\n')
    );

    try {
      await esbuild.build({
        entryPoints: [inputPath],
        outfile: outputPath,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        plugins: [SourceMapSupportPlugin()],
      });

      const { stdout } = await execFileAsync(process.execPath, [outputPath]);
      expect(stdout).to.contain('Error: boom');
      expect(stdout).to.contain('test-temp-entry.ts:6:11');
      expect(stdout).to.contain('test-temp-entry.ts:3:10');
    } finally {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
      await fs.unlink(`${outputPath}.map`).catch(() => {});
    }
  });

  it('maps stack traces with inline sourcemaps', async () => {
    const inputPath = './test-temp-inline.ts';
    const outputPath = './test-temp-inline.mjs';

    await fs.writeFile(
      inputPath,
      [
        'function explode() {',
        '  throw new Error("inline-boom");',
        '}',
        'try { explode(); } catch (e) { console.log((e as Error).stack); }',
      ].join('\n')
    );

    try {
      await esbuild.build({
        entryPoints: [inputPath],
        outfile: outputPath,
        bundle: true,
        platform: 'node',
        format: 'esm',
        plugins: [
          SourceMapSupportPlugin({
            sourcemap: 'inline',
          }),
        ],
      });

      const { stdout } = await execFileAsync(process.execPath, [outputPath]);
      expect(stdout).to.contain('Error: inline-boom');
      expect(stdout).to.contain('test-temp-inline.ts:2:9');
    } finally {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  });

  it('skips injection if bundle is false', async () => {
    let injected = false;
    const testPlugin: esbuild.Plugin = {
      name: 'test-check',
      setup(build) {
        SourceMapSupportPlugin().setup(build);
        injected = Boolean(
          build.initialOptions.inject?.includes('virtual:esbuild-source-map-support')
        );
      },
    };

    await esbuild.build({
      entryPoints: ['./src/index.ts'],
      write: false,
      bundle: false,
      plugins: [testPlugin],
    });

    expect(injected).to.eq(false);
  });

  it('respects filter matching when provided', async () => {
    let injected = false;
    const testPlugin: esbuild.Plugin = {
      name: 'test-check',
      setup(build) {
        SourceMapSupportPlugin({ filter: ['*.other'] }).setup(build);
        injected = Boolean(
          build.initialOptions.inject?.includes('virtual:esbuild-source-map-support')
        );
      },
    };

    await esbuild.build({
      entryPoints: ['./src/index.ts'],
      write: false,
      bundle: true,
      platform: 'node',
      packages: 'external',
      plugins: [testPlugin],
    });

    expect(injected).to.eq(false);
  });
});
