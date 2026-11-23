<h1 align="center">
  <sup>esbuild-plugin-source-map</sup>
  <br>
  <a href="https://github.com/shahradelahi/esbuild-plugin-source-map/actions/workflows/ci.yml"><img src="https://github.com/shahradelahi/esbuild-plugin-source-map/actions/workflows/ci.yml/badge.svg?branch=main&event=push" alt="CI"></a>
  <a href="https://www.npmjs.com/package/esbuild-plugin-source-map"><img src="https://img.shields.io/npm/v/esbuild-plugin-source-map.svg" alt="NPM Version"></a>
  <a href="/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="MIT License"></a>
  <a href="https://bundlephobia.com/package/esbuild-plugin-source-map"><img src="https://img.shields.io/bundlephobia/minzip/esbuild-plugin-source-map" alt="npm bundle size"></a>
  <a href="https://packagephobia.com/result?p=esbuild-plugin-source-map"><img src="https://packagephobia.com/badge?p=esbuild-plugin-source-map" alt="Install Size"></a>
</h1>

_esbuild-plugin-source-map_ is a source map support plugin for esbuild powered by Mozilla's source-map library.

---

- [Installation](#-installation)
- [Usage](#-usage)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#license)

## 📦 Installation

```bash
npm install esbuild-plugin-source-map
```

<details>
<summary>Install using your favorite package manager</summary>

**pnpm**

```bash
pnpm install esbuild-plugin-source-map
```

**yarn**

```bash
yarn add esbuild-plugin-source-map
```

</details>

## 📖 Usage

### esbuild Plugin

```ts
import esbuild from 'esbuild';
import SourceMapSupportPlugin from 'esbuild-plugin-source-map';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  plugins: [
    SourceMapSupportPlugin({
      handleUncaughtExceptions: true,
    }),
  ],
});
```

## 📚 Documentation

For all configuration options, please see [the API docs](https://www.jsdocs.io/package/esbuild-plugin-source-map).

## 🤝 Contributing

Want to contribute? Awesome! To show your support is to star the project, or to raise issues on [GitHub](https://github.com/shahradelahi/esbuild-plugin-source-map).

Thanks again for your support, it is much appreciated! 🙏

## License

[MIT](/LICENSE) © [Shahrad Elahi](https://github.com/shahradelahi) and [contributors](https://github.com/shahradelahi/esbuild-plugin-source-map/graphs/contributors).
