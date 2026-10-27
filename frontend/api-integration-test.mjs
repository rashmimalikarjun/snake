import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
globalThis.window = { localStorage: { getItem: () => null, setItem(){}, removeItem(){} } }
globalThis.localStorage = globalThis.window.localStorage
const result = await esbuild.build({ stdin: { contents: `export * from './src/services/api.js'`, resolveDir: process.cwd(), loader: 'js' }, bundle: true, format: 'cjs', platform: 'node', write: false })
let code = result.outputFiles[0].text.replace(/\b([A-Za-z_$][\w$]*)\.env\b/g, '({VITE_API_URL:"http://127.0.0.1:8000"})')
const Module = require('module'); const m = new Module('api'); m.paths = Module._nodeModulePaths(process.cwd()); m._compile(code, '/tmp/api.cjs')
const api = m.exports
const saved = await api.saveScore({ playerName: 'NODETEST', score: 63, gameMode: 'classic', snakeLength: 10, durationSeconds: 42 })
console.log('saveScore ->', saved)
if (!saved || saved.id == null) { console.log('FAIL: save did not return record'); process.exit(1) }
const high = await api.getHighestScore()
console.log('getHighestScore ->', high)
if (high.score < 63) { console.log('FAIL: highest too low'); process.exit(1) }
console.log('API INTEGRATION: PASS')
