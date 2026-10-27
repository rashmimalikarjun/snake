/**
 * API client for the FastAPI backend. Every call degrades gracefully:
 * if the backend is down, functions return null/false instead of throwing,
 * so the game keeps working offline (localStorage fallback for high score).
 */

const BASE = import.meta.env.VITE_API_URL || ''  // '' -> same origin, proxied by Vite to :8000

async function request(path, options = {}, timeoutMs = 4000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    })
    if (!res.ok) {
      // 404 on /highest just means "no scores yet" — not an error state
      if (res.status === 404) return null
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.json()
  } catch {
    return null // network/timeout/backend down
  } finally {
    clearTimeout(timer)
  }
}

export function checkHealth() {
  return request('/api/health')
}

export function saveScore({ playerName, score, gameMode, snakeLength, durationSeconds }) {
  return request('/api/scores', {
    method: 'POST',
    body: JSON.stringify({
      player_name: playerName,
      score,
      game_mode: gameMode,
      snake_length: snakeLength,
      duration_seconds: durationSeconds,
    }),
  })
}

export function getLeaderboard(limit = 10) {
  return request(`/api/scores?limit=${encodeURIComponent(limit)}`)
}

export function getHighestScore() {
  return request('/api/scores/highest')
}

export function getGameHistory(limit = 20) {
  return request(`/api/games/history?limit=${encodeURIComponent(limit)}`)
}

// ---- localStorage fallback so the phone still remembers its high score ----

const LS_HIGH = 'xenzia_high_score'
const LS_NAME = 'xenzia_player_name'
const LS_SOUND = 'xenzia_sound_on'

export function readLocalHigh() {
  const v = parseInt(localStorage.getItem(LS_HIGH) || '0', 10)
  return Number.isFinite(v) ? v : 0
}

export function writeLocalHigh(score) {
  const cur = readLocalHigh()
  if (score > cur) localStorage.setItem(LS_HIGH, String(score))
}

export function readPlayerName() {
  return localStorage.getItem(LS_NAME) || 'PLAYER 1'
}

export function writePlayerName(name) {
  localStorage.setItem(LS_NAME, name.slice(0, 20))
}

export function readSoundPref() {
  const v = localStorage.getItem(LS_SOUND)
  return v === null ? true : v === '1'
}

export function writeSoundPref(on) {
  localStorage.setItem(LS_SOUND, on ? '1' : '0')
}
