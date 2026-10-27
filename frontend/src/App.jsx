import { useCallback, useEffect, useRef, useState } from 'react'
import GameScreen from './components/GameScreen.jsx'
import Keypad from './components/Keypad.jsx'
import Menu from './components/Menu.jsx'
import {
  HighScoresScreen,
  HistoryScreen,
  InstructionsScreen,
  NameScreen,
  SaveScorePrompt,
} from './components/Screens.jsx'
import { SnakeEngine } from './game/SnakeEngine.js'
import {
  unlockAudio,
  setSoundEnabled,
  playStart,
  playEat,
  playGameOver,
  playMenuSelect,
  playMenuMove,
  playBack,
  playPause,
} from './game/sound.js'
import {
  saveScore,
  getHighestScore,
  checkHealth,
  readLocalHigh,
  writeLocalHigh,
  readPlayerName,
  readSoundPref,
  writeSoundPref,
} from './services/api.js'

// Screens: menu | game | highscores | history | instructions | name | gameover
const MENU_ITEMS = [
  { id: 'snake', label: 'SNAKE XENZIA' },
  { id: 'newgame', label: 'NEW GAME' },
  { id: 'mode', label: '' }, // filled dynamically
  { id: 'highscores', label: 'HIGH SCORES' },
  { id: 'history', label: 'GAME HISTORY' },
  { id: 'instructions', label: 'INSTRUCTIONS' },
  { id: 'name', label: '' }, // filled dynamically
  { id: 'sound', label: '' }, // filled dynamically
]

