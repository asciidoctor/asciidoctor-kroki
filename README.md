# 🖍 Asciidoctor Kroki Extension


[![Travis build status](http://img.shields.io/travis/Mogztter/asciidoctor-kroki.js.svg)](https://travis-ci.org/Mogztter/asciidoctor-kroki)
[![npm version](http://img.shields.io/npm/v/asciidoctor-kroki.svg)](https://www.npmjs.com/package/asciidoctor-kroki)

An extension for [Asciidoctor.js](https://github.com/asciidoctor/asciidoctor.js) to convert diagrams to images using [Kroki](https://kroki.io)!

## Install

### Node.js

Install the dependencies:

    $ npm install asciidoctor asciidoctor-kroki

Create a file named `kroki.js` with following content and run it:

```javascript
const asciidoctor = require('@asciidoctor/core')()
const kroki = require('asciidoctor-kroki')

const input = 'spreadsheet:sales.csv[3,2]'

kroki.register(asciidoctor.Extensions)
console.log(asciidoctor.convert(input)) // <1>

const registry = asciidoctor.Extensions.create()
kroki.register(registry)
console.log(asciidoctor.convert(input, {'extension_registry': registry})) // <2>
```
<1> Register the extension in the global registry
<2> Register the extension in a dedicated registry

### Browser

Install the dependencies:

    $ npm install asciidoctor asciidoctor-kroki

Create a file named `kroki.html` with the following content and open it in your browser:

```html
<html>
  <head>
    <script src="node_modules/asciidoctor/dist/browser/asciidoctor.js"></script>
    <script src="node_modules/asciidoctor-kroki/dist/browser/asciidoctor-kroki.js"></script>
  </head>
  <body>
    <div id="content"></div>
    <script>
      var input = 'spreadsheet:sales.csv[3,2]'

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
[plantuml,svg,role=sequence]
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

