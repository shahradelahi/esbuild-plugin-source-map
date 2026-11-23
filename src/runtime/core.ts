import { SourceMapConsumer, type RawSourceMap } from 'source-map';

import type { RetrievedSourceMap, RuntimeInstallOptions } from '../typings.js';

export interface PlatformAdapter {
  isNode: boolean;
  readFile: (path: string) => string | null;
  resolvePath: (base: string, relativePath: string) => string;
  registerUncaughtExceptionHandler?: (formatErrorSource: (error: unknown) => string | null) => void;
}

type V8CallSite = NodeJS.CallSite;

interface MappedPosition {
  source: string;
  line: number;
  column: number;
  name?: string | null;
  mapUrl: string | null;
}

const SOURCE_MAP_URL_RE =
  /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$|\/\*[@#][ \t]+sourceMappingURL=([^\s*'"]+?)[ \t]*\*\/[ \t]*$)/gm;

const DATA_URL_RE = /^data:application\/json[^,]*;base64,(.+)$/i;

const INSTALLED_SYMBOL = Symbol.for('esbuild-source-map-support-plugin.installed');

function decodeBase64Utf8(base64: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function getLastSourceMappingUrl(contents: string): string | null {
  SOURCE_MAP_URL_RE.lastIndex = 0;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = SOURCE_MAP_URL_RE.exec(contents)) !== null) {
    lastMatch = match;
  }
  if (!lastMatch) return null;
  return lastMatch[1] ?? lastMatch[2] ?? null;
}

/**
 * Factory function creating a runtime installer tailored to a platform adapter.
 *
 * @example
 * const install = createInstaller(nodeAdapter);
 * install();
 */
