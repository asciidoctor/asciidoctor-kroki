// @ts-check

import assert from 'node:assert'
import os from 'node:os'
import { after, before, describe, test } from 'node:test'
import { load } from '@asciidoctor/core'
import { GenericContainer } from 'testcontainers'
import httpClient from '../../src/http/http-client.js'
import { KrokiClient, KrokiDiagram } from '../../src/kroki-client.js'
import { readFixture } from './utils.js'

let container
let krokiServerUrl

describe('Kroki HTTP client — Adaptive mode with real server', { timeout: 30000 }, () => {
  if (os.platform() !== 'win32') {
    before(
      async () => {
        container = await new GenericContainer('yuzutech/kroki:0.28.0')
          .withExposedPorts(8000)
          .start()
        krokiServerUrl = `http://${container.getHost()}:${container.getMappedPort(8000)}`
      },
      { timeout: 60000 },
    )

    after(
      async () => {
        await container.stop()
      },
      { timeout: 60000 },
    )

    test.skip('uses GET when the diagram URI length is <= 4000', async () => {
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
      const image = krokiClient
        .getImage(krokiDiagram)
        .replace(/\r/, '')
        .replace(/\n/, '')
      const expected = readFixture('expected', 'chart.svg')
        .replace(/\r/, '')
        .replace(/\n/, '')
      assert.strictEqual(image, expected)
    })

    test.skip('uses POST when the diagram URI length is > 4000', async () => {
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
      const image = krokiClient
        .getImage(krokiDiagram)
        .replace(/\r/, '')
        .replace(/\n/, '')
      const expected = readFixture('expected', 'cars-repeated-charts.svg')
        .replace(/\r/, '')
        .replace(/\n/, '')
      assert.strictEqual(image, expected)
    })
  }
})