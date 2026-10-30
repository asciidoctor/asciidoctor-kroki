# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-10-30

It includes every change from the `2.0.0-rc.*` prereleases. See [What's New in 2.0](https://docs.asciidoctor.org/kroki-extension/latest/whats-new/) to upgrade from version 1.0.

With JavaScript, this version requires [Asciidoctor.js 4](https://github.com/asciidoctor/asciidoctor.js) (`@asciidoctor/core` `>=4.0.0 <5.0.0`). It is **not yet compatible with Antora**, which still bundles an older Asciidoctor.js; keep using the `latest-0` release line (currently 0.18.1) with Antora.

### Added

- Add support for [Lini](https://lini.rs) diagrams (`lini`), which requires Kroki 0.34.0 or later.
- Browser: support `kroki-fetch-diagram`. Since there is no disk to write to, diagrams are always embedded as data URIs, with or without `data-uri` or `kroki-data-uri`. Previously, the diagram was skipped and replaced by a `kroki-error` block.
- Ruby: support the `kroki-data-uri` (and standard `data-uri`) attribute to embed fetched diagrams as base64 data URIs instead of writing them to disk, matching the JavaScript/Node.js extension.
- Redirect `png` to `svg` for all diagram types Kroki can only render as SVG (`bpmn`, `bytefield`, `d2`, `dbml`, `excalidraw`, `goat`, `lini`, `nomnoml`, `pikchr`, `svgbob`, `wavedrom`) when `kroki-default-format` is set to `png`. The JavaScript/Node.js extension had no such redirect, and the Ruby gem only applied it to `goat`, `nomnoml`, `svgbob` and `wavedrom`.
- Ruby: resolve PlantUML `!include` directives (local, remote, and recursive — including `!include_many`, `!include_once`, `!includeurl`, and `!includesub`) before submitting the diagram to the Kroki server, matching the JavaScript/Node.js extension's preprocessor. The `kroki-plantuml-include-paths` attribute and `kroki-plantuml-include` for `c4plantuml` diagrams are now supported in the Ruby gem as well ([#259](https://github.com/asciidoctor/asciidoctor-kroki/issues/259)).
- Document how to reference a Vega-Lite `data.url` and link a PlantUML diagram to another page using Antora resource IDs ([#376](https://github.com/asciidoctor/asciidoctor-kroki/issues/376), [#291](https://github.com/asciidoctor/asciidoctor-kroki/issues/291)).
- Add a persistent, content-addressed cache for downloaded diagrams (`kroki-cache` and `kroki-cache-dir` attributes), available in both the JavaScript/Node.js extension and the Ruby gem. Diagrams with a stable, user-defined name now skip the download when their content hasn't changed, and the cache survives builds that clear the output directory, such as Antora ([#90](https://github.com/asciidoctor/asciidoctor-kroki/issues/90), [#113](https://github.com/asciidoctor/asciidoctor-kroki/issues/113)).

### Changed

- **Breaking:** a relative `!include`, `kroki-plantuml-include` or Vega-Lite `data.url` in a diagram written in the document is resolved from the document's base directory, like `include::`. It was resolved from the current working directory, so the result depended on where the conversion was started. An `!include` that does not exist in the base directory is still looked up in the current working directory (Ruby and JavaScript/Node.js, except `kroki-plantuml-include` in Ruby, which already used the base directory; the Ruby gem does not preprocess Vega-Lite).
- **Breaking:** Ruby: the `subs` attribute is applied before the `!include` directives are resolved, like the JavaScript/Node.js extension. `!include {dir}/file.puml` is now resolved, and the content of an included file is no longer substituted.
- **Breaking:** reading a resource referenced by a document now follows the rules of the `include::` directive. In `safe` and `server` modes, a PlantUML `!include`, `kroki-plantuml-include`, `kroki-plantuml-include-paths`, a Structurizr `!include` and a Vega-Lite `data.url` can no longer read a local file outside of the base directory. A URL is only read if `allow-uri-read` is set. In `secure` mode, a block macro no longer reads a URL target, even if `allow-uri-read` is set. A warning is logged, and the `!include` directive is left for the Kroki server (a Vega-Lite diagram that references a local file becomes an error block). This does not apply in the browser or with a custom virtual file system that provides `read` (Ruby and JavaScript/Node.js).
- **Breaking:** the JavaScript/Node.js extension now exports `register` as a named export instead of a default export with a `register` method. Update `asciidoctorKroki.register(registry)` to `import { register } from 'asciidoctor-kroki'; register(registry)`.
- **Breaking:** the source entry point and generated TypeScript declarations move to `src/index.js` and a top-level `types/` directory, matching the layout used by `asciidoctor.js`. Consumers using the package's documented `exports` field are unaffected; only direct imports of internal file paths need updating.
- **Breaking:** the JavaScript/Node.js custom VFS `exists` and `add` methods are now expected to be asynchronous (return a promise), matching `read`. A synchronous implementation still works (the extension always awaits the result), but update any implementation relying on synchronous completion.
- Block macro whose target cannot be read: the Ruby extension now renders a `kroki-error` paragraph that keeps the title and the role, and logs a warning instead of an error, like the JavaScript/Node.js extension. Both now display `Unresolved block macro - plantuml::target[]`, with the target written in the document instead of its absolute path (Ruby and JavaScript/Node.js).

### Removed

- **Breaking:** Ruby: drop support for Ruby 2.7. The gem is now tested on Ruby 3.2 and 3.4.

### Fixed

- Ruby: `kroki-plantuml-include` accepts a URL, as documented, read only if `allow-uri-read` is set, like the JavaScript/Node.js extension. The URL was handled as a local path.
- Ruby: an empty `format` attribute (e.g. `[plantuml,format=]`) or an empty `kroki-default-format` attribute is ignored, like the JavaScript/Node.js extension, so the diagram uses the default format. The request URL had no format (e.g. `https://kroki.io/plantuml//...`).
- `kroki-plantuml-include` that references a missing file or a directory: a warning is logged and the attribute is ignored. The Ruby extension failed with `EISDIR` on a directory, and the JavaScript/Node.js extension left the `!include` directive in the diagram source without a warning (Ruby and JavaScript/Node.js).
- Ruby: an empty `role` (e.g. `[plantuml,role=]`) no longer adds a `kroki-format-svg` class, like the JavaScript/Node.js extension.
- Ruby: an empty `kroki-server-url` attribute falls back to `https://kroki.io` (the image URLs were relative), and an empty `kroki-plantuml-include` attribute is ignored (the conversion of PlantUML diagrams failed with `EISDIR`), like the JavaScript/Node.js extension.
- A blank `format`, `kroki-default-format`, `kroki-server-url`, `kroki-plantuml-include`, `kroki-plantuml-include-paths` or `kroki-cache-dir` attribute (e.g. `format=" "`), or one set to `true` through the API, is treated as unset. Surrounding whitespace is removed from their values (Ruby and JavaScript/Node.js).
- Ruby: keep the title of a diagram block or block macro on the `kroki-error` block that replaces it when the diagram cannot be converted (e.g., the Kroki server is unreachable), like the JavaScript/Node.js extension. The title was dropped.
- Block macro with an `http://` or `https://` URL as target (e.g. `plantuml::https://example.org/hello.puml[]`): the URL is no longer turned into a local path, so the diagram source is downloaded as documented. Like `include::`, the URL is only read when `allow-uri-read` is set; otherwise, the macro is replaced by a link (Ruby and JavaScript/Node.js).
- Trailing slashes in `kroki-server-url` are removed when building the request URLs and the cache key, so that `https://my.domain.org/kroki/` no longer produces `https://my.domain.org/kroki//plantuml/svg/...`. The Ruby extension already removed them from GET URLs, but not from POST URLs (`kroki-http-method` set to `post`, or `adaptive` when the URI exceeds `kroki-max-uri-length`); the JavaScript extension removed them nowhere (Ruby and JavaScript/Node.js).
- Reuse the persistent diagram cache for `data-uri` and `kroki-data-uri` output when `kroki-fetch-diagram` is enabled, avoiding repeated downloads of unchanged embedded images while preserving cache invalidation, disable, and refresh behavior. Embedded images are therefore now written to the cache directory; set `kroki-cache` to `false` to opt out.
- The persistent diagram cache is now best-effort: when the cache directory cannot be read or written (e.g. read-only file system), diagrams are fetched from the Kroki server and a single warning is logged, instead of being skipped.
- Cache entries are now written atomically, so an interrupted build or concurrent builds sharing the cache can no longer leave a truncated entry that would be served on later builds. Empty entries left behind by previous versions are ignored.
- Ditaa: translate the `separation=false` option used by asciidoctor-diagram into Kroki's `no-separation` flag, so that adjacent boxes keep touching when migrating from asciidoctor-diagram. The unsupported `separation` option is no longer sent to Kroki, and an explicit `no-separation` option takes precedence.
- Ruby: a failure talking to the Kroki server (network error, non-2xx response, unexpected content-type) no longer aborts the whole document conversion or silently embeds the server's error message as if it were the diagram. It's now degraded to a warning and a `kroki-error`-styled block showing the raw diagram source, matching the JavaScript/Node.js extension. **Possibly breaking:** a custom `:http_client` now receives an additional `expected_content_type` argument on `get`/`post`.
- Ruby: log the missing warning when `kroki-http-method` is `get` and the diagram URI exceeds `kroki-max-uri-length`, and fall back to the 4000 default instead of silently treating an invalid `kroki-max-uri-length` value as `0`. Both already matched the JavaScript/Node.js extension's intent but weren't implemented.
- Ruby: align the `inline` option's fallback with the JavaScript/Node.js extension by resolving to a data URI when `allow-uri-read` is not set. This stays inert until a released Asciidoctor gem picks up the fix for [asciidoctor/asciidoctor#3791](https://github.com/asciidoctor/asciidoctor/issues/3791), merged upstream (already effective in the JavaScript/Node.js extension against Asciidoctor.js 4.0.2+).
- JavaScript/Node.js: the `inline` option without `allow-uri-read` now actually embeds the diagram instead of a blank placeholder, provided Asciidoctor.js 4.0.2+ is used — that version decodes a `data:` URI image target directly instead of refusing to read it without `allow-uri-read` ([asciidoctor/asciidoctor#3791](https://github.com/asciidoctor/asciidoctor/issues/3791)). No code change was needed; the test suite's `@asciidoctor/core` dependency is bumped to 4.0.8 to cover it.
- Fix the README Quick start example, which called `register` on the `Extensions` namespace directly instead of on a registry instance.
- Fix `ReferenceError: Buffer is not defined` when building a `data:` URI diagram in a real browser.
- Fix the converter not finding a fetched diagram when `imagesoutdir` differs from `imagesdir`, by setting an `imagesdir` override on the generated image node instead of relying on the document-wide attribute ([#373](https://github.com/asciidoctor/asciidoctor-kroki/issues/373)). Effective now in the JavaScript/Node.js extension (Asciidoctor.js 4.0+); the Ruby gem carries the same fix but it stays inert until Asciidoctor Ruby ships node-level `imagesdir` support (merged upstream, not yet released).

### Security

- A document can no longer write outside of the base directory or the output directory in `safe` and `server` modes using the `imagesoutdir`, `imagesdir`, `outdir` or `kroki-cache-dir` attributes: a warning is logged, and the diagram is embedded as a data URI (or the default cache directory is used). Values set from the API or the CLI are not affected, nor is a custom virtual file system that provides `add` (Ruby and JavaScript/Node.js).
- A diagram name (e.g. `[plantuml,../../name]`) can no longer write the file generated by `kroki-fetch-diagram` outside of the output directory in `safe` and `server` modes: a warning is logged, and a content-addressed name is used. A format with a path separator is rejected in all safe modes, as it is also part of the name of the cache entry (Ruby and JavaScript/Node.js).
- JavaScript/Node.js: `kroki-plantuml-include` can no longer read a file outside of the base directory in `safe` and `server` modes, like the Ruby extension.
- Ruby: limit the duration (60s, including receiving the body) and the size (25 MiB, enforced while reading) of HTTP responses, for Kroki requests and remote reads, like the JavaScript/Node.js extension.
- JavaScript/Node.js: limit the duration (60s, including receiving the body) and the size (25 MiB, enforced while streaming) of HTTP responses, for Kroki requests and remote includes (CWE-400). Both limits can be changed with the `http` option of `register()`. Previously, requests had no timeout.

## [1.0.1] - 2026-07-15

### Added

- Publish TypeScript type declarations, generated from the JSDoc annotations (`tsc --emitDeclarationOnly` into `build/types`). The package now declares a `types` entry point so TypeScript consumers get typed `register`, `KrokiContext` and `Vfs` APIs.

## [1.0.0] - 2026-07-14

First stable release. It includes every change from the `1.0.0-beta.*` prereleases.

This version requires [Asciidoctor.js 4.0](https://github.com/asciidoctor/asciidoctor.js) (`@asciidoctor/core` `>=4.0.0 <5.0.0`).
It is **not yet compatible with Antora**, which still bundles an older Asciidoctor.js; keep using the `latest-0` release line (currently 0.18.1) with Antora.
See the [installation guide](https://docs.asciidoctor.org/kroki-extension/latest/install/#antora).

## [1.0.0-beta.2] - 2026-07-06

### Changed

- The `inline` option (`opts=inline` or `kroki-default-options: inline`) now embeds the diagram as a `data:` URI image target when neither `kroki-fetch-diagram` nor `allow-uri-read` is set, instead of producing a server URL the converter cannot read (which rendered as the image's alt text). The extension still only sets the image target — the converter decides how to render it — so DocBook, PDF and other backends keep working from the same data-URI image. Inlining the result as `<svg>` requires `@asciidoctor/core` with `data:`-URI inline SVG support.

### Fixed

- Encode diagram sources with `TextEncoder`/`btoa` instead of the Node-only `Buffer` global, so the JavaScript extension works in a real browser (VS Code for the Web / vscode.dev) where modern bundlers no longer polyfill `Buffer`. Previously every diagram failed with `ReferenceError: Buffer is not defined`; the new encoding produces byte-for-byte identical output.
- Attach a source location to warnings emitted when a diagram is skipped, so the message points at the offending block instead of embedding a JSON stack blob.

## [1.0.0-beta.1] - 2026-06-23

### Added

- Ruby: support the `kroki-default-options` document attribute, on par with the JavaScript extension ([#156](https://github.com/asciidoctor/asciidoctor-kroki/issues/156)).

### Changed

- **Breaking:** require Asciidoctor.js 4.0 (`@asciidoctor/core` `>=4.0.0 <5.0.0`). Antora is not yet supported because it ships an older Asciidoctor.js; use the `latest-0` release line with Antora until it upgrades.
- Use a stable file name for fetched diagrams that are given an explicit name: `[ditaa,foo]` now generates `foo.svg` instead of `foo-<checksum>.svg`, so links to generated images stay stable across content changes. Anonymous diagrams keep a content-addressed name (`diag-<sha256>.svg`); reusing the same name for diagrams with different content overwrites the file and logs a warning. The JavaScript checksum is also switched from SHA-1 to SHA-256 to match the Ruby gem ([#451](https://github.com/asciidoctor/asciidoctor-kroki/issues/451)).
- Lower the minimum supported Node.js version to 22 (nothing in the code requires Node.js 24).
- Document the feature parity between the JavaScript/Node.js extension and the Ruby gem. Preprocessing (resolving PlantUML/Structurizr `!include` and Vega-Lite `data.url`) and `kroki-plantuml-include-paths` are available in the JavaScript/Node.js extension only; the Ruby gem relies on the Kroki server to resolve includes.

### Fixed

- Resolve relative `!include` directives nested inside a remote PlantUML/Structurizr file against the remote URL of the including file, instead of looking them up on the local file system and silently skipping them ([#398](https://github.com/asciidoctor/asciidoctor-kroki/issues/398)).
- Fix the broken documentation link in the README.
