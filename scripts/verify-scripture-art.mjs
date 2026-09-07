import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
const base=process.env.HELIVES_PREVIEW_URL||'http://127.0.0.1:8787'
const out='demo/visual-expansion';await mkdir(out,{recursive:true})
const art=JSON.parse(await readFile('src/art/catalog.json','utf8'))
const browser=await chromium.launch();const errors=[],checks=[]
try{
 const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:`${out}/motion`,size:{width:1280,height:800}}})
 const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)))
 let audioRequests=0;p.on('request',r=>{if(r.url().includes('/audio/'))audioRequests++})
 await p.goto(base+'/scriptures');await p.getByRole('heading',{name:'The Scriptures',exact:true}).waitFor()
 assert.equal(await p.getByRole('button',{name:/View artwork for/}).count(),66)
 const opener=p.getByRole('button',{name:'View artwork for John',exact:true});await opener.focus();await p.keyboard.press('Enter')
 const stage=p.locator('.art-viewer .art-scene.is-ready');await stage.waitFor();await p.waitForTimeout(2500)
 const transform=()=>stage.locator('img').evaluate(e=>getComputedStyle(e).transform)
 const before=await transform();await p.waitForTimeout(2200);assert.notEqual(await transform(),before)
 await p.getByRole('button',{name:'Pause motion',exact:true}).click();await p.waitForTimeout(100)
 const frozen=await transform();await p.waitForTimeout(500);assert.equal(await transform(),frozen)
 await p.keyboard.press('Escape');await p.waitForTimeout(100);assert(await opener.evaluate(e=>document.activeElement===e))
 await opener.click();await p.getByRole('button',{name:'Close artwork',exact:true}).click();await p.waitForTimeout(100);assert(await opener.evaluate(e=>document.activeElement===e))
 checks.push('66 artwork entry points; actual camera movement; pause freezes motion; Escape and Close restore opener focus')
 for(const a of art){const response=await p.request.get(base+'/art/scripture/'+a.file);assert.equal(response.status(),200);assert((await response.text()).includes('<svg'))}
 await opener.click();await p.getByLabel('Choose a book artwork').selectOption('daniel');await stage.waitFor();await p.waitForTimeout(2400);await p.screenshot({path:`${out}/daniel-final.png`})
 await p.getByLabel('Choose a book artwork').selectOption('zechariah');await stage.waitFor();await p.waitForTimeout(2400);await p.screenshot({path:`${out}/zechariah-final.png`})
 await p.getByLabel('Choose a book artwork').selectOption('exodus');await stage.waitFor();await p.waitForTimeout(2400);await p.screenshot({path:`${out}/exodus-final.png`})
 await p.keyboard.press('ArrowRight');assert.equal(await p.getByLabel('Choose a book artwork').inputValue(),'leviticus');await p.keyboard.press('Escape')
 await p.goto(base);await p.locator('.art-scene.is-ready').waitFor();await p.waitForTimeout(2600)
 assert.equal(await p.locator('.word-sign svg').count(),0)
 await p.getByRole('button',{name:'Next Scripture',exact:true}).click();await p.waitForTimeout(3000);assert.equal(await p.locator('.art-scene').count(),1)
 await p.getByRole('button',{name:'Pause Scripture rotation',exact:true}).click();assert.equal(await p.locator('.art-scene').getAttribute('data-still'),'true')
 assert.equal(audioRequests,0);await p.getByRole('button',{name:'Music off',exact:true}).waitFor();await p.screenshot({path:`${out}/home-final.png`})
 checks.push('All 66 SVGs served; keyboard navigation; backdrop cleans old layer; Scripture pause stops camera; no audio requests or playback before opt-in')
 for(const [name,width,height,url] of [['phone',375,800,'/'],['phone-canon',375,800,'/scriptures'],['tv',1920,1080,'/?display=1']]){
  await p.setViewportSize({width,height});await p.goto(base+url);await p.waitForTimeout(3000)
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  if(url==='/scriptures'){await p.getByRole('button',{name:'View artwork for Genesis',exact:true}).click();await p.waitForTimeout(2500);const bounds=await p.locator('.art-viewer-controls').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width);await p.screenshot({path:`${out}/phone-viewer-final.png`})}
  else await p.screenshot({path:`${out}/${name}-final.png`})
 }
 await context.close()
 const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(base);await reduced.locator('.art-scene.is-ready').waitFor();assert.equal(await reduced.locator('.art-scene').getAttribute('data-still'),'true');await reduced.close()
 const sheet=await browser.newPage({viewport:{width:1440,height:1020}})
 for(let i=0;i<6;i++){
  await sheet.goto(base);await sheet.setContent(`<html><body style="margin:0;background:#101519;color:#eee;font:16px Georgia;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px">${art.slice(i*12,i*12+12).map(a=>`<div><img src="${base}/art/scripture/${a.file}" style="width:100%;height:205px;object-fit:cover"><div>${a.bookTitle} — ${a.title}</div></div>`).join('')}</body></html>`)
  await sheet.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())))
  await sheet.screenshot({path:`${out}/contact-${i+1}.png`})
 }
 await sheet.close();assert.deepEqual(errors,[]);checks.push('375px home and viewer fit; HD TV render; reduced motion stops artwork; six contact sheets capture all books')
 await writeFile(`${out}/art-verification.json`,JSON.stringify({base,checks,errors},null,2));console.log(checks.join('\n'))
}finally{await browser.close()}
