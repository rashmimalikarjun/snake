import { chromium } from 'playwright'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 900, height: 1200 } })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
const info = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  if (!c) return { present: false }
  const r = c.getBoundingClientRect()
  const cs = getComputedStyle(c)
  return { present: true, rect: {x:r.x,y:r.y,w:r.width,h:r.height}, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, parentRects: (()=>{let el=c,out=[];while(el&&out.length<5){const rr=el.getBoundingClientRect();out.push({cls:el.className.toString().slice(0,30),w:rr.width,h:rr.height});el=el.parentElement}return out})() }
})
console.log(JSON.stringify(info, null, 1))
// pixel check via toDataURL sampling
const px = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  if (!c) return null
  const ctx = c.getContext('2d')
  const d = ctx.getImageData(0,0,c.width,c.height).data
  let dark=0
  for(let i=0;i<d.length;i+=4) if(d[i]<80) dark++
  return { w:c.width, h:c.height, darkPixels:dark }
})
console.log('pixels:', JSON.stringify(px))
await page.waitForTimeout(1200)
const px2 = await page.evaluate(() => {
  const c = document.querySelector('canvas'); const ctx=c.getContext('2d')
  const d = ctx.getImageData(0,0,c.width,c.height).data
  let dark=0; const heads=[]
  // find bounding box of dark pixels in field area
  let minX=1e9,maxX=-1
  for(let y=40;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(d[i]<80){dark++;if(x<minX)minX=x;if(x>maxX)maxX=x}}
  return { dark, minX, maxX }
})
console.log('after 1.2s:', JSON.stringify(px2))
await b.close()
