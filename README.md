# 🖍 Asciidoctor Kroki Extension

[![Build status](https://github.com/Mogztter/asciidoctor-kroki/workflows/Build/badge.svg)](https://github.com/Mogztter/asciidoctor-kroki/actions?query=workflow%3ABuild+branch%3Amaster)
[![npm version](http://img.shields.io/npm/v/asciidoctor-kroki.svg)](https://www.npmjs.com/package/asciidoctor-kroki)
[![Gitter](https://img.shields.io/gitter/room/kroki-project/community)](https://gitter.im/kroki-project/community)

An extension for [Asciidoctor.js](https://github.com/asciidoctor/asciidoctor.js) to convert diagrams to images using [Kroki](https://kroki.io)!

  * [Install](#install)
    + [Node.js](#nodejs)
    + [Browser](#browser)
    + [Antora Integration](#antora-integration)
  * [Usage](#usage)
    + [Supported diagram types](#supported-diagram-types)
  * [Configuration](#configuration)
  * [Using Your Own Kroki](#using-your-own-kroki)
  * [Contributing](#contributing)
    + [Setup](#setup)
    + [Building](#building)

## Install

### Node.js

Install the dependencies:

    $ npm i asciidoctor asciidoctor-kroki

Create a file named `kroki.js` with following content and run it:

```javascript
const asciidoctor = require('@asciidoctor/core')()
const kroki = require('asciidoctor-kroki')

const input = 'plantuml::hello.puml[svg,role=sequence]'

kroki.register(asciidoctor.Extensions) // <1>
console.log(asciidoctor.convert(input))

const registry = asciidoctor.Extensions.create()
kroki.register(registry) // <2>
console.log(asciidoctor.convert(input, {'extension_registry': registry}))
```
**<1>** Register the extension in the global registry <br/>
**<2>** Register the extension in a dedicated registry

### Browser

Install the dependencies:

    $ npm i asciidoctor asciidoctor-kroki

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
      kroki.register(registry) // <1>
      var result = asciidoctor.convert(input, {'extension_registry': registry})
      document.getElementById('content').innerHTML = result
    </script>
  </body>
</html>
```
**<1>** Register the extension in a dedicated registry

### Antora Integration

If you are using [Antora](https://antora.org/), you can integrate Kroki in your documentation site.

1. Install the extension in your playbook project:

       $ npm i asciidoctor-kroki

2. Register the extension in your playbook file:

    ```yaml
    asciidoc:
      extensions:
        - asciidoctor-kroki
    ```

    https://docs.antora.org/antora/2.3/playbook/configure-asciidoc/#extensions

3. Enjoy!

**💡 TIP**:
You can use the `kroki-fetch-diagram` option to download the images from Kroki at build time.
In other words, while viewing pages you won't rely on Kroki anymore.

```yaml
asciidoc:
  attributes:
    kroki-fetch-diagram: true
```

## Usage

In your AsciiDoc document, you can either write your diagram inline or alternatively you can make a reference to the diagram file using macro form or with the `include` directive.

Here's an example where we declare a GraphViz diagram directly in our AsciiDoc document using the block syntax:

```adoc
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

![GraphViz diagram](https://kroki.io/graphviz/png/eNo9jjEOwjAMRfee4itzGKBzuEjVIaldWsnEVQBBVXp3AqQdLFlP_32bxkvy04BeFUsFRCVGc7vPwi7pIxJTW_Ax88FP7IK-NnZC048inYomN7OIPi3-tim6_QaYTOY_m0Z_1bi31ltr4k4TWYgPLM4s8Hgj5Omwmrbanzicy-Wy1NX6AUS2QVQ=)

In the example below, we are using the `vegalite` macro to reference a file named *chart.vlite*:

```
vegalite::chart.vlite[svg,role=chart,opts=interactive]
```

![Vega-Lite chart diagram](https://kroki.io/vegalite/png/eNrtVktz2yAQvvtXMEyOqt9pnNz6To-d6c3jA5ZWEg0CF7Ba26P_3gVb2JJSN8mhTWdyMIb92CffCnY9QuiFiXMoGL0hNLd2ZW4GgxIy1s-4zdfLPleD_QYvfSW4hUE57X8zStLI6SdgYs1XlqMAbdwqzbdKWibEhsRKxsyCxF9C4pxpa4jNmSUmVz9IwtMUNEhL7GYFhqgURWgMLN9ymRETMwGmf3DDrItxh3NclUysweB67teE7KjP4A2NCF3ibDyroib0toYuL9vQuxqaTtrQ-xq6HrWhDzU060Afg6-OwU81NLpuQ7fB4FUb-hwMjiuPLHD0m2i-L3Koxe6gSQum75xuzHUsgNYWKchYJVjfUE0v3TSWKEg5iMTpL4Oql7uzcmKpCi6ZaIJGaReJXAvRkLOf3LQcOFM8vnPilAkDURNLVMG4_A1ouRVw8HOCVGFeHRWo4Vt4bHLf10yiE2Z5Ca0MHSnvSaWhiA7_GFashNJ_P65WJbegFeJWr-E04oZpARnI5L7j258C_XI-6d7p_8H0C0v_PUtFhw2aycxtmM-GERm9xmE8xWEyxmE6HC6eJam7afgLy-8oWIZX26OZnSpd-E8qTWh0lvTihfT_C-ltrgHfHaJzpCGf-QR5fjVcnOuK8XDfEM-tF56c3bFZSq45PsDo0y-CryGIhzQFjj4YikpKlMfkOrmGWlIuE1hhEPhqPLbNgUYNMLioelXvF-H7eDo=)


Finally, we can use the `include` directive to reference a diagram file:

```
[plantuml,alice-bob,svg,role=sequence]
....
include::alice-bob.puml[]
....
```

![PlantUML diagram](https://kroki.io/plantuml/png/eNpzKC5JLCopzc3hSszJTE5V0LVTSMpP4nJIzUsBCgIApPUKcg==)

### Supported diagram types

Kroki currently supports the following diagram libraries:

* [ActDiag](https://github.com/blockdiag/actdiag): `actdiag`
* [BlockDiag](https://github.com/blockdiag/blockdiag): `blockdiag`
* [BPMN](https://github.com/bpmn-io/bpmn-js): `bpmn`
* [Bytefield](https://github.com/Deep-Symmetry/bytefield-svg/): `bytefield`
* [C4 (PlantUML)](https://github.com/RicardoNiepel/C4-PlantUML): `c4plantuml`
* [Ditaa](http://ditaa.sourceforge.net): `ditaa`
* [ERD](https://github.com/BurntSushi/erd): `erd`
* [GraphViz](https://www.graphviz.org/): `graphviz`
* [Mermaid](https://github.com/knsv/mermaid): `mermaid`
* [Nomnoml](https://github.com/skanaar/nomnoml): `nomnoml`
* [NwDiag](https://github.com/blockdiag/nwdiag): `nwdiag`
* [PacketDiag](https://github.com/blockdiag/nwdiag): `packetdiag`
* [PlantUML](https://github.com/plantuml/plantuml): `plantuml`
* [RackDiag](https://github.com/blockdiag/nwdiag): `rackdiag`
* [SeqDiag](https://github.com/blockdiag/seqdiag): `seqdiag`
* [SVGBob](https://github.com/ivanceras/svgbob): `svgbob`
* [UMLet](https://github.com/umlet/umlet): `umlet`
* [Vega](https://github.com/vega/vega): `vega`
* [Vega-Lite](https://github.com/vega/vega-lite): `vegalite`
* [WaveDrom](https://github.com/wavedrom/wavedrom): `wavedrom`

Each diagram libraries support one or more output formats.
Consult the [Kroki documentation](https://kroki.io/#support) to find out which formats are supported.

## Configuration

| Attribute name | Description | Default value  |
| ---- | ---- | ---- |
| `kroki-server-url` | The URL of the Kroki server (see "Using Your Own Kroki") | `https://kroki.io`
| `kroki-fetch-diagram` | Define if we should download (and save on the disk) the images from the Kroki server.<br/>This feature is not available when running in the browser. | `false`
| `kroki-http-method` | Define how we should get the image from the Kroki server. Possible values:<br/><ul><li>`get`: always use GET requests</li><li>`post`: always use POST requests</li><li>`adaptive`: use a POST request if the URI length is longer than 4096 characters, otherwise use a GET request</li></ul> | `adaptive` |

## Using Your Own Kroki

By default, this extension sends information and receives diagrams back from https://kroki.io.

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
