#!/usr/bin/env node
// Copies the generated types/index.d.ts to types/index.d.cts so that CJS
// consumers (moduleResolution: node16/nodenext) resolve the package's types
// through the "require" condition of the "exports" map.
//
// Only the entry point needs a .d.cts twin: it's the only file referenced
// from package.json "exports". Every other generated .d.ts under types/ is
// reached indirectly, through index.d.ts's own relative imports, and is
// shared as-is between the ESM and CJS entry points.

import { copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const typesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'types')

copyFileSync(join(typesDir, 'index.d.ts'), join(typesDir, 'index.d.cts'))