export function createInstaller(adapter: PlatformAdapter) {
  return function install(options: RuntimeInstallOptions = {}): void {
    const g = globalThis as Record<symbol, boolean | undefined>;
    if (g[INSTALLED_SYMBOL]) return;
    g[INSTALLED_SYMBOL] = true;

    const emptyCache = options.emptyCacheBetweenOperations ?? false;
    const fileCache = new Map<string, string | null>();
    const mapCache = new Map<string, { url: string | null; consumer: SourceMapConsumer } | null>();

    function retrieveFile(path: string): string | null {
      if (!emptyCache && fileCache.has(path)) {
        return fileCache.get(path) ?? null;
      }
      const contents = options.retrieveFile ? options.retrieveFile(path) : adapter.readFile(path);
      if (!emptyCache) {
        fileCache.set(path, contents);
      }
      return contents;
    }

    function retrieveSourceMap(
      source: string
    ): { url: string | null; consumer: SourceMapConsumer } | null {
      if (!emptyCache && mapCache.has(source)) {
        return mapCache.get(source) ?? null;
      }

      let raw: RetrievedSourceMap | null = null;

      if (options.retrieveSourceMap) {
        raw = options.retrieveSourceMap(source);
      } else {
        const contents = retrieveFile(source);
        if (contents) {
          const mappingUrl = getLastSourceMappingUrl(contents);
          if (mappingUrl) {
            const dataMatch = DATA_URL_RE.exec(mappingUrl);
            if (dataMatch?.[1]) {
              raw = {
                url: source,
                map: decodeBase64Utf8(dataMatch[1]),
              };
            } else {
              const resolvedMapUrl = adapter.resolvePath(source, mappingUrl);
              const mapData = retrieveFile(resolvedMapUrl);
              if (mapData) {
                raw = {
                  url: resolvedMapUrl,
                  map: mapData,
                };
              }
            }
          }
        }
      }

      if (!raw) {
        if (!emptyCache) mapCache.set(source, null);
        return null;
      }

      try {
        const parsedMap: RawSourceMap =
          typeof raw.map === 'string' ? (JSON.parse(raw.map) as RawSourceMap) : raw.map;
        const consumer = new SourceMapConsumer(parsedMap);
        const entry = { url: raw.url, consumer };
        if (!emptyCache) mapCache.set(source, entry);
        return entry;
      } catch {
        if (!emptyCache) mapCache.set(source, null);
        return null;
      }
    }

    function mapSourcePosition(
      source: string,
      line: number,
      column: number
    ): MappedPosition | null {
      const entry = retrieveSourceMap(source);
      if (!entry) return null;

      const pos = entry.consumer.originalPositionFor({
        line,
        column: Math.max(0, column - 1),
      });

      if (!pos.source || pos.line == null || pos.column == null) {
        return null;
      }

      const resolvedSource = entry.url ? adapter.resolvePath(entry.url, pos.source) : pos.source;

      return {
        source: resolvedSource,
        line: pos.line,
        column: pos.column + 1,
        name: pos.name,
        mapUrl: entry.url,
      };
    }

    function formatCallSite(frame: V8CallSite, mapped: MappedPosition | null): string {
      if (frame.isNative()) {
        return 'native';
      }

      const fileName = mapped?.source ?? frame.getFileName() ?? frame.getScriptNameOrSourceURL?.();
      const line = mapped?.line ?? frame.getLineNumber();
      const column = mapped?.column ?? frame.getColumnNumber();
      const location =
        fileName != null
          ? `${fileName}${line != null ? `:${line}${column != null ? `:${column}` : ''}` : ''}`
          : '<anonymous>';

      const fnName = mapped?.name ?? frame.getFunctionName();
      const methodName = frame.getMethodName();
      const typeName = frame.getTypeName();
      const isConstructor = frame.isConstructor();
      const isAsync = frame.isAsync?.() ?? false;

      let namePart = '';
      if (fnName) {
        if (isConstructor) {
          namePart = `new ${fnName}`;
        } else if (typeName && !fnName.startsWith(`${typeName}.`)) {
          namePart = `${typeName}.${fnName}`;
        } else {
          namePart = fnName;
        }
        if (methodName && fnName !== methodName && !fnName.endsWith(`.${methodName}`)) {
          namePart += ` [as ${methodName}]`;
        }
      } else if (typeName && methodName) {
        namePart = `${typeName}.${methodName}`;
      } else if (isConstructor) {
        namePart = 'new <anonymous>';
      }

      const prefix = isAsync ? 'async ' : '';
      return namePart ? `${prefix}${namePart} (${location})` : `${prefix}${location}`;
    }

    function wrapCallSite(frame: V8CallSite): V8CallSite {
      const source = frame.getFileName() ?? frame.getScriptNameOrSourceURL?.();
      const line = frame.getLineNumber();
      const column = frame.getColumnNumber();

      const mapped =
        !frame.isNative() && source && line != null && column != null
          ? mapSourcePosition(source, line, column)
          : null;

      return {
        getThis: () => frame.getThis(),
        getTypeName: () => frame.getTypeName(),
        getFunction: () => frame.getFunction(),
        getFunctionName: () => mapped?.name ?? frame.getFunctionName(),
        getMethodName: () => frame.getMethodName(),
        getFileName: () => mapped?.source ?? frame.getFileName(),
        getScriptNameOrSourceURL: () => mapped?.source ?? frame.getScriptNameOrSourceURL?.(),
        getLineNumber: () => mapped?.line ?? frame.getLineNumber(),
        getColumnNumber: () => mapped?.column ?? frame.getColumnNumber(),
        getEvalOrigin: () => frame.getEvalOrigin(),
        isToplevel: () => frame.isToplevel(),
        isEval: () => frame.isEval(),
        isNative: () => frame.isNative(),
        isConstructor: () => frame.isConstructor(),
        isAsync: () => frame.isAsync?.() ?? false,
        toString: () => formatCallSite(frame, mapped),
      } as V8CallSite;
    }

    function getErrorSource(error: unknown): string | null {
      if (!(error instanceof Error) || !error.stack) return null;

      const match = /\n {4}at (?:.+?\()?(?:(.+?):(\d+):(\d+))\)?/.exec(error.stack);
      if (!match?.[1] || !match[2] || !match[3]) return null;

      const filePath = match[1];
      const lineNum = Number(match[2]);
      const colNum = Number(match[3]);

      let contents = retrieveFile(filePath);
      if (!contents) {
        for (const cached of mapCache.values()) {
          if (!cached) continue;
          const consumerWithSources = cached.consumer as unknown as { sources: string[] };
          const idx = consumerWithSources.sources.findIndex(
            (s: string) =>
              (cached.url ? adapter.resolvePath(cached.url, s) : s) === filePath || s === filePath
          );
          if (idx !== -1) {
            contents = cached.consumer.sourceContentFor(consumerWithSources.sources[idx]!, true);
            if (contents) break;
          }
        }
      }

      if (!contents) return null;
      const lines = contents.split(/\r\n|\n|\r/);
      const codeLine = lines[lineNum - 1];
      if (codeLine == null) return null;

      const caret = ' '.repeat(Math.max(0, colNum - 1)) + '^';
      return `${filePath}:${lineNum}\n${codeLine}\n${caret}`;
    }

    Error.prepareStackTrace = (error: Error, stack: NodeJS.CallSite[]) => {
      if (emptyCache) {
        fileCache.clear();
        mapCache.clear();
      }

      const name = error.name || 'Error';
      const message = error.message ? `: ${error.message}` : '';
      const header = `${name}${message}`;

      const frames = stack.map(
        (frame) => `\n    at ${wrapCallSite(frame as V8CallSite).toString()}`
      );
      return header + frames.join('');
    };

    const shouldHandleUncaught = options.handleUncaughtExceptions ?? adapter.isNode;
    if (shouldHandleUncaught && adapter.registerUncaughtExceptionHandler) {
      adapter.registerUncaughtExceptionHandler(getErrorSource);
    }
  };
}
