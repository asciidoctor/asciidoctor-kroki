import assert from 'node:assert'
import { describe, test } from 'node:test'
import { Extensions } from '@asciidoctor/core'
import asciidoctorKroki from '../src/asciidoctor-kroki.js'

describe('Registration', () => {
  test('registers block macros for all supported diagram types', () => {
    const registry = Extensions.create()
    assert.strictEqual(registry.hasBlockMacros(), false)
    asciidoctorKroki.register(registry)
    assert.strictEqual(registry.hasBlockMacros(), true)
    assert.ok(registry.registeredForBlockMacro('plantuml'))
    assert.ok(registry.registeredForBlockMacro('vega'))
    assert.ok(registry.registeredForBlockMacro('vegalite'))
    assert.ok(registry.registeredForBlockMacro('packetdiag'))
    assert.ok(registry.registeredForBlockMacro('rackdiag'))
    assert.ok(registry.registeredForBlockMacro('wavedrom'))
    assert.ok(registry.registeredForBlockMacro('excalidraw'))
    assert.ok(registry.registeredForBlockMacro('pikchr'))
    assert.ok(registry.registeredForBlockMacro('structurizr'))
    assert.ok(registry.registeredForBlockMacro('diagramsnet'))
    assert.ok(registry.registeredForBlockMacro('wireviz'))
  })
})
