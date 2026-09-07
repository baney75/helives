#!/usr/bin/env python3
"""Gemma on Cerebras -> vetted SVG assets. No generated code is executed.
Owner-only local credential; fixed provider; durable pessimistic USD reservations.
"""
import argparse, base64, hashlib, json, os, re, time, urllib.request, urllib.error, xml.etree.ElementTree as ET
from pathlib import Path
import fcntl
ROOT=Path(__file__).resolve().parents[1]
MODEL='gemma-4-31b'
CAP=4.50 # leave $0.50 below the user's $5 ceiling
MAX_TOKENS=10000
ALLOWED={'svg','g','defs','linearGradient','radialGradient','stop','path','circle','ellipse','rect','line','polyline','polygon','clipPath','title','desc'}
ATTRS={'xmlns','viewBox','width','height','id','d','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','opacity','transform','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','fx','fy','points','clip-path','fill-rule','clip-rule','preserveAspectRatio'}
SYSTEM='''You are a master illustrator creating richly detailed, museum-quality SVG landscape engravings for a Christian Scripture website. Return ONLY one complete valid SVG, no markdown or prose. Make actual pictures, not icons, diagrams or symbols on a blank page. Use a 1600 by 1000 viewBox, full-bleed composition. A luminous copperplate engraving with cinematic atmospheric depth: intricate natural contours, large confident silhouettes, fine contour lines, tactile stone and botanical detail, distant mountains, beautifully structured sky. Night #07060a, deep indigo #151e2c, slate #384959, bronze #927043, gold #e8b86d, warm cream #fff4d6. Use rich midtones so the scene is CLEARLY visible, not almost black. Three or more depth planes. A distinctive focal scene mostly in the RIGHT TWO THIRDS; softer and darker atmosphere at left where website text may sit. Deliberate artistic asymmetry. Fill the canvas with a finished composition and meaningful detail. Use at least 60 carefully considered drawing elements, but no gratuitous complexity. Delicate repeated hatching can establish volume. No text, lettering, human figures, depictions of God, contemporary objects, logos, border or frame. No clipart, no stock cross icon, no glow ball, no random geometry. Allowed SVG elements: svg,g,defs,linearGradient,radialGradient,stop,path,circle,ellipse,rect,line,polyline,polygon,clipPath,title,desc. No scripts, style, animation, filter, use, image, href, foreignObject, external links or embedded data. Only inline presentation attributes. All IDs unique inside the SVG. Give the artwork a finished, legible, intentional composition that would work on a large television.'''

