/**
 * LCD-style renderer: draws the game onto a canvas with chunky "pixels"
 * on a green-grey LCD background. No gradients, no anti-aliasing — just
 * crisp dark blocks like a monochrome phone screen.
 */
import { COLS, ROWS } from './SnakeEngine.js'

const INK = '#1c2b16' // dark LCD ink
const BG = '#9dbb78' // Nokia LCD green-grey

// 5x5 bitmap font for the few characters we need (digits + A-Z subset).
const FONT = {
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11111','00010','00100','00010','00001','10001','01110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','11110','00001','00001','10001','01110'],
  '6': ['00110','01000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00010','01100'],
  'A': ['01110','10001','10001','11111','10001','10001','10001'],
  'B': ['11110','10001','10001','11110','10001','10001','11110'],
  'C': ['01110','10001','10000','10000','10000','10001','01110'],
  'D': ['11100','10010','10001','10001','10001','10010','11100'],
  'E': ['11111','10000','10000','11110','10000','10000','11111'],
  'F': ['11111','10000','10000','11110','10000','10000','10000'],
  'G': ['01110','10001','10000','10111','10001','10001','01111'],
  'H': ['10001','10001','10001','11111','10001','10001','10001'],
  'I': ['01110','00100','00100','00100','00100','00100','01110'],
  'J': ['00111','00010','00010','00010','00010','10010','01100'],
  'K': ['10001','10010','10100','11000','10100','10010','10001'],
  'L': ['10000','10000','10000','10000','10000','10000','11111'],
  'M': ['10001','11011','10101','10101','10001','10001','10001'],
  'N': ['10001','11001','10101','10011','10001','10001','10001'],
  'O': ['01110','10001','10001','10001','10001','10001','01110'],
  'P': ['11110','10001','10001','11110','10000','10000','10000'],
  'Q': ['01110','10001','10001','10001','10101','10010','01101'],
  'R': ['11110','10001','10001','11110','10100','10010','10001'],
  'S': ['01111','10000','10000','01110','00001','00001','11110'],
  'T': ['11111','00100','00100','00100','00100','00100','00100'],
  'U': ['10001','10001','10001','10001','10001','10001','01110'],
  'V': ['10001','10001','10001','10001','10001','01010','00100'],
  'W': ['10001','10001','10001','10101','10101','11011','10001'],
  'X': ['10001','10001','01010','00100','01010','10001','10001'],
  'Y': ['10001','10001','01010','00100','00100','00100','00100'],
  'Z': ['11111','00001','00010','00100','01000','10000','11111'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  '.': ['00000','00000','00000','00000','00000','01100','01100'],
  ',': ['00000','00000','00000','00000','01100','00100','01000'],
  ':': ['00000','01100','01100','00000','01100','01100','00000'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '!': ['00100','00100','00100','00100','00100','00000','00100'],
  '?': ['01110','10001','00001','00110','00100','00000','00100'],
  '/': ['00001','00010','00010','00100','01000','01000','10000'],
  "'": ['00100','00100','00000','00000','00000','00000','00000'],
}

export function drawText(ctx, text, px, py, cell, opts = {}) {
  // cell = size of one pixel-dot; each glyph is 5 wide x 7 tall dots
  const s = String(text).toUpperCase()
  const gap = cell
  let cursorX = px
  ctx.fillStyle = opts.color || INK
  for (const ch of s) {
    const g = FONT[ch] || FONT['?']
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === '1') {
          ctx.fillRect(cursorX + col * cell, py + row * cell, cell, cell)
        }
      }
    }
    cursorX += 6 * cell + (opts.tracking ? opts.tracking : 0)
  }
  return cursorX - px
}

export function textWidth(text, cell) {
  return String(text).length * 6 * cell - cell
}

/**
 * Draw one full frame.
 * snapshot: { snake, food, score, state, cols, rows }
 */
