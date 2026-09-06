import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { sceneBounds } from '../src/genesis/sceneTiming.ts'
const out=process.env.HELIVES_CAPTURE_DIR || 'demo/models-v2/after'
const base=process.env.HELIVES_PREVIEW_URL || 'http://127.0.0.1:8787'
await mkdir(out,{recursive:true})
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist']})
const errors=[]
try {
 for(const width of [1280,375]) for(const name of ['garden','fall','day5','day3']) {
  const bounds=sceneBounds(name),progress=bounds.start+(bounds.end-bounds.start)*.48
  const p=await b.newPage({viewport:{width,height:800},reducedMotion:'reduce'})
  p.on('pageerror',e=>errors.push(`${name}/${width}: ${e.message}`))
  p.on('console',e=>{if(e.type()==='error')errors.push(`${name}/${width}: ${e.text()}`)})
  await p.goto(`${base}/genesis?pause=1&progress=${progress}&quality=${width===375?'low':'high'}`,{waitUntil:'networkidle'})
  await p.waitForTimeout(1500)
  await p.screenshot({path:`${out}/${name}-${width}.png`})
  await p.close()
 }
 await writeFile(`${out}/errors.json`,JSON.stringify(errors,null,2))
 if(errors.length)throw new Error(errors.join('\n'))
 console.log(`8 model screenshots; zero console/page errors. ${out}`)
} finally { await b.close() }
