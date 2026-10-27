import { useEffect, useState } from 'react'
import { getLeaderboard, getGameHistory, readPlayerName, writePlayerName } from '../services/api.js'

/**
 * Sub-screens rendered inside the LCD: High Scores, Game History,
 * Instructions, and Name entry. All styled like old phone firmware.
 */

export function HighScoresScreen({ onBack }) {
  const [state, setState] = useState({ loading: true, data: null, offline: false })

  useEffect(() => {
    let alive = true
    getLeaderboard(10).then((data) => {
      if (!alive) return
      setState({ loading: false, data, offline: data === null })
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="menu-screen">
      <div className="menu-titlebar">HIGH SCORES</div>
      <div className="screen-body scrollable">
        {state.loading && <p className="lcd-text">LOADING...</p>}
        {state.offline && (
          <p className="lcd-text">
            NO CONNECTION TO SCORE SERVER. START THE BACKEND TO SEE THE LEADERBOARD.
          </p>
        )}
        {state.data && state.data.scores.length === 0 && !state.loading && (
          <p className="lcd-text">NO SCORES YET. PLAY A GAME!</p>
        )}
        {state.data && state.data.scores.length > 0 && (
          <table className="score-table">
            <thead>
              <tr>
                <th>#</th>
                <th>NAME</th>
                <th>SCORE</th>
                <th>MODE</th>
              </tr>
            </thead>
            <tbody>
              {state.data.scores.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{s.player_name}</td>
                  <td>{s.score}</td>
                  <td>{s.game_mode === 'classic' ? 'CLS' : 'RLX'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="menu-softkeys">
        <span>&nbsp;</span>
        <button type="button" className="softkey-link" onClick={onBack}>BACK</button>
      </div>
    </div>
  )
}

export function HistoryScreen({ onBack }) {
  const [state, setState] = useState({ loading: true, data: null, offline: false })

  useEffect(() => {
    let alive = true
    getGameHistory(15).then((data) => {
      if (!alive) return
      setState({ loading: false, data, offline: data === null })
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="menu-screen">
      <div className="menu-titlebar">GAME HISTORY</div>
      <div className="screen-body scrollable">
        {state.loading && <p className="lcd-text">LOADING...</p>}
        {state.offline && <p className="lcd-text">SERVER UNREACHABLE.</p>}
        {state.data && state.data.games.length === 0 && !state.loading && (
          <p className="lcd-text">NO COMPLETED GAMES RECORDED.</p>
        )}
        {state.data && state.data.games.length > 0 && (
          <>
            <p className="lcd-text small">TOTAL GAMES: {state.data.total_games}</p>
            <table className="score-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>NAME</th>
                  <th>SCORE</th>
                </tr>
              </thead>
              <tbody>
                {state.data.games.map((g) => (
                  <tr key={g.id}>
                    <td>{g.created_at.slice(5, 16).replace('T', ' ')}</td>
                    <td>{g.player_name}</td>
                    <td>{g.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      <div className="menu-softkeys">
        <span>&nbsp;</span>
        <button type="button" className="softkey-link" onClick={onBack}>BACK</button>
      </div>
    </div>
  )
}

const INSTRUCTIONS = [
  'STEER THE SNAKE WITH THE D-PAD OR ARROW KEYS.',
  'EAT THE FRUIT TO GROW AND SCORE 9 POINTS.',
  'EVERY 3 FRUITS THE SNAKE GETS FASTER.',
  'CLASSIC MODE: HITTING A WALL OR YOURSELF ENDS THE GAME.',
  'RELAXED MODE: THE SNAKE WRAPS AROUND THE WALLS.',
  'SELECT / ENTER: START, PAUSE OR RESUME.',
  'R: RESTART. C / ESC: BACK TO MENU.',
  'SWIPE ON THE SCREEN ALSO STEERS THE SNAKE.',
]

export function InstructionsScreen({ onBack }) {
  return (
    <div className="menu-screen">
      <div className="menu-titlebar">INSTRUCTIONS</div>
      <div className="screen-body scrollable">
        <ol className="instruction-list">
          {INSTRUCTIONS.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </div>
      <div className="menu-softkeys">
        <span>&nbsp;</span>
        <button type="button" className="softkey-link" onClick={onBack}>BACK</button>
      </div>
    </div>
  )
}

export function NameScreen({ onDone }) {
  const [name, setName] = useState(readPlayerName())

  const submit = (e) => {
    e?.preventDefault()
    const clean = name.trim().toUpperCase().slice(0, 20) || 'PLAYER 1'
    writePlayerName(clean)
    onDone(clean)
  }

  return (
    <div className="menu-screen">
      <div className="menu-titlebar">YOUR NAME</div>
      <div className="screen-body center-col">
        <p className="lcd-text">ENTER NICKNAME:</p>
        <form onSubmit={submit} className="name-form">
          <input
            className="name-input"
            value={name}
            maxLength={20}
            autoFocus
            onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9 _.-]/g, ''))}
            aria-label="Player name"
          />
          <button type="submit" className="retro-btn">OK</button>
        </form>
      </div>
      <div className="menu-softkeys">
        <button type="button" className="softkey-link" onClick={() => onDone(name.trim().toUpperCase() || 'PLAYER 1')}>DONE</button>
        <span>&nbsp;</span>
      </div>
    </div>
  )
}

export function SaveScorePrompt({ score, saving, saved, failed, onSave, onDiscard }) {
  return (
    <div className="menu-screen">
      <div className="menu-titlebar">GAME OVER</div>
      <div className="screen-body center-col">
        <p className="lcd-text big">SCORE: {score}</p>
        {saving && <p className="lcd-text">SAVING...</p>}
        {saved && <p className="lcd-text">SAVED TO HIGH SCORES!</p>}
        {failed && <p className="lcd-text">COULD NOT SAVE - SERVER OFFLINE.</p>}
        {!saving && !saved && (
          <div className="prompt-buttons">
            <button type="button" className="retro-btn" onClick={onSave}>SAVE</button>
            <button type="button" className="retro-btn" onClick={onDiscard}>SKIP</button>
          </div>
        )}
        {saved && (
          <div className="prompt-buttons">
            <button type="button" className="retro-btn" onClick={onDiscard}>MENU</button>
          </div>
        )}
        {failed && (
          <div className="prompt-buttons">
            <button type="button" className="retro-btn" onClick={onSave}>RETRY</button>
            <button type="button" className="retro-btn" onClick={onDiscard}>MENU</button>
          </div>
        )}
      </div>
    </div>
  )
}
