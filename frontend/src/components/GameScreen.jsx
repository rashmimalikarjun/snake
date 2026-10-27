import { useEffect, useRef } from 'react'
import { COLS, ROWS } from '../game/SnakeEngine.js'
import { drawFrame } from '../game/lcdRenderer.js'

/**
 * The LCD screen. Canvas is rendered at a fixed internal resolution and
 * scaled with CSS — image-rendering: pixelated keeps the blocks crisp.
 */
export default function GameScreen({ engineRef, highScore }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const highRef = useRef(highScore)
  highRef.current = highScore

  useEffect(() => {
    const canvas = canvasRef.current
    // native-ish LCD resolution: scale grid up so pixels stay chunky
    const scale = 12
    canvas.width = COLS * scale + 8
    canvas.height = (ROWS + 3) * scale

    let alive = true
    const paint = () => {
      if (!alive) return
      const engine = engineRef.current
      if (engine) drawFrame(canvas, engine.snapshot(), highRef.current)
      rafRef.current = requestAnimationFrame(paint)
    }
    paint()
    return () => {
      alive = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [engineRef])

  return (
    <div className="lcd-bezel">
      <canvas ref={canvasRef} className="lcd" aria-label="Snake game screen" />
      <div className="lcd-glare" aria-hidden="true" />
    </div>
  )
}