export function drawFrame(canvas, snapshot, highScore) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  const topBarPx = Math.round(H * 0.14)
  const fieldH = H - topBarPx

  const cellW = Math.floor(W / COLS)
  const cellH = Math.floor(fieldH / ROWS)
  const cell = Math.max(2, Math.min(cellW, cellH))
  const offX = Math.floor((W - cell * COLS) / 2)
  const offY = topBarPx + Math.floor((fieldH - cell * ROWS) / 2)

  // --- LCD background
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // --- top status bar: score left, high score right
  const dot = Math.max(1, Math.floor(topBarPx / 9))
  drawText(ctx, `SCORE ${snapshot.score}`, dot * 2, dot * 2, dot)
  const hsLabel = `HIGH ${highScore ?? 0}`
  drawText(ctx, hsLabel, W - textWidth(hsLabel, dot) - dot * 2, dot * 2, dot)

  // separator line under the bar
  ctx.fillRect(0, topBarPx - dot, W, dot)

  // --- playfield border (double line, classic look)
  ctx.strokeStyle = INK
  ctx.lineWidth = Math.max(2, dot)
  ctx.strokeRect(offX - dot, offY - dot, cell * COLS + 2 * dot, cell * ROWS + 2 * dot)

  // faint LCD grid dots (very subtle, like inactive pixels)
  ctx.fillStyle = 'rgba(28,43,22,0.08)'
  for (let y = 0; y <= ROWS; y++) {
    for (let x = 0; x <= COLS; x++) {
      ctx.fillRect(offX + x * cell - 1, offY + y * cell - 1, 2, 2)
    }
  }

  ctx.fillStyle = INK

  // --- food: little "fruit" blob (donut shape like Xenzia's rabbit/fruit)
  if (snapshot.food && snapshot.state !== 'dead') {
    const fx = offX + snapshot.food.x * cell
    const fy = offY + snapshot.food.y * cell
    const p = cell // one pixel block unit
    // 4x4 ring with center hole + stem
    ctx.fillRect(fx + p, fy, p, p)
    ctx.fillRect(fx, fy + p, p, p)
    ctx.fillRect(fx + 3 * p, fy + p, p, p)
    ctx.fillRect(fx, fy + 2 * p, p, p)
    ctx.fillRect(fx + 3 * p, fy + 2 * p, p, p)
    ctx.fillRect(fx + p, fy + 3 * p, p, p)
    ctx.fillRect(fx + 2 * p, fy + 3 * p, p, p)
    ctx.fillRect(fx + 2 * p, fy - p > offY ? fy - p : fy, p, p > 2 ? 2 : p)
  }

  // --- snake: chunky segments with a small gap between them
  const inset = Math.max(1, Math.floor(cell * 0.12))
  snapshot.snake.forEach((seg, i) => {
    const sx = offX + seg.x * cell
    const sy = offY + seg.y * cell
    if (i === 0) {
      // head: solid block slightly bigger, with "eye" notch
      ctx.fillRect(sx, sy, cell, cell)
      ctx.fillStyle = BG
      ctx.fillRect(sx + cell * 0.6, sy + cell * 0.2, Math.max(1, cell * 0.2), Math.max(1, cell * 0.2))
      ctx.fillStyle = INK
    } else {
      ctx.fillRect(sx + inset, sy + inset, cell - 2 * inset, cell - 2 * inset)
    }
  })

  // --- overlays
  const msgCell = Math.max(2, Math.floor(W / 60))
  if (snapshot.state === 'paused') {
    overlayBox(ctx, W, H, 'PAUSED', msgCell, dot)
  } else if (snapshot.state === 'idle') {
    overlayBox(ctx, W, H, 'SNAKE', msgCell, dot, 'PRESS SELECT')
  } else if (snapshot.state === 'dead') {
    overlayBox(ctx, W, H, 'GAME OVER', msgCell, dot, `SCORE ${snapshot.score}`)
  }
}

function overlayBox(ctx, W, H, title, c, pad, sub) {
  const tw = textWidth(title, c)
  const sw = sub ? textWidth(sub, Math.floor(c * 0.8)) : 0
  const bw = Math.max(tw, sw) + 4 * c
  const bh = (sub ? 14 + 9 : 14) * c * 0.9
  const bx = Math.floor((W - bw) / 2)
  const by = Math.floor((H - bh) / 2)
  // filled box with light interior
  ctx.fillStyle = INK
  ctx.fillRect(bx, by, bw, bh)
  ctx.fillStyle = BG
  ctx.fillRect(bx + pad, by + pad, bw - 2 * pad, bh - 2 * pad)
  ctx.fillStyle = INK
  drawText(ctx, title, bx + Math.floor((bw - tw) / 2), by + 2 * c, c)
  if (sub) {
    const cs = Math.floor(c * 0.8)
    drawText(ctx, sub, bx + Math.floor((bw - sw) / 2), by + 10 * c, cs)
  }
}
