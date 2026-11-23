import { createInstaller } from './core.js';

/**
 * Install source map stack trace support for Browser environment.
 *
 * @example
 * install();
 */
export const install = createInstaller({
  isNode: false,

  readFile(url: string): string | null {
    if (typeof XMLHttpRequest === 'undefined') return null;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.status >= 200 && xhr.status < 300 ? xhr.responseText : null;
    } catch {
      return null;
    }
  },

  resolvePath(base: string, relativePath: string): string {
    try {
      return new URL(relativePath, base).href;
    } catch {
      return relativePath;
    }
  },
});
