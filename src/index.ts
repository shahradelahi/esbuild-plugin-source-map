import { dirname, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMatch as globIsMatch } from '@se-oss/glob';
import type { Plugin } from 'esbuild';

import type { SourceMapSupportPluginOptions } from './typings.js';

export type * from './typings.js';

const VIRTUAL_MODULE_ID = 'virtual:esbuild-source-map-support';
const VIRTUAL_NAMESPACE = 'esbuild-source-map-support';

/**
 * Create an esbuild plugin that enables runtime source map support for stack traces.
 *
 * @example
 * import esbuild from 'esbuild';
 * import SourceMapSupportPlugin from 'esbuild-plugin-source-map';
 *
 * await esbuild.build({
 *   entryPoints: ['src/index.ts'],
 *   outfile: 'dist/index.js',
 *   bundle: true,
 *   plugins: [SourceMapSupportPlugin()],
 * });
 */
export function SourceMapSupportPlugin(options: SourceMapSupportPluginOptions = {}): Plugin {
  const { sourcemap, filter, ...runtimeOptions } = options;

  return {
    name: 'source-map-support',
    setup(build) {
      if (build.initialOptions.bundle === false) {
        return;
      }

      if (filter && !hasMatchingEntryPoint(build.initialOptions.entryPoints, filter)) {
        return;
      }

      if (!build.initialOptions.sourcemap) {
        build.initialOptions.sourcemap =
          sourcemap ?? (build.initialOptions.write === false ? 'inline' : true);
      }

      const env =
        options.environment && options.environment !== 'auto'
          ? options.environment
          : build.initialOptions.platform === 'node'
            ? 'node'
            : 'browser';

      const currentDir =
        typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));

      build.initialOptions.inject = [VIRTUAL_MODULE_ID, ...(build.initialOptions.inject ?? [])];

      build.onResolve({ filter: new RegExp(`^${VIRTUAL_MODULE_ID}$`) }, () => ({
        path: VIRTUAL_MODULE_ID,
        namespace: VIRTUAL_NAMESPACE,
      }));

      build.onLoad({ filter: /.*/, namespace: VIRTUAL_NAMESPACE }, () => {
        const runtimeImport = env === 'node' ? './runtime/node' : './runtime/browser';
        const serializedOptions = JSON.stringify(runtimeOptions);

        return {
          contents: `import { install } from ${JSON.stringify(runtimeImport)};\ninstall(${serializedOptions});\n`,
          loader: 'js',
          resolveDir: currentDir,
        };
      });
    },
  };
}

export default SourceMapSupportPlugin;

function hasMatchingEntryPoint(
  entryPoints: (string | { in: string; out: string })[] | Record<string, string> | undefined,
  filter: ((path: string) => boolean) | string[]
): boolean {
  if (!entryPoints) return true;

  const paths = Array.isArray(entryPoints)
    ? entryPoints.map((entry) => (typeof entry === 'string' ? entry : entry.in))
    : Object.values(entryPoints);

  return paths.some((entryPath) => {
    if (typeof filter === 'function') {
      return filter(entryPath);
    }
    const normalizedPath = isAbsolute(entryPath) ? relative(process.cwd(), entryPath) : entryPath;
    return globIsMatch(normalizedPath, filter, { basename: true });
  });
}