def sanitize(raw):
    start=raw.find('<svg');end=raw.rfind('</svg>')
    if start<0 or end<0: raise ValueError('Missing SVG')
    raw=raw[start:end+6]
    if len(raw)>150000 or re.search(r'<!\s*(?:DOCTYPE|ENTITY)',raw,re.I):raise ValueError('SVG too large or declaration found')
    root=ET.fromstring(raw)
    if root.tag.split('}')[-1]!='svg':raise ValueError('Root is not SVG')
    nodes=list(root.iter())
    if len(nodes)>1800 or len(nodes)<35:raise ValueError('Drawing complexity outside limits')
    ids=set()
    for el in nodes:
        tag=el.tag.split('}')[-1]
        if tag not in ALLOWED:raise ValueError('Disallowed SVG element: '+tag)
        el.tag=tag
        for k,v in el.attrib.items():
            if k not in ATTRS:raise ValueError('Disallowed SVG attribute: '+k)
            if '\\' in v or re.search(r'(?:[a-z]+:|//|[<>])',v,re.I):raise ValueError('External or active content')
            if 'url' in v.lower() and not re.fullmatch(r'url\(#[A-Za-z0-9_-]+\)',v):raise ValueError('Nonlocal URL')
            if k in {'fill','stroke','stop-color'} and not re.fullmatch(r'(?:#[0-9a-fA-F]{3,8}|none|currentColor|transparent|url\(#[A-Za-z0-9_-]+\))',v):raise ValueError('Invalid paint value')
        if 'id' in el.attrib:
            if el.attrib['id'] in ids:raise ValueError('Duplicate ID')
            ids.add(el.attrib['id'])
    root.set('xmlns','http://www.w3.org/2000/svg');root.set('viewBox','0 0 1600 1000')
    root.attrib.pop('width',None);root.attrib.pop('height',None)
    return ET.tostring(root,encoding='unicode'),len(nodes)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--books',default='genesis,exodus,psalms');ap.add_argument('--all',action='store_true');args=ap.parse_args()
    folder=ROOT/'docs/art';folder.mkdir(parents=True,exist_ok=True)
    lock=open(folder/'.generation.lock','w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    credential=Path.home()/'.config/helives/cerebras.key'
    key=credential.read_text().strip()
    with urllib.request.urlopen(urllib.request.Request('https://api.cerebras.ai/public/v1/models',headers={'User-Agent':'HeLives-Artwork/1.0','Accept':'application/json'}),timeout=20) as response:models=json.load(response)
    model=next(m for m in models['data'] if m['id']==MODEL)
    pricing=model['pricing'];inp=float(pricing['prompt']);out=float(pricing['completion'])
    if not(0<inp<=.000002 and 0<out<=.000003):raise RuntimeError('Unexpected pricing: review required')
    (folder/'model-pricing.json').write_text(json.dumps({'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'model':MODEL,'pricing':pricing,'source':'https://api.cerebras.ai/public/v1/models'},indent=2))
    ledgerfile=folder/'spend.json';ledger=json.loads(ledgerfile.read_text()) if ledgerfile.exists() else {'ceilingUsd':5,'operatingCapUsd':CAP,'requests':[]}
    def save():
        temp=ledgerfile.with_suffix('.tmp');temp.write_text(json.dumps(ledger,indent=2));temp.replace(ledgerfile)
    books=json.loads((folder/'books.json').read_text());subjects={line.split('|')[0]:line.split('|')[1:] for line in (folder/'subjects.txt').read_text().splitlines() if line.strip()}
    wanted={b['id'] for b in books} if args.all else set(args.books.split(','))
    if wanted-{b['id'] for b in books}:raise ValueError('Unknown book')
    output=ROOT/'public/art/scripture';output.mkdir(parents=True,exist_ok=True)
    for book in books:
        bid=book['id'];dest=output/(bid+'.svg')
        if bid not in wanted or dest.exists():continue
        title,brief=subjects[bid];prompt=f"Create the finished SVG artwork for {book['title']}. Theme: {title}. Scene: {brief}. This is an artistic meditation on the book, not documentary evidence. Use the full canvas. Return only SVG."
        # UTF-8 byte count is a deliberately pessimistic token bound; reserve before sending.
        reservation=2*((len(SYSTEM.encode())+len(prompt.encode())+2000)*inp+MAX_TOKENS*out)
        if sum(r['reservedUsd'] for r in ledger['requests'])+reservation>CAP:raise RuntimeError('Budget cap reached. No further request sent.')
        row={'book':bid,'model':MODEL,'reservedUsd':round(reservation,8),'status':'reserved','at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())};ledger['requests'].append(row);save()
        payload={'model':MODEL,'messages':[{'role':'system','content':SYSTEM},{'role':'user','content':prompt}],'temperature':.7,'max_completion_tokens':MAX_TOKENS}
        request=urllib.request.Request('https://api.cerebras.ai/v1/chat/completions',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json','User-Agent':'HeLives-Artwork/1.0'})
        try:
            with urllib.request.urlopen(request,timeout=180) as response:data=json.load(response)
            usage=data.get('usage',{});row['usage']=usage;row['estimatedUsd']=round(usage.get('prompt_tokens',0)*inp+usage.get('completion_tokens',0)*out,8)
            choice=data['choices'][0]
            if choice.get('finish_reason')!='stop':raise ValueError('Incomplete output: '+str(choice.get('finish_reason')))
            rawdir=folder/'source';rawdir.mkdir(exist_ok=True);(rawdir/(bid+'.txt')).write_text(choice['message']['content'])
            svg,count=sanitize(choice['message']['content']);dest.write_text(svg)
            row.update(status='saved',elements=count,sha256=hashlib.sha256(svg.encode()).hexdigest(),file=str(dest.relative_to(ROOT)))
            print(f"{bid}: saved {count} elements, estimated ${row['estimatedUsd']:.4f}",flush=True)
        except urllib.error.HTTPError as exc:
            row.update(status='http_error',httpStatus=exc.code);save();print(f'{bid}: provider HTTP {exc.code}; stopped without retry. Key and provider body withheld.',flush=True);raise SystemExit(1)
        except Exception as exc:
            row.update(status='failed',reason=str(exc)[:180]);save();print(f'{bid}: {type(exc).__name__}: {str(exc)[:180]}',flush=True);continue
        save()
    print('Estimated charges:',round(sum(r.get('estimatedUsd',0) for r in ledger['requests']),4),'USD; reserved upper bound:',round(sum(r['reservedUsd'] for r in ledger['requests']),4),flush=True)
if __name__=='__main__':main()
