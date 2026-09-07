#!/usr/bin/env python3
"""One bounded Gemma request for typed scene specifications, never executable code."""
import json, time, urllib.request, urllib.error, fcntl
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'docs/art'
lock=open(folder/'.generation.lock','w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
books=json.loads((folder/'books.json').read_text());subjects=(folder/'subjects.txt').read_text()
system='''Return a JSON object with one key "scenes", an array of exactly 66 scene specifications matching the supplied book IDs. You are art-directing a coherent collection of intricate engraved biblical landscape illustrations. No SVG or code. Each scene must have exactly: id, family, palette, weather, focalX, horizon, sunX, detail. family must be one of mountain,sea,river,garden,desert,city,temple,interior,storm,tomb,tower,bridge,boat,harvest,gate. palette must be gold,blue,jade,rose. weather must be dawn,stars,storm,clear. focalX is a number 850 to 1250, horizon is 430 to 650, sunX is 700 to 1300. detail must be one of olive,lamp,vessel,stones,flowers,scroll,vine,none. Choose compositions that match the book subjects. Varied but coherent. Return valid JSON only.'''
prompt=subjects
model='gemma-4-31b';rates=json.loads((folder/'model-pricing.json').read_text())['pricing'];inp=float(rates['prompt']);out=float(rates['completion']);maximum=12000
reservation=2*((len(system.encode())+len(prompt.encode())+2000)*inp+maximum*out)
ledgerfile=folder/'spend.json';ledger=json.loads(ledgerfile.read_text())
if sum(r['reservedUsd'] for r in ledger['requests'])+reservation>4.5:raise RuntimeError('Budget cap reached; no request sent')
row={'book':'66-scene-directions','model':model,'reservedUsd':round(reservation,8),'status':'reserved'};ledger['requests'].append(row)
def save():
 p=ledgerfile.with_suffix('.tmp');p.write_text(json.dumps(ledger,indent=2));p.replace(ledgerfile)
save()
key=(Path.home()/'.config/helives/cerebras.key').read_text().strip()
payload={'model':model,'messages':[{'role':'system','content':system},{'role':'user','content':prompt}],'response_format':{'type':'json_object'},'max_completion_tokens':maximum,'temperature':.6}
try:
 req=urllib.request.Request('https://api.cerebras.ai/v1/chat/completions',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json','User-Agent':'HeLives-Artwork/1.0'})
 with urllib.request.urlopen(req,timeout=180) as response:data=json.load(response)
 (folder/'direction-response.json').write_text(json.dumps(data,indent=2))
 usage=data['usage'];row.update(usage=usage,estimatedUsd=round(usage['prompt_tokens']*inp+usage['completion_tokens']*out,8));save()
 if data['choices'][0]['finish_reason']!='stop':raise ValueError('Incomplete direction output')
 result=json.loads(data['choices'][0]['message']['content']);scenes=result['scenes']
 fields=['id','family','palette','weather','focalX','horizon','sunX','detail']
 scenes=[dict(zip(fields,s)) if isinstance(s,list) and len(s)==8 else s for s in scenes]
 result={'scenes':scenes}
 if len(scenes)!=66 or {s['id'] for s in scenes}!={b['id'] for b in books}:raise ValueError('Book coverage mismatch')
 for s in scenes:
  if set(s)!={'id','family','palette','weather','focalX','horizon','sunX','detail'}:raise ValueError('Invalid schema')
  if s['family'] not in 'mountain sea river garden desert city temple interior storm tomb tower bridge boat harvest gate'.split():raise ValueError('Invalid family')
  if s['palette'] not in ['gold','blue','jade','rose'] or s['weather'] not in ['dawn','stars','storm','clear']:raise ValueError('Invalid atmosphere')
  if s['detail'] not in ['olive','lamp','vessel','stones','flowers','scroll','vine','none','boat']:raise ValueError('Invalid detail')
  for field,lo,hi in [('focalX',850,1250),('horizon',430,650),('sunX',700,1300)]:
   if type(s[field]) not in (int,float) or not lo<=s[field]<=hi:raise ValueError('Invalid geometry')
 (folder/'directions.json').write_text(json.dumps(result,indent=2));row['status']='saved';save();print('66 typed directions saved. Estimated request cost $'+str(row['estimatedUsd']))
except urllib.error.HTTPError as e:
 row.update(status='http_error',httpStatus=e.code);save();print('Provider HTTP',e.code,'No automatic retry.');raise SystemExit(1)
except Exception as e:
 row.update(status='failed',reason=type(e).__name__);save();print(type(e).__name__,str(e)[:150],'No automatic retry.');raise SystemExit(1)
