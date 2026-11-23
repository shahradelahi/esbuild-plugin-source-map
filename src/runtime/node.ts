import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createInstaller } from './core.js';

function normalizeFilePath(source: string): string {
  if (source.startsWith('file://')) {
    try {
      return fileURLToPath(source);
    } catch {
      return source;
    }
  }
  return source;
}

/**
 * Install source map stack trace support for Node.js environment.
 *
 * @example
 * install({ handleUncaughtExceptions: true });
 */
export const install = createInstaller({
  isNode: true,

  readFile(filePath: string): string | null {
    const normalized = normalizeFilePath(filePath);
    try {
      return fs.readFileSync(normalized, 'utf8');
    } catch {
      return null;
    }
  },

  resolvePath(base: string, relativePath: string): string {
    if (relativePath.startsWith('file://')) {
      return normalizeFilePath(relativePath);
    }
    if (path.isAbsolute(relativePath)) {
      return relativePath;
    }
    const baseFile = normalizeFilePath(base);
    return path.resolve(path.dirname(baseFile), relativePath);
  },

  registerUncaughtExceptionHandler(getErrorSource) {
    process.on('uncaughtException', (error: unknown) => {
      if (process.listenerCount('uncaughtException') > 1) return;

      const sourceSnippet = getErrorSource(error);
      /* eslint-disable no-console */
      if (sourceSnippet) {
        console.error(`\n${sourceSnippet}`);
      }
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      } else {
        console.error(error);
      }
      /* eslint-enable no-console */
      process.exit(1);
    });
  },
});
