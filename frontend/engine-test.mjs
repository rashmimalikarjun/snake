import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const esbuild = require('esbuild')

let rafQueue = []
globalThis.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length }
globalThis.cancelAnimationFrame = () => {}

const result = await esbuild.build({
  stdin: { contents: `export * from './src/game/SnakeEngine.js'`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', write: false,
})
const Module = require('module')
const m = new Module('eng'); m.paths = Module._nodeModulePaths(process.cwd())
m._compile(result.outputFiles[0].text, '/tmp/eng.cjs')
const { SnakeEngine, COLS, ROWS, DIRS } = m.exports

let pass = 0, fail = 0
const t = (name, fn) => { try { fn(); console.log('PASS:', name); pass++ } catch (e) { console.log('FAIL:', name, '-', e.message); fail++ } }
const eq = (a, b, msg='') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`) }

// helper: run N ticks synchronously by pumping RAF with fake timestamps
function pump(engine, ts) { const q = rafQueue; rafQueue = []; q.forEach((cb) => cb(ts)) }

t('snake moves right each tick', () => {
  const ev = []; const e = new SnakeEngine({ onEvent: (ty) => ev.push(ty) })
  e.start()
  const x0 = e.snake[0].x
  // advance enough real ms for one tick
  pump(e, 0); pump(e, 200)
  if (e.snake[0].x === x0) throw new Error('did not move')
})

t('eating food grows snake and adds 9 points', () => {
  const e = new SnakeEngine()
  e.start()
  // place food directly in front of head
  const h = e.snake[0]
  e.food = { x: h.x + 1, y: h.y }
  const len0 = e.snake.length, sc0 = e.score
  pump(e, 0); pump(e, 200)
  eq(e.score, sc0 + 9, 'score:')
  eq(e.snake.length, len0 + 1, 'length:')
})

t('food never spawns inside snake', () => {
  const e = new SnakeEngine()
  for (let i = 0; i < 50; i++) {
    e.spawnFood()
    const occ = new Set(e.snake.map(s => `${s.x},${s.y}`))
    if (occ.has(`${e.food.x},${e.food.y}`)) throw new Error('food inside snake')
  }
})

t('wall collision kills in classic mode', () => {
  const ev = []
  const e = new SnakeEngine({ onEvent: (ty) => ev.push(ty) })
  e.start()
  // drive right until wall
  let guard = 0
  while (e.state === 'running' && guard++ < 100) { pump(e, guard * 300) }
  eq(e.state, 'dead', 'state:')
  if (!ev.includes('dead')) throw new Error('no dead event')
})

t('relaxed mode wraps around walls', () => {
  const e = new SnakeEngine({ mode: 'relaxed' })
  e.start()
  let guard = 0
  while (guard++ < 100 && e.snake[0].x < COLS - 1) pump(e, guard * 300)
  pump(e, guard * 300 + 200)
  if (e.state === 'dead') throw new Error('died at wall in relaxed mode')
})

t('self collision kills', () => {
  const e = new SnakeEngine()
  e.reset(); e.start()
  // deterministic body: head at (6,cy) moving right, length 5
  const cy = Math.floor(ROWS / 2)
  e.snake = [{x:6,y:cy},{x:5,y:cy},{x:4,y:cy},{x:3,y:cy},{x:2,y:cy}]
  e.dir = DIRS.right; e.nextDirs = []
  e.food = { x: 0, y: 0 } // far away so no interference
  // U-turn over three ticks lands the head back on its own trail
  e.queueDir('down'); pump(e, 1000)
  e.queueDir('left'); pump(e, 1300)
  e.queueDir('up');   pump(e, 1600)
  eq(e.state, 'dead', 'state:')
})

t('direct head-into-body hit is detected (tail vacates correctly)', () => {
  const e = new SnakeEngine()
  e.reset(); e.start()
  const cy = Math.floor(ROWS / 2)
  // head (4,cy) moves down onto (4,cy+1) which is a MIDDLE segment (index 2 of 5),
  // so it cannot vacate this tick -> must die
  e.snake = [{x:4,y:cy},{x:5,y:cy},{x:6,y:cy},{x:4,y:cy+1},{x:3,y:cy+1}]
  e.dir = DIRS.down; e.nextDirs = []
  e.food = { x: 20, y: 2 }
  e.step() // one manual tick: head must crash into body, not tail-vacate cell
  eq(e.state, 'dead', 'state:')

  // and the moving-tail case stays SAFE: same shape but target IS the tail
  const f = new SnakeEngine()
  f.reset(); f.start()
  f.snake = [{x:4,y:cy},{x:5,y:cy},{x:6,y:cy},{x:6,y:cy+1},{x:5,y:cy+1},{x:4,y:cy+1}]
  f.dir = DIRS.down; f.nextDirs = []
  f.food = { x: 20, y: 2 }
  f.step() // tail (4,cy+1) vacates this tick -> legal chase move, classic Snake rule
  eq(f.state, 'running', 'state:')
})

t('reverse direction is rejected', () => {
  const e = new SnakeEngine()
  e.start()
  eq(e.dir, DIRS.right)
  if (e.queueDir('left') !== false) throw new Error('left accepted while moving right')
  eq(e.queueDir('up'), true)
})

t('two quick turns within one tick do not cause self-reverse death', () => {
  const e = new SnakeEngine()
  e.start()
  e.queueDir('up'); e.queueDir('left') // buffered both
  pump(e, 0); pump(e, 200)  // applies up
  pump(e, 400)              // applies left — snake must still be alive
  eq(e.state, 'running', 'state:')
})

t('pause/resume works and does not jump on resume', () => {
  const e = new SnakeEngine()
  e.start()
  pump(e, 0); pump(e, 200)
  const pos = { ...e.snake[0] }
  e.pause()
  pump(e, 5000) // huge gap while paused — but frame returns early since state!=running
  eq(e.snake[0], pos, 'moved during pause:')
  e.resume()
  pump(e, 6000) // first frame after resume sets _lastTs baseline (no catch-up burst)
  eq(e.snake[0], pos, 'teleported on resume:')
  pump(e, 6200)
  if (e.snake[0].x === pos.x) throw new Error('did not move after resume')
})

t('restart resets score, length, state', () => {
  const e = new SnakeEngine()
  e.start()
  const h = e.snake[0]; e.food = { x: h.x + 1, y: h.y }
  pump(e, 0); pump(e, 200)
  e.reset(); e.start()
  eq(e.score, 0); eq(e.snake.length, 3); eq(e.state, 'running')
})

t('stop cancels stale RAF without killing next run', () => {
  const e = new SnakeEngine()
  e.start(); pump(e, 0)          // schedules frame A
  e.stop(); e.start()            // B scheduled; A still queued
  pump(e, 300)                   // A runs (stale) -> should re-loop, not freeze
  pump(e, 600)
  eq(e.state, 'running', 'state:')
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
