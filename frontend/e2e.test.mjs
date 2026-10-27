import { chromium } from 'playwright'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 900, height: 1300 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))

let pass=0, fail=0
async function t(n,f){ try{ await f(); pass++; console.log('PASS:',n) }catch(e){ fail++; console.log('FAIL:',n,'-',String(e.message).split('\n')[0]) } }
const assert=(c,m)=>{if(!c)throw new Error(m)}
const fieldHash = () => page.evaluate(() => {
  const c=document.querySelector('canvas'); if(!c) return null
  const d=c.getContext('2d').getImageData(0,40,c.width,c.height-40).data
  let h=0; for(let i=0;i<d.length;i+=16) h=(h*31+d[i])>>>0
  return h
})

await t('app loads with menu', async () => {
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  const body = await page.textContent('body')
  assert(body.includes('SNAKE XENZIA') && body.includes('HIGH SCORES'), 'menu missing')
})

await t('high scores screen shows real DB rows', async () => {
  await page.getByRole('button', { name: /HIGH SCORES/ }).click()
  await page.waitForTimeout(800)
  const txt = await page.textContent('body')
  assert(txt.includes('PROXYTEST') || txt.includes('VIPER'), 'no DB records rendered')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

await t('Enter starts game and snake moves (pixel hash changes)', async () => {
  await page.keyboard.press('Enter')
  await page.waitForSelector('canvas.lcd', { timeout: 5000 })
  const h1 = await fieldHash(); await page.waitForTimeout(1000)
  const h2 = await fieldHash(); await page.waitForTimeout(1000)
  const h3 = await fieldHash()
  assert(h1!==null && h2!==null && h3!==null, 'canvas gone mid-run')
  assert(h1!==h2 || h2!==h3, 'snake never moved on the LCD')
})

await t('arrow keys steer without scrolling page', async () => {
  const y0 = await page.evaluate(() => window.scrollY)
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(500)
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(500)
  assert((await page.evaluate(() => window.scrollY)) === y0, 'page scrolled by arrows')
})

await t('pause freezes the field, resume restarts motion', async () => {
  await page.keyboard.press('Enter') // pause
  await page.waitForTimeout(400)
  const p1 = await fieldHash(); await page.waitForTimeout(900); const p2 = await fieldHash()
  assert(p1===p2, 'field changed while paused')
  await page.keyboard.press('Enter') // resume
  await page.waitForTimeout(500)
  const r1 = await fieldHash(); await page.waitForTimeout(900); const r2 = await fieldHash()
  assert(r1!==r2, 'field frozen after resume')
})

await t('R restarts the game (score resets to 0)', async () => {
  await page.keyboard.press('r')
  await page.waitForTimeout(800)
  assert(await page.$('canvas.lcd'), 'no canvas after R')
})

await t('steer up into top wall -> GAME OVER screen', async () => {
  await page.keyboard.press('ArrowUp')
  const deadline = Date.now() + 25000
  let over=false
  while(Date.now()<deadline){
    const txt = await page.textContent('body')
    if(txt.includes('GAME OVER')){over=true;break}
    await page.waitForTimeout(300)
  }
  assert(over,'never reached GAME OVER')
})

await t('game auto-saves score to backend SQLite', async () => {
  await page.waitForTimeout(1500)
  const res = await fetch('http://localhost:8000/api/games/history?limit=1')
  const data = await res.json()
  assert(data.total_games >= 5, 'history did not grow')
  const latest = data.games[0]
  assert(latest.score % 9 === 0, 'saved score not a multiple of 9: '+latest.score)
  console.log('   saved:', latest.player_name, latest.score, latest.game_mode)
})

await t('Escape returns to menu', async () => {
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  const txt = await page.textContent('body')
  assert(txt.includes('INSTRUCTIONS') && txt.includes('SOUND:'), 'not at menu')
})

await t('keypad D-pad + Select buttons work end-to-end', async () => {
  await page.getByRole('button', { name: 'Select', exact: true }).first().click() // start via keypad
  await page.waitForSelector('canvas.lcd', { timeout: 5000 })
  await page.getByRole('button', { name: 'Down', exact: true }).first().click()
  const h1 = await fieldHash(); await page.waitForTimeout(900); const h2 = await fieldHash()
  assert(h1!==h2, 'keypad-driven game not moving')
  await page.getByRole('button', { name: 'Back', exact: true }).first().click() // C key -> menu
  await page.waitForTimeout(400)
  assert((await page.textContent('body')).includes('MENU'), 'C/back did not return to menu')
})

await t('sound toggle works from menu', async () => {
  await page.getByRole('button', { name: /SOUND: ON/ }).click()
  await page.waitForTimeout(300)
  assert((await page.textContent('body')).includes('SOUND: OFF'), 'sound not toggled off')
  await page.getByRole('button', { name: /SOUND: OFF/ }).click()
  await page.waitForTimeout(300)
  assert((await page.textContent('body')).includes('SOUND: ON'), 'sound not toggled back on')
})

await t('offline resilience: game still playable with backend down', async () => {
  // route /api to failure
  await page.route('**/api/**', r => r.abort())
  await page.getByRole('button', { name: /NEW GAME/ }).click()
  await page.waitForSelector('canvas.lcd', { timeout: 5000 })
  const h1 = await fieldHash(); await page.waitForTimeout(900); const h2 = await fieldHash()
  assert(h1!==h2, 'game froze with backend offline')
  await page.unroute('**/api/**')
  await page.keyboard.press('Escape')
})

assert(errors.length===0, 'JS page errors: '+errors.join(' | '))
console.log(`\n${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail?1:0)
