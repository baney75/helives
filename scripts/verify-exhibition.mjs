import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir,readFile,writeFile } from 'node:fs/promises'
const base=process.env.HELIVES_PREVIEW_URL||'http://127.0.0.1:8787',out='demo/exhibition';await mkdir(out,{recursive:true})
const [books, library]=await Promise.all(['src/art/catalog.json','src/art/library.json'].map(path=>readFile(path,'utf8').then(JSON.parse)))
// Match `LIBRARY` without importing a Vite/TypeScript module: automatic playback is book-grouped.
const collection=books.flatMap(book=>library.filter(art=>art.bookId===book.id))
assert.equal(collection.length,660)
const b=await chromium.launch();const errors=[],checks=[]
try{
 const p=await b.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(String(e)))
 await p.clock.install({time:new Date('2026-09-07T17:00:00Z')});await p.goto(base+'/scriptures')
 const opener=p.getByRole('button',{name:'View artwork for John',exact:true});await opener.click()
 const reveal=async()=>{await p.mouse.move(20,300);await p.mouse.move(25,305);await p.clock.runFor(50)}
 const picker=p.getByLabel('Choose a book artwork');const ready=id=>p.locator(`.art-viewer [data-artwork="${id}"].is-ready`).waitFor()
 const current=()=>p.locator('.art-viewer .art-scene.is-ready').last().getAttribute('data-artwork')
 await ready('john');await p.getByRole('button',{name:'Play collection',exact:true}).click()
 await p.clock.runFor(59000);assert.equal(await picker.inputValue(),'john')
 await reveal();await p.getByRole('button',{name:'Next artwork',exact:true}).click();const johnIndex=collection.findIndex(a=>a.id==='john'),second=collection[(johnIndex+1)%collection.length];await ready(second.id);assert.equal(await picker.inputValue(),second.bookId);assert.equal(await p.locator('.art-scene-indicator').textContent(),`Scene ${collection.filter(a=>a.bookId===second.bookId).findIndex(a=>a.id===second.id)+1} of 10`)
 await p.clock.runFor(59000);assert.equal(await current(),second.id)
 await p.clock.runFor(1200);const third=collection[(johnIndex+2)%collection.length];await ready(third.id);assert.equal(await picker.inputValue(),third.bookId)
 await reveal();await p.getByRole('button',{name:'Pause motion',exact:true}).click();await p.clock.runFor(120000);assert.equal(await current(),third.id)
 await reveal();await p.getByRole('button',{name:'Resume motion',exact:true}).click()
 await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))})
 await p.clock.runFor(120000);assert.equal(await current(),third.id)
 await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))})
 await reveal();await p.getByRole('button',{name:'Stop collection',exact:true}).click();checks.push('Exhibition advances one scene after a full minute through the 660-scene collection; manual Next resets dwell; pause and hidden tabs preserve artwork')
 let held=null;await p.route('**/art/scripture/exodus.svg',route=>{held=route})
 await picker.selectOption('exodus');await p.waitForTimeout(50);await picker.selectOption('psalms');await ready('psalms');if(held)await held.continue();await p.clock.runFor(2600)
 assert.equal(await p.locator('.art-viewer .art-scene').count(),1);assert.equal(await p.locator('.art-viewer .art-scene').getAttribute('data-artwork'),'psalms')
 await picker.selectOption('john');await ready('john');await p.clock.runFor(2600);await picker.selectOption('psalms');await ready('psalms');await p.clock.runFor(2600);assert.equal(await p.locator('.art-viewer .art-scene').count(),1)
 await p.route('**/art/scripture/2-kings.svg',route=>route.fulfill({status:503,contentType:'text/plain',body:'Unavailable'}))
 await picker.selectOption('2-kings');await p.getByRole('button',{name:'Retry artwork',exact:true}).waitFor();assert.equal(await p.locator('.art-viewer [data-artwork="psalms"].is-ready').count(),1)
 await p.unroute('**/art/scripture/2-kings.svg');await p.getByRole('button',{name:'Retry artwork',exact:true}).click();await ready('2-kings');await p.clock.runFor(2600);assert.equal(await p.locator('.art-viewer .art-scene').count(),1)
 await p.keyboard.press('Escape');await p.clock.runFor(100);assert(await opener.evaluate(e=>document.activeElement===e));checks.push('Late image callback cannot replace selection; failed artwork retains last frame; Retry recovers; Escape restores focus')
 await p.close()
 const v=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'})
 for(const [name,url] of [['home','/'],['tv','/?display=1'],['faith','/faith'],['afterword','/genesis/afterword'],['canon','/scriptures']]){
  await v.goto(base+url);await v.locator('h1').first().waitFor();await v.evaluate(()=>document.fonts.ready);if(name==='home'||name==='tv')await v.locator('.art-scene.is-ready').waitFor();await v.screenshot({path:`${out}/${name}-1440.png`})
  if(name==='home'){
   const caption=await v.locator('.word-sign').boundingBox(),verse=await v.locator('.hero-verse').boundingBox();assert(caption.x>verse.x+verse.width);assert(caption.y+caption.height<900-65)
  }
 }
 for(const [name,url] of [['home','/'],['faith','/faith'],['afterword','/genesis/afterword']]){
  await v.setViewportSize({width:375,height:800});await v.goto(base+url);await v.locator('h1').first().waitFor();await v.screenshot({path:`${out}/${name}-375.png`});assert(await v.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
 }
 await v.goto(base+'/scriptures');await v.getByRole('button',{name:'View artwork for Daniel',exact:true}).click();await v.locator('.art-scene.is-ready').waitFor();await v.screenshot({path:`${out}/viewer-375.png`})
 for(const [width,height] of [[320,568],[640,360],[1280,800]]){await v.setViewportSize({width,height});const bounds=await v.locator('.art-viewer-controls').boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);await v.screenshot({path:`${out}/viewer-${width}.png`})}
 await v.close();assert.deepEqual(errors,[]);checks.push('Caption separated from Scripture and footer; Faith/Afterword/home responsive; gallery controls fit phone and short landscape')
 await writeFile(`${out}/checks.json`,JSON.stringify({base,checks,errors},null,2));console.log(checks.join('\n'))
}finally{await b.close()}
