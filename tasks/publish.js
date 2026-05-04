'use strict'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const publish = (directory) => {
  const pkg = require(path.join(directory, 'package.json'))
  if (process.env.DRY_RUN) {
    console.log(`${pkg.name}@${pkg.version}`)
  } else {
    execFileSync('npm', ['pack'], { cwd: directory, stdio: 'inherit' })
    execFileSync('npm', ['publish', '--provenance', '--access', 'public'], {
      cwd: directory,
      stdio: 'inherit',
    })
  }
}

;(async () => {
  try {
    if (process.env.DRY_RUN) {
      console.warn(
        'Dry run! To publish the release, run the command again without DRY_RUN environment variable',
      )
    }
    const projectRootDirectory = path.join(__dirname, '..')
    publish(projectRootDirectory)
  } catch (e) {
    console.log('Unable to publish the package', e)
    process.exit(1)
  }
})()