export default function App() {
  const [screen, setScreen] = useState('menu')
  const [menuIndex, setMenuIndex] = useState(0)
  const [mode, setMode] = useState('classic')
  const [soundOn, setSoundOn] = useState(() => readSoundPref())
  const [playerName, setPlayerName] = useState(() => readPlayerName())
  const [highScore, setHighScore] = useState(() => readLocalHigh())
  const [backendOnline, setBackendOnline] = useState(null) // null = unknown
  const [lastGame, setLastGame] = useState(null)
  const [saveState, setSaveState] = useState({ saving: false, saved: false, failed: false })

  // refs mirror the latest state so callbacks defined EARLY (e.g. onSelectKey,
  // which is referenced by keyboard effects before activateMenuItem exists in
  // source order) can call them at event time without ever touching an
  // uninitialised const binding (temporal-dead-zone ReferenceError fix).
  const engineRef = useRef(null)
  const screenRef = useRef(screen)
  screenRef.current = screen
  const menuIndexRef = useRef(menuIndex)
  menuIndexRef.current = menuIndex
  const modeRef = useRef(mode)
  modeRef.current = mode
  const startGameRef = useRef(null)
  const activateMenuItemRef = useRef(null)

  // keep sound module in sync
  useEffect(() => {
    setSoundEnabled(soundOn)
    writeSoundPref(soundOn)
  }, [soundOn])

  // ---- engine events -----------------------------------------------------
  const handleEvent = useCallback((type, snap) => {
    if (type === 'eat') playEat()
    else if (type === 'start') playStart()
    else if (type === 'pause' || type === 'resume') playPause()
    else if (type === 'dead' || type === 'win') {
      playGameOver()
      const finalSnap = snap || engineRef.current?.snapshot()
      if (finalSnap) {
        setLastGame(finalSnap)
        writeLocalHigh(finalSnap.score)
        setHighScore((h) => Math.max(h, finalSnap.score))
        setSaveState({ saving: false, saved: false, failed: false })
        setScreen('gameover')
      }
    }
  }, [])

  // create engine once
  if (!engineRef.current) {
    engineRef.current = new SnakeEngine({
      mode: 'classic',
      onEvent: handleEvent,
    })
  }

  // ---- backend: fetch highest score + health ------------------------------
  const refreshFromBackend = useCallback(async () => {
    const highest = await getHighestScore()
    if (highest) {
      setHighScore((h) => Math.max(h, highest.score))
      writeLocalHigh(highest.score)
      setBackendOnline(true)
    } else {
      // could be "no scores yet" (404 handled inside) or the server is offline
      const ok = await checkHealth()
      setBackendOnline(Boolean(ok))
    }
  }, [])

  useEffect(() => {
    refreshFromBackend()
  }, [refreshFromBackend])

  // ---- navigation helpers -------------------------------------------------
  const goMenu = useCallback(() => {
    engineRef.current?.stop()
    playBack()
    setScreen('menu')
  }, [])

  // Defined BEFORE activateMenuItem (which it used to sit after) and routed
  // through refs, so no const declared later in the component body is ever
  // referenced from a hook that runs during an earlier render pass.
  const onSelectKey = useCallback(() => {
    unlockAudio()
    const s = screenRef.current
    if (s === 'game') {
      engineRef.current.togglePause()
    } else if (s === 'menu') {
      activateMenuItemRef.current?.(menuIndexRef.current)
    } else if (s === 'gameover') {
      goMenu()
    } else if (s === 'highscores' || s === 'history' || s === 'instructions') {
      goMenu()
    } else if (s === 'name') {
      // handled by its own OK button; Enter submits form anyway
    }
  }, [goMenu])

  const startGame = useCallback(
    (fresh) => {
      const engine = engineRef.current
      unlockAudio()
      if (fresh) {
        engine.stop()
        engine.reset()
        engine.setMode(modeRef.current)
      }
      setScreen('game')
      engine.start()
    },
    []
  )
  startGameRef.current = startGame

  const activateMenuItem = useCallback(
    (i) => {
      const item = MENU_ITEMS[i]
      playMenuSelect()
      switch (item.id) {
        case 'snake':
          startGameRef.current?.(false)
          break
        case 'newgame':
          startGameRef.current?.(true)
          break
        case 'mode':
          setMode((m) => {
            const next = m === 'classic' ? 'relaxed' : 'classic'
            engineRef.current.setMode(next)
            return next
          })
          break
        case 'highscores':
          setScreen('highscores')
          break
        case 'history':
          setScreen('history')
          break
        case 'instructions':
          setScreen('instructions')
          break
        case 'name':
          setScreen('name')
          break
        case 'sound':
          setSoundOn((v) => !v)
          break
        default:
          break
      }
    },
    []
  )
  activateMenuItemRef.current = activateMenuItem

  const handleDir = useCallback(
    (d) => {
      unlockAudio()
      const s = screenRef.current
      if (s === 'game') {
        engineRef.current.queueDir(d)
      } else if (s === 'menu') {
        setMenuIndex((i) => {
          let n = i
          if (d === 'down') n = (i + 1) % MENU_ITEMS.length
          if (d === 'up') n = (i - 1 + MENU_ITEMS.length) % MENU_ITEMS.length
          if (n !== i) playMenuMove()
          return n
        })
        if (d === 'left' || d === 'right') {
          // left/right also toggles the current setting items
          const cur = MENU_ITEMS[menuIndexRef.current]
          if (cur.id === 'mode' || cur.id === 'sound') {
            activateMenuItemRef.current?.(menuIndexRef.current)
          }
        }
      } else if (s === 'gameover') {
        goMenu()
      }
    },
    [goMenu]
  )

  // ---- keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e) => {
      const k = e.key
      const isGameKey =
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(k) &&
        screenRef.current === 'game'

      // prevent page scroll with arrows/space during gameplay
      if (isGameKey || k.startsWith('Arrow')) {
        if (screenRef.current === 'game' || screenRef.current === 'menu') e.preventDefault()
      }

      if (document.activeElement && document.activeElement.tagName === 'INPUT') return

      switch (k) {
        case 'ArrowUp': handleDir('up'); break
        case 'ArrowDown': handleDir('down'); break
        case 'ArrowLeft': handleDir('left'); break
        case 'ArrowRight': handleDir('right'); break
        case 'Enter':
        case ' ':
          onSelectKey(); break
        case 'r':
        case 'R':
          if (screenRef.current === 'game' || screenRef.current === 'gameover') startGame(true)
          break
        case 'Escape':
          if (screenRef.current !== 'menu') goMenu()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleDir, onSelectKey, startGame, goMenu])

  // auto-pause when tab hidden (authentic + prevents unfair deaths)
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && engineRef.current?.state === 'running') {
        engineRef.current.pause()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // ---- touch swipe on the LCD ----------------------------------------------
  const touchStart = useRef(null)
  const onTouchStart = (e) => {
    unlockAudio()
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return // tap, not swipe
    if (screenRef.current !== 'game') return
    if (Math.abs(dx) > Math.abs(dy)) handleDir(dx > 0 ? 'right' : 'left')
    else handleDir(dy > 0 ? 'down' : 'up')
  }

  // ---- save score to backend ------------------------------------------------
  const doSave = useCallback(async (game) => {
    const snap = game || lastGame
    if (!snap) return
    setSaveState({ saving: true, saved: false, failed: false })
    const res = await saveScore({
      playerName,
      score: snap.score,
      gameMode: snap.mode,
      snakeLength: snap.length,
      durationSeconds: snap.durationSeconds,
    })
    if (res) {
      setSaveState({ saving: false, saved: true, failed: false })
      setBackendOnline(true)
      writeLocalHigh(snap.score)
      setHighScore((h) => Math.max(h, snap.score))
    } else {
      setSaveState({ saving: false, saved: false, failed: true })
      setBackendOnline(false)
    }
  }, [lastGame, playerName])

  // auto-save when a game ends; SKIP just returns to menu
  useEffect(() => {
    if (screen === 'gameover' && lastGame) doSave(lastGame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  // dynamic labels for settings rows
  const items = MENU_ITEMS.map((it) => {
    if (it.id === 'mode') return { ...it, label: `MODE: ${mode === 'classic' ? 'CLASSIC NOKIA' : 'RELAXED'}` }
    if (it.id === 'sound') return { ...it, label: `SOUND: ${soundOn ? 'ON' : 'OFF'}` }
    if (it.id === 'name') return { ...it, label: `NAME: ${playerName}` }
    return it
  })

  const engineState = engineRef.current.state
  const softLabelForGame =
    engineState === 'running' ? 'PAUSE' : engineState === 'paused' ? 'RESUME' : 'START'

  return (
    <div className="room">
      <div className="phone" role="application" aria-label="Nokia-style phone running Snake Xenzia">
        <div className="phone-earpiece" aria-hidden="true">
          <span className="speaker-holes" />
        </div>
        <div className="brand-label">NOKIA-STYLE</div>

        <div
          className="screen-area"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {screen === 'game' && <GameScreen engineRef={engineRef} highScore={highScore} />}

          {screen === 'menu' && (
            <Menu
              items={items}
              selected={menuIndex}
              onSelect={(i) => {
                setMenuIndex(i)
                activateMenuItem(i)
              }}
              softLeft={{ title: 'MENU', label: 'SELECT' }}
              softRight={{ label: 'BACK' }}
            />
          )}

          {screen === 'highscores' && <HighScoresScreen onBack={goMenu} />}
          {screen === 'history' && <HistoryScreen onBack={goMenu} />}
          {screen === 'instructions' && <InstructionsScreen onBack={goMenu} />}

          {screen === 'name' && (
            <NameScreen
              onDone={(n) => {
                setPlayerName(n)
                playMenuSelect()
                goMenu()
              }}
            />
          )}

          {screen === 'gameover' && (
            <SaveScorePrompt
              score={lastGame?.score ?? 0}
              {...saveState}
              onSave={doSave}
              onDiscard={() => {
                if (saveState.saved || saveState.saving) goMenu()
                else goMenu()
              }}
            />
          )}

          {/* status strip under every screen like signal/battery icons */}
          <div className="status-strip" aria-hidden="true">
            <span className={`net-dot ${backendOnline ? 'net-ok' : backendOnline === false ? 'net-off' : ''}`} title="Backend connection" />
            <span className="model-text">XENZIA</span>
            <span className="battery">&#9646;&#9646;&#9646;</span>
          </div>
        </div>

        <div className="softkey-row">
          <button type="button" className="soft-key" onClick={onSelectKey}>{softLabelForGame}</button>
          <button type="button" className="soft-key" onClick={goMenu}>BACK</button>
        </div>

        <Keypad
          onDir={handleDir}
          onSelect={onSelectKey}
          onBack={goMenu}
          onMenu={goMenu}
        />

        <div className="mic-hole" aria-hidden="true" />
      </div>

      <p className="hint-text">
        ARROWS MOVE &middot; ENTER/SPACE START-PAUSE &middot; R RESTART &middot; ESC MENU &middot; SWIPE ON SCREEN
      </p>
    </div>
  )
}
