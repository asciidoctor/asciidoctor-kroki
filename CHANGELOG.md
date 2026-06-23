# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Ruby: support the `kroki-default-options` document attribute, on par with the JavaScript extension ([#156](https://github.com/asciidoctor/asciidoctor-kroki/issues/156)).

### Changed

- Use a stable file name for fetched diagrams that are given an explicit name: `[ditaa,foo]` now generates `foo.svg` instead of `foo-<checksum>.svg`, so links to generated images stay stable across content changes. Anonymous diagrams keep a content-addressed name (`diag-<sha256>.svg`); reusing the same name for diagrams with different content overwrites the file and logs a warning. The JavaScript checksum is also switched from SHA-1 to SHA-256 to match the Ruby gem ([#451](https://github.com/asciidoctor/asciidoctor-kroki/issues/451)).
- Lower the minimum supported Node.js version to 22 (nothing in the code requires Node.js 24).
- Document the feature parity between the JavaScript/Node.js extension and the Ruby gem. Preprocessing (resolving PlantUML/Structurizr `!include` and Vega-Lite `data.url`) and `kroki-plantuml-include-paths` are available in the JavaScript/Node.js extension only; the Ruby gem relies on the Kroki server to resolve includes.

### Fixed

- Resolve relative `!include` directives nested inside a remote PlantUML/Structurizr file against the remote URL of the including file, instead of looking them up on the local file system and silently skipping them ([#398](https://github.com/asciidoctor/asciidoctor-kroki/issues/398)).
- Fix the broken documentation link in the README.