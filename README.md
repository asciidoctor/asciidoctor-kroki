# 🖍 Asciidoctor Kroki Extension

[![Travis build status](http://img.shields.io/travis/Mogztter/asciidoctor-kroki.svg)](https://travis-ci.org/Mogztter/asciidoctor-kroki)
[![npm version](http://img.shields.io/npm/v/asciidoctor-kroki.svg)](https://www.npmjs.com/package/asciidoctor-kroki)
[![Gitter](https://img.shields.io/gitter/room/kroki-project/community)](https://gitter.im/kroki-project/community)

An extension for [Asciidoctor.js](https://github.com/asciidoctor/asciidoctor.js) to convert diagrams to images using [Kroki](https://kroki.io)!

## Install

### Node.js

Install the dependencies:

    $ npm install asciidoctor asciidoctor-kroki

Create a file named `kroki.js` with following content and run it:

```javascript
const asciidoctor = require('@asciidoctor/core')()
const kroki = require('asciidoctor-kroki')

const input = 'plantuml::hello.puml[svg,role=sequence]'

kroki.register(asciidoctor.Extensions)
console.log(asciidoctor.convert(input)) // <1>

const registry = asciidoctor.Extensions.create()
kroki.register(registry)
console.log(asciidoctor.convert(input, {'extension_registry': registry})) // <2>
```
**<1>** Register the extension in the global registry
**<2>** Register the extension in a dedicated registry

### Browser

Install the dependencies:

    $ npm install asciidoctor asciidoctor-kroki

Create a file named `kroki.html` with the following content and open it in your browser:

```html
<html>
  <head>
    <script src="node_modules/@asciidoctor/core/dist/browser/asciidoctor.js"></script>
    <script src="node_modules/asciidoctor-kroki/dist/browser/asciidoctor-kroki.js"></script>
  </head>
  <body>
    <div id="content"></div>
    <script>
      var input = 'plantuml::hello.puml[svg,role=sequence]'

      var asciidoctor = Asciidoctor()
      var kroki = AsciidoctorKroki

      const registry = asciidoctor.Extensions.create()
      kroki.register(registry)
      var result = asciidoctor.convert(input, {'extension_registry': registry})
      document.getElementById('content').innerHTML = result
    </script>
  </body>
</html>
```
**<1>** Register the extension in the global registry
**<2>** Register the extension in a dedicated registry

## Usage

```adoc
[plantuml,alice-bob,svg,role=sequence]
....
alice -> bob
....

[graphviz]
....
digraph foo {
  node [style=rounded]
  node1 [shape=box]
  node2 [fillcolor=yellow, style="rounded,filled", shape=diamond]
  node3 [shape=record, label="{ a | b | c }"]

  node1 -> node2 -> node3
}
....
```

## Using Your Own Kroki

By default this extension sends information and receives diagrams back from https://kroki.io.

You may choose to use your own server due to:

* Network restrictions - if Kroki is not available behind your corporate firewall
* Network latency - you are far from the European public instance
* Privacy - you don't want to send your diagrams to a remote server on the internet


This is done using the `kroki-server-url` attribute.
Typically, this is at the top of the document (under the title):

```adoc
:kroki-server-url: http://my-server-url:port
```

For instance, if you have followed [the instructions](https://docs.kroki.io/kroki/setup/install/#_using_docker) to set up a self-managed server using Docker you can use the following:

```adoc
:kroki-server-url: http://localhost:8080
```

Note that either the `http://` or `https://` prefix _is_ required (the default Docker image only uses `http`).

You can also set this attribute using the Javascript API, for instance:

```js
asciidoctor.convertFile('file.adoc', { attributes: { 'kroki-server-url': 'http://my-server-url:port' } })
```

## Contributing

### Setup

To build this project, you will need Node.js >= 8.11 and npm (we recommend `nvm` to manage multiple active Node.js versions).

### Building

1. Install the dependencies:

    $ npm i

2. Generate a distribution:

    $ npm run dist

When working on a new feature or when fixing a bug, make sure to run the linter and the tests suite:

    $ npm run lint
    $ npm run test
