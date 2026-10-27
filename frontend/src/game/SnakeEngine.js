/**
 * SnakeEngine — pure-JS game logic for the classic Nokia Snake experience.
 *
 * Fixed-timestep loop driven by requestAnimationFrame with an accumulator,
 * so movement speed stays consistent even when the tab is backgrounded
 * (catch-up steps are capped to avoid a "teleport" burst on refocus).
 */

export const COLS = 26
export const ROWS = 17 // playable field (classic-ish aspect)

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const POINTS_PER_FOOD = 9 // like Xenzia: every fruit is worth 9 points

// Classic Xenzia pacing: starts moderate, gets faster as you grow.
export function tickIntervalFor(length, mode) {
  if (mode === 'relaxed') return 150 // gentle fixed pace
  const base = 180
  const fastest = 70
  const step = Math.max(0, length - 4)
  return Math.max(fastest, base - step * 6)
}

export class SnakeEngine {
  constructor({ mode = 'classic', onDraw, onEvent } = {}) {
    this.mode = mode
    this.onDraw = onDraw || (() => {})
    this.onEvent = onEvent || (() => {})
    this.reset()
  }

  reset() {
    this.stop() // cancel any in-flight RAF before wiping state
    const cy = Math.floor(ROWS / 2)
    this.snake = [
      { x: 6, y: cy },
      { x: 5, y: cy },
      { x: 4, y: cy },
    ] // head first
    this.dir = DIRS.right
    this.nextDirs = [] // buffered direction inputs (max 2 queued)
    this.score = 0
    this.food = null
    this.state = 'idle' // idle | running | paused | dead
    this._acc = 0
    this._lastTs = null
    this._raf = null
    this._runId = 0 // incremented on every start() to invalidate stale frames
    this._pendingGrow = 0
    this.startedAt = null
    this.spawnFood()
  }

  setMode(mode) {
    this.mode = mode
  }

  spawnFood() {
    const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`))
    const free = []
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y })
      }
    }
    if (free.length === 0) {
      this.win()
      return
    }
    this.food = free[Math.floor(Math.random() * free.length)]
  }

  /** Queue a direction. Ignored if it would reverse the snake into itself. */
  queueDir(name) {
    const d = DIRS[name]
    if (!d) return false
    const last = this.nextDirs.length
      ? this.nextDirs[this.nextDirs.length - 1]
      : this.dir
    // opposite of current effective direction -> invalid
    if (d.x + last.x === 0 && d.y + last.y === 0) return false
    // same direction -> no-op but still "valid" press
    if (d.x === last.x && d.y === last.y) return true
    if (this.nextDirs.length >= 2) return true // buffer full, swallow input
    this.nextDirs.push(d)
    return true
  }

  start() {
    if (this.state === 'dead') this.reset()
    this.state = 'running'
    this._runId += 1 // invalidate any stale RAF frame from a previous run
    this.startedAt = this.startedAt ?? Date.now()
    this._lastTs = null
    this._acc = 0
    this.onEvent('start')
    this.loop()
  }

  pause() {
    if (this.state !== 'running') return
    this.state = 'paused'
    this.onEvent('pause')
  }

  resume() {
    if (this.state !== 'paused') return
    this.state = 'running'
    this._lastTs = null // don't accumulate time while paused
    this._acc = 0
    this.onEvent('resume')
    this.loop()
  }

  togglePause() {
    if (this.state === 'running') this.pause()
    else if (this.state === 'paused') this.resume()
    else if (this.state === 'idle' || this.state === 'dead') this.start()
  }

  stop() {
    this.state = 'idle'
    this._runId += 1 // invalidate any in-flight frame
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
  }

  loop() {
    if (this._raf) return
    const runId = this._runId // tag frames with the current run
    const frame = (ts) => {
      this._raf = null
      if (this.state !== 'running') return
      if (runId !== this._runId) {
        // Stale frame from a previous run (e.g. stop()+start() raced an
        // already-scheduled RAF). Drop it and start a fresh loop instead of
        // silently killing the new run.
        this.loop()
        return
      }
      if (this._lastTs == null) this._lastTs = ts
      let delta = ts - this._lastTs
      this._lastTs = ts
      if (delta > 500) delta = 500 // tab was hidden: cap catch-up, stay smooth
      this._acc += delta
      let interval = tickIntervalFor(this.snake.length, this.mode)
      let guard = 0
      while (this._acc >= interval && guard < 10) {
        this._acc -= interval
        this.step()
        interval = tickIntervalFor(this.snake.length, this.mode)
        guard++
        if (this.state !== 'running') break
      }
      this.onDraw(this.snapshot())
      if (this.state === 'running') this._raf = requestAnimationFrame(frame)
    }
    this._raf = requestAnimationFrame(frame)
  }

  step() {
    // apply one buffered direction per tick
    if (this.nextDirs.length) {
      const d = this.nextDirs.shift()
      if (!(d.x + this.dir.x === 0 && d.y + this.dir.y === 0)) this.dir = d
    }

    let nx = this.snake[0].x + this.dir.x
    let ny = this.snake[0].y + this.dir.y

    if (this.mode === 'relaxed') {
      // wrap around walls
      nx = (nx + COLS) % COLS
      ny = (ny + ROWS) % ROWS
    } else if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      return this.die('wall')
    }

    const eating = this.food && nx === this.food.x && ny === this.food.y
    // tail cell vacates this tick unless we grow
    const bodyToCheck = eating ? this.snake : this.snake.slice(0, -1)
    if (bodyToCheck.some((s) => s.x === nx && s.y === ny)) {
      return this.die('self')
    }

    this.snake.unshift({ x: nx, y: ny })
    if (eating) {
      this.score += POINTS_PER_FOOD
      this.onEvent('eat', this.snapshot())
      this.spawnFood()
    } else {
      this.snake.pop()
    }
    this.onDraw(this.snapshot())
  }

  die(reason) {
    this.state = 'dead'
    if (this._raf) {
      cancelAnimationFrame(this._raf)
      this._raf = null
    }
    const snap = this.snapshot()
    this.onEvent('dead', { ...snap, reason })
  }

  win() {
    this.state = 'dead'
    this.onEvent('win', this.snapshot())
  }

  snapshot() {
    return {
      snake: this.snake,
      food: this.food,
      score: this.score,
      length: this.snake.length,
      state: this.state,
      mode: this.mode,
      cols: COLS,
      rows: ROWS,
      durationSeconds: this.startedAt
        ? Math.round((Date.now() - this.startedAt) / 1000)
        : 0,
    }
  }
}
