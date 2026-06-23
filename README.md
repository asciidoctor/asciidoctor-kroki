# Asciidoctor Kroki Extension

[![Build JavaScript](https://github.com/asciidoctor/asciidoctor-kroki/actions/workflows/build-js.yml/badge.svg)](https://github.com/asciidoctor/asciidoctor-kroki/actions/workflows/build-js.yml)
[![Build Ruby](https://github.com/asciidoctor/asciidoctor-kroki/actions/workflows/build-ruby.yml/badge.svg)](https://github.com/asciidoctor/asciidoctor-kroki/actions/workflows/build-ruby.yml)
[![npm version](http://img.shields.io/npm/v/asciidoctor-kroki.svg)](https://www.npmjs.com/package/asciidoctor-kroki)
[![Gem version](https://img.shields.io/gem/v/asciidoctor-kroki)](https://rubygems.org/gems/asciidoctor-kroki)
[![Zulip Chat](https://img.shields.io/badge/zulip-join_chat-brightgreen.svg)](https://kroki.zulipchat.com/)

An extension for [Asciidoctor.js](https://github.com/asciidoctor/asciidoctor.js) and [Asciidoctor](https://github.com/asciidoctor/asciidoctor) to convert diagrams to images using [Kroki](https://kroki.io).

## Documentation

Full documentation is available at **https://docs.asciidoctor.org/kroki-extension/latest**.

## Quick start

Install the dependencies:

    npm i asciidoctor asciidoctor-kroki

Register and use the extension:

```js
import { convert, Extensions } from '@asciidoctor/core'
import asciidoctorKroki from 'asciidoctor-kroki'

asciidoctorKroki.register(Extensions)
console.log(await convert('[graphviz]\n....\ndigraph G { Hello->World }\n....'))
```

For installation instructions for Node.js, Browser, Ruby, and Antora, as well as the full configuration reference, see the [documentation](https://docs.asciidoctor.org/kroki-extension/latest).

## Contributing

### Setup

To build this project, you will need the latest active LTS of Node.js.
We recommend [`volta`](https://volta.sh/) to manage multiple active Node.js versions.

### Building

1. Install the dependencies:

       npm i

2. Build the project:

       npm run build

When working on a new feature or when fixing a bug, make sure to run the formatter, the linter and the test suite:

    npm run format
    npm run lint
    npm run test
