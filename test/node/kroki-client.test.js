// @ts-check

import assert from 'node:assert'
import os from 'node:os'
import { after, before, describe, test } from 'node:test'
import { load } from '@asciidoctor/core'
import { GenericContainer } from 'testcontainers'
import httpClient from '../../src/http-client.js'
import { KrokiClient, KrokiDiagram } from '../../src/kroki-client.js'
import { readFixture } from './utils.js'

let container
let krokiServerUrl

describe('Kroki HTTP client — Adaptive mode with real server', {
  timeout: 120000,
}, () => {
  const isMacOS = os.platform() === 'darwin'
  if (os.platform() !== 'win32') {
    before(
      async () => {
        container = await new GenericContainer('yuzutech/kroki:0.30.1')
          .withExposedPorts(8000)
          .start()
        krokiServerUrl = `http://${container.getHost()}:${container.getMappedPort(8000)}`
      },
      // pulling the Kroki image alone can take more than a minute on CI runners
      { timeout: 180000 },
    )

    after(
      async () => {
        await container.stop()
      },
      { timeout: 60000 },
    )

    test('uses GET when the diagram URI length is <= 4000', async () => {
      const doc = await load('', {
        attributes: { 'kroki-server-url': krokiServerUrl },
      })
      const krokiClient = new KrokiClient(doc, httpClient)
      const krokiDiagram = new KrokiDiagram(
        'vegalite',
        'svg',
        readFixture('chart.vlite'),
        {},
      )
      const image = (await krokiClient.getImage(krokiDiagram))
        .replace(/\r/, '')
        .replace(/\n/, '')
      const expected = readFixture(
        'expected',
        isMacOS ? 'chart-macos.svg' : 'chart.svg',
      )
        .replace(/\r/, '')
        .replace(/\n/, '')
      assert.strictEqual(image, expected)
    })

    test('uses POST when the diagram URI length is > 4000', async () => {
      const doc = await load('', {
        attributes: { 'kroki-server-url': krokiServerUrl },
      })
      const krokiClient = new KrokiClient(doc, httpClient)
      const krokiDiagram = new KrokiDiagram(
        'vegalite',
        'svg',
        readFixture('cars-repeated-charts.vlite'),
        {},
      )
      const image = (await krokiClient.getImage(krokiDiagram))
        .replace(/\r/, '')
        .replace(/\n/, '')
      const expected = readFixture(
        'expected',
        isMacOS ? 'cars-repeated-charts-macos.svg' : 'cars-repeated-charts.svg',
      )
        .replace(/\r/, '')
        .replace(/\n/, '')
      assert.strictEqual(image, expected)
    })
  }
})
