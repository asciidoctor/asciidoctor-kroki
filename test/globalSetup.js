import { GenericContainer, Wait } from 'testcontainers'
import { KROKI_IMAGE } from './kroki-image.js'

let container

export async function setup({ provide }) {
  if (process.platform === 'win32') {
    return
  }
  container = await new GenericContainer(KROKI_IMAGE)
    .withExposedPorts(8000)
    .withWaitStrategy(Wait.forHttp('/health', 8000).forStatusCode(200))
    .start()

  provide('krokiUrl', `http://localhost:${container.getMappedPort(8000)}`)
}

export async function teardown() {
  await container?.stop()
}
