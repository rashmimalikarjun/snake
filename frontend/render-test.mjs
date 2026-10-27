import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const esbuild = require('esbuild')

// shim react-dom/server's node stream builtins for bundling
const shimPlugin = {
  name: 'node-shims',
  setup(b) {
    b.onResolve({ filter: /^(stream|buffer|util|events)$/ }, (a) => ({ path: a.path, namespace: 'shim' }))
    b.onLoad({ filter: /.*/ }, async (args) => {
      const mod = await import('node:' + args.path)
      return { contents: `export default ${JSON.stringify(Object.keys(mod))} /*unused*/;\nconst m = globalThis.__shims['${args.path}'];\nexport const Stream = m.Stream; export const Readable = m.Readable; export const Writable = m.Writable; export const finished = m.finished; export const pipeline = m.pipeline; export const Buffer = globalThis.Buffer; export const TextEncoder = m.TextEncoder; export const TextDecoder = m.TextDecoder; export const inspect = m.inspect; export const format = m.format; export const EventEmitter = m.EventEmitter;`, loader: 'js' }
    })
  },
}

const result = await esbuild.build({
  stdin: {
    contents: `
      import React from 'react'
      import { renderToString } from 'react-dom/server'
      import App from './src/App.jsx'
      globalThis.__html = renderToString(React.createElement(App))
    `,
    resolveDir: process.cwd(),
    loader: 'jsx',
  },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'base64', '.svg': 'text' },
})
globalThis.window = globalThis
globalThis.document = { hidden: false, addEventListener(){}, removeEventListener(){}, activeElement:null }
globalThis.localStorage = { getItem: () => null, setItem(){}, removeItem(){} }
globalThis.navigator = { userAgent: 'node' }
let code = result.outputFiles[0].text
// replace every empty-import-meta placeholder (minified var name varies) with a stub env
code = code.replace(/\b([A-Za-z_$][\w$]*)\.env\b/g, '({VITE_API_URL:""})')
const Module = require('module')
const m = new Module('apptest')
m.paths = Module._nodeModulePaths(process.cwd())
try {
  m._compile(code, '/tmp/apptest.cjs')
} catch (e) {
  console.log('RENDER FAILED:', e.constructor.name, '-', String(e.message).split('\n')[0])
  process.exit(1)
}
const html = globalThis.__html || ''
console.log('RENDER OK, html length =', html.length)
console.log('has menu item SNAKE XENZIA:', html.includes('SNAKE XENZIA'))
process.exit(html.includes('SNAKE XENZIA') ? 0 : 1)
