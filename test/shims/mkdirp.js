function notSupported(name) {
  return () => {
    throw new Error(`mkdirp ${name}() is not supported in browser environments`)
  }
}

const mkdirp = notSupported('mkdirp')
mkdirp.sync = notSupported('sync')

export default mkdirp
