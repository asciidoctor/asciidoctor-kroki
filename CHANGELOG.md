# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Ruby: support the `kroki-default-options` document attribute, on par with the JavaScript extension ([#156](https://github.com/asciidoctor/asciidoctor-kroki/issues/156)).

### Changed

- Lower the minimum supported Node.js version to 22 (nothing in the code requires Node.js 24).
- Document the feature parity between the JavaScript/Node.js extension and the Ruby gem. Preprocessing (resolving PlantUML/Structurizr `!include` and Vega-Lite `data.url`) and `kroki-plantuml-include-paths` are available in the JavaScript/Node.js extension only; the Ruby gem relies on the Kroki server to resolve includes.

### Fixed

- Resolve relative `!include` directives nested inside a remote PlantUML/Structurizr file against the remote URL of the including file, instead of looking them up on the local file system and silently skipping them ([#398](https://github.com/asciidoctor/asciidoctor-kroki/issues/398)).
- Fix the broken documentation link in the README.