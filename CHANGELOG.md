# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-beta.2] - 2026-07-06

First stable release. It includes every change from the `1.0.0-beta.*` prereleases.

This version requires [Asciidoctor.js 4.0](https://github.com/asciidoctor/asciidoctor.js) (`@asciidoctor/core` `>=4.0.0 <5.0.0`).
It is **not yet compatible with Antora**, which still bundles an older Asciidoctor.js; keep using the `latest-0` release line (currently 0.18.1) with Antora.
See the [installation guide](https://docs.asciidoctor.org/kroki-extension/latest/install/#antora).

### Changed

- The `inline` option (`opts=inline` or `kroki-default-options: inline`) now embeds the diagram as a `data:` URI image target when neither `kroki-fetch-diagram` nor `allow-uri-read` is set, instead of producing a server URL the converter cannot read (which rendered as the image's alt text). The extension still only sets the image target — the converter decides how to render it — so DocBook, PDF and other backends keep working from the same data-URI image. Inlining the result as `<svg>` requires `@asciidoctor/core` with `data:`-URI inline SVG support.

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
