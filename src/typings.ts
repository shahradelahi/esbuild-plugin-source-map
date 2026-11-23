import type { BuildOptions } from 'esbuild';
import type { RawSourceMap } from 'source-map';

/**
 * Runtime environment target.
 */
export type RuntimeEnvironment = 'auto' | 'node' | 'browser';

/**
 * Retrieved source map structure.
 */
export interface RetrievedSourceMap {
  /**
   * Resolved URL or file path of the source map.
   */
  url: string | null;
  /**
   * Raw source map payload as a JSON string or object.
   */
  map: string | RawSourceMap;
}

/**
 * Options for initializing the runtime source map support.
 */
export interface RuntimeInstallOptions {
  /**
   * Override whether to attach a process uncaughtException handler in Node.
   * Defaults to true in Node environments.
   */
  handleUncaughtExceptions?: boolean;
  /**
   * Explicitly force node or browser behavior, or auto to detect at runtime.
   */
  environment?: RuntimeEnvironment;
  /**
   * Disable caching source files and SourceMapConsumer instances across stack traces.
   */
  emptyCacheBetweenOperations?: boolean;
  /**
   * Custom source map resolver for runtime manual calls to install.
   */
  retrieveSourceMap?: (source: string) => RetrievedSourceMap | null;
  /**
   * Custom source file reader for runtime manual calls to install.
   */
  retrieveFile?: (path: string) => string | null;
}

/**
 * Options for configuring the esbuild SourceMapSupportPlugin.
 */
export interface SourceMapSupportPluginOptions extends Omit<
  RuntimeInstallOptions,
  'retrieveSourceMap' | 'retrieveFile'
> {
  /**
   * Source map mode to set on esbuild if build.initialOptions.sourcemap is not already defined.
   * Defaults to inline when write is false, or linked (true) otherwise.
   */
  sourcemap?: BuildOptions['sourcemap'];
  /**
   * Optional glob patterns or predicate to limit which entry points trigger injection.
   */
  filter?: ((path: string) => boolean) | string[];
}
