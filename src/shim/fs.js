export default {
  add: (image) => {throw new Error('Unsupported method add')},
  exists: (path) => {throw new Error('Unsupported method exists')},
  read: (path, encoding = 'utf8') => {throw new Error('Unsupported method read')}
}
