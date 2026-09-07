/** Deterministic engraved landscapes from validated Gemma art directions.
 * All SVG geometry is authored here; model output supplies enums and numbers only.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { optimize } from 'svgo'
import { createHash } from 'node:crypto'
const root=new URL('../',import.meta.url)
const books=JSON.parse(await readFile(new URL('docs/art/books.json',root)))
const directions=JSON.parse(await readFile(new URL('docs/art/directions.json',root))).scenes
const subjects=Object.fromEntries((await readFile(new URL('docs/art/subjects.txt',root),'utf8')).trim().split('\n').map(line=>{const [id,title,description]=line.split('|');return[id,{title,description}]}))
const passageDirections=JSON.parse(await readFile(new URL('docs/art/passage-art.json',root)))
const families='mountain sea river garden desert city temple interior storm tomb tower bridge boat harvest gate'.split(' ')
if(directions.length!==66 || new Set(directions.map(s=>s.id)).size!==66)throw Error('Invalid coverage')
for(const s of directions){
 if(!books.some(b=>b.id===s.id)||!families.includes(s.family)||!['gold','blue','jade','rose'].includes(s.palette)||!['dawn','stars','storm','clear'].includes(s.weather)||!['olive','lamp','vessel','stones','flowers','scroll','vine','none','boat'].includes(s.detail))throw Error('Invalid scene enum')
 for(const [field,low,high] of [['focalX',850,1250],['horizon',430,650],['sunX',700,1300]])if(typeof s[field]!=='number'||!Number.isFinite(s[field])||s[field]<low||s[field]>high)throw Error('Invalid scene number')
}
const palettes={gold:['#101921','#293943','#82694b','#b79863','#f4d69c'],blue:['#0d1927','#273e55','#697f90','#acb5aa','#f1dba9'],jade:['#101d1d','#29423d','#667b62','#b7ae75','#f4dda1'],rose:['#201920','#423644','#89706c','#c49a7a','#ffe0aa']}
const n=x=>Number(x.toFixed(2))
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const escape=x=>x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const editorial = {obadiah:{family:'tower'},esther:{family:'gate'},hosea:{family:'gate'},proverbs:{family:'gate'},ephesians:{family:'gate'},'1-thessalonians':{family:'tower'},titus:{family:'city'},revelation:{family:'river'}}
function render(input,seed){
 const s={...input,...editorial[input.id]}
 const rand=random(seed),p=palettes[s.palette],gold=p[3],ink=p[0],bright=p[4];let parts=[]
 const path=(d,fill='none',stroke=gold,width=.8,opacity=1)=>parts.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" stroke-linejoin="round" stroke-linecap="round"/>`)
 const circle=(x,y,r,fill,opacity=1)=>parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}" opacity="${opacity}"/>`)
 const line=(x,y,x2,y2,col=gold,width=.7,opacity=.5)=>path(`M${n(x)} ${n(y)}L${n(x2)} ${n(y2)}`,'none',col,width,opacity)
 const rect=(x,y,w,h,fill,stroke='none',sw=.5)=>parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`)
 const curve=(pts)=>'M'+pts.map(([x,y])=>`${n(x)} ${n(y)}`).join('L')
 const noise=(x,phase)=>Math.sin(x*.004+phase)*43+Math.sin(x*.012+phase*2)*20+Math.sin(x*.039+phase)*6+Math.sin(x*.093+phase*3)*2
 const H=s.horizon,X=s.id==='exodus'?800:s.focalX
 parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><title>${escape(s.title??subjects[s.id].title)}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${ink}"/><stop offset=".65" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient><radialGradient id="light"><stop stop-color="${bright}" stop-opacity=".42"/><stop offset=".4" stop-color="${gold}" stop-opacity=".12"/><stop offset="1" stop-color="${gold}" stop-opacity="0"/></radialGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="${p[2]}"/><stop offset="1" stop-color="${ink}"/></linearGradient><linearGradient id="stone" x2="1" y2=".4"><stop stop-color="${p[2]}"/><stop offset=".5" stop-color="${p[1]}"/><stop offset="1" stop-color="${ink}"/></linearGradient><linearGradient id="edge"><stop stop-color="${bright}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient><linearGradient id="bank" x2=".2" y2="1"><stop stop-color="${p[1]}"/><stop offset="1" stop-color="${ink}"/></linearGradient><linearGradient id="leaf" x2="1" y2=".3"><stop stop-color="${p[2]}"/><stop offset=".48" stop-color="${p[1]}"/><stop offset="1" stop-color="${ink}"/></linearGradient><linearGradient id="mist" x2="0" y2="1"><stop stop-color="${p[2]}" stop-opacity="0"/><stop offset=".7" stop-color="${p[2]}" stop-opacity=".16"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></linearGradient><radialGradient id="disc" cx=".35" cy=".3"><stop stop-color="${bright}"/><stop offset=".78" stop-color="${gold}"/><stop offset="1" stop-color="${p[2]}"/></radialGradient></defs>`)
 rect(0,0,1600,1000,'url(#sky)');circle(s.sunX,H-100,470,'url(#light)')
 // Fine astronomical marks and long cloud bands establish depth without filters.
 for(let i=0;i<(s.weather==='stars'?220:65);i++){const x=rand()*1600,y=rand()*390;circle(x,y,rand()>.94?1.4:.55,bright,.2+rand()*.55)}
 if(s.weather!=='storm'){circle(s.sunX,H-118,s.weather==='stars'?32:66,'url(#disc)',.75);for(let i=0;i<5;i++)parts.push(`<circle cx="${s.sunX}" cy="${H-118}" r="${74+i*10}" fill="none" stroke="${gold}" stroke-width=".5" opacity="${.22-i*.035}"/>`)}
 for(let i=0;i<44;i++){let y=100+i*9+rand()*25,x=rand()*500-120,w=700+rand()*600;path(`M${n(x)} ${n(y)}C${n(x+w*.25)} ${n(y-32)} ${n(x+w*.6)} ${n(y+28)} ${n(x+w)} ${n(y-10)}`,'none',gold,.45,.1+rand()*.12)}
 const mountain=(level,base,amp)=>{
  const phase=rand()*20,pts=[]
  for(let x=-30;x<=1640;x+=12)pts.push([x,base+noise(x,phase)*amp]);
  path(curve(pts)+'L1640 1000H-30Z',[p[2],p[1],ink][level],gold,.75,1)
  // Parallel ridge contours follow the silhouette: distant hills read as relief,
  // with fewer high-contrast marks than the objects in the foreground.
  for(let row=1;row<=8;row++){
   const contour=pts.filter((_,i)=>i%3===0).map(([x,y])=>[x,y+row*(3+level)+Math.sin(x*.007+phase)*row*.35])
   path(curve(contour),'none',row%4===0?bright:gold,.42,(level===2?.075:.13)*(1-row/17))
  }
  for(let j=0;j<60;j++){const x=rand()*1600,y=base+noise(x,phase)*amp;const pts2=[];for(let k=0;k<15;k++)pts2.push([x+k*8+(rand()-.5)*8,y+k*9+Math.sin(k*.7+j)*6]);path(curve(pts2),'none',gold,.55,level===2?.13:.22)}
 }
 mountain(0,H-100,.8);rect(0,H-170,1600,190,'url(#mist)');mountain(1,H-10,1.4)
 // Rivers, seas and pools use hundreds of swept engraved lines.
 const water=(top,rough=0)=>{
  path(`M0 ${top}Q800 ${top-22} 1600 ${top}V1000H0Z`,'url(#water)','none')
  for(let i=0;i<240;i++){const y=top+rand()*(1000-top),x=rand()*1800-100,len=20+rand()*180*(y/700),wave=rough*(4+rand()*28);path(`M${n(x)} ${n(y)}q${n(len*.3)} ${n(-wave-2)} ${n(len*.6)} 0t${n(len*.5)} 0`,'none',rand()>.6?bright:gold,.45+rand()*.45,.1+rand()*.35)}
  for(let i=0;i<55;i++){const y=top+i*5.5,w=15+i*1.8+rand()*20;line(s.sunX-w,y,s.sunX+w,y,bright,.6,.3*(1-i/65))}
 }
 const ground=()=>{path(`M0 900Q450 770 750 840Q1190 710 1600 800V1000H0Z`,ink,gold,.8);for(let i=0;i<125;i++){let x=rand()*1600,y=850+rand()*150;path(`M${n(x)} ${n(y)}q${n(10+rand()*50)} -8 ${n(30+rand()*60)} 0`,'none',gold,.55,.17)}}
 const stone=(x,y,w,h)=>{path(`M${x} ${y+h}L${x-w*.1} ${y+h*.2}Q${x+w*.3} ${y-h*.1} ${x+w*.8} ${y}L${x+w} ${y+h*.7}L${x+w*.7} ${y+h}Z`,'url(#stone)',gold,.7);for(let i=0;i<8;i++)line(x+3,y+h*(i+1)/10,x+w*.8,y+h*(i+1)/10-7,gold,.45,.24)}
 const tree=(x,y,size=1,vine=false)=>{
  parts.push(`<g transform="translate(${x} ${y}) scale(${size})">`)
  const branches=[]
  const grow=(x,y,len,angle,width,depth)=>{const ex=x+Math.cos(angle)*len,ey=y+Math.sin(angle)*len;path(`M${n(x-width*.5)} ${n(y)}Q${n(x+len*.12)} ${n(y-len*.45)} ${n(ex)} ${n(ey)}Q${n(x+width+len*.13)} ${n(y-len*.45)} ${n(x+width*.5)} ${n(y)}Z`,p[2],gold,.65,.95);if(depth>0){grow(ex,ey,len*(.62+rand()*.12),angle-.4-rand()*.24,width*.6,depth-1);grow(ex,ey,len*(.62+rand()*.12),angle+.38+rand()*.24,width*.6,depth-1)}else branches.push([ex,ey])}
  grow(0,0,170,-Math.PI/2,28,4)
  for(const [bx,by] of branches)for(let i=0;i<14;i++){const a=rand()*Math.PI*2,r=rand()*48,l=10+rand()*13,x=bx+Math.cos(a)*r,y=by+Math.sin(a)*r;parts.push(`<path d="M${n(x)} ${n(y)}q${n(-l*.9)} ${n(-l)} ${n(l*.4)} ${n(-l*1.6)}q${n(l*.9)} ${n(l)} ${n(-l*.4)} ${n(l*1.6)}Z" fill="${rand()>.5?'url(#leaf)':p[2]}" stroke="${gold}" stroke-width=".5"/>`);path(`M${n(x)} ${n(y-1)}q${n(l*.05)} ${n(-l*.85)} ${n(l*.4)} ${n(-l*1.52)}`,'none',bright,.4,.42);if(vine&&i%4===0)circle(x,y+8,3,gold,.8)}
  for(let i=0;i<7;i++)path(`M${i*3-9} -14Q${i*2-14} -94 ${i-4} -157`,'none',bright,.5,.3)
  for(let i=0;i<12;i++)path(`M${i-7} -10Q${i*3-20} 5 ${i*8-44} ${10+rand()*8}`,'none',gold,.8,.65)
  parts.push('</g>')
 }
 const lamp=(x,y,size=1)=>{parts.push(`<g transform="translate(${x} ${y}) scale(${size})">`);circle(0,-80,180,'url(#light)');path('M-65 0Q-40 70 24 35L73 -8L35 3Q0 -17 -65 0Z','url(#stone)',gold,1.2);path('M-63 2Q-105 -36 -85 -42Q-61 -47 -48 -11','none',gold,3);for(let i=0;i<12;i++)path(`M${-42+i*4} 12q10 18 26 14`,'none',gold,.65,.5);path('M60 -12Q36 -44 61 -78Q52 -47 72 -32Q77 -20 60 -12Z',bright,gold,1);parts.push('</g>')}
 const vessel=(x,y,size=1)=>{parts.push(`<g transform="translate(${x} ${y}) scale(${size})">`);path('M-30 -170H30L26 -120Q98 -85 64 0Q0 20 -64 0Q-98 -85 -26 -120Z','url(#stone)',gold,1);for(let i=0;i<28;i++){let yy=-100+i*3.8,ww=60-Math.abs(yy+55)*.18;path(`M${-ww} ${yy}Q0 ${yy+18} ${ww} ${yy}`,'none',gold,.6,.45)}path('M-28 -167Q0 -157 28 -167','none',bright,1);parts.push('</g>')}
 const flowers=(x,y)=>{for(let i=0;i<90;i++){const xx=x+rand()*380-190,yy=y+rand()*80,len=20+rand()*95;path(`M${n(xx)} ${n(yy)}q-8 ${n(-len*.6)} 4 ${n(-len)}`,'none',gold,.7,.65);for(let j=0;j<5;j++){const a=j*Math.PI*2/5;parts.push(`<ellipse cx="${n(xx+4+Math.cos(a)*5)}" cy="${n(yy-len+Math.sin(a)*5)}" rx="4" ry="2" transform="rotate(${n(a*180/Math.PI)} ${n(xx+4)} ${n(yy-len)})" fill="${bright}" opacity=".65"/>`)}}}
 const bricks=(x,y,w,h,scale=1)=>{for(let j=0;j<h/(18*scale);j++){let yy=y+j*18*scale;line(x,yy,x+w,yy,gold,.5,.32);for(let k=0;k<w/(42*scale);k++){let xx=x+(k*42+(j%2)*21)*scale;if(xx<x+w)line(xx,yy,xx,Math.min(y+h,yy+18*scale),gold,.5,.26)}}}
 const arch=(x,y,w,h)=>{path(`M${x} ${y+h}V${y+w/2}A${w/2} ${w/2} 0 0 1 ${x+w} ${y+w/2}V${y+h}Z`,ink,gold,1);for(let i=0;i<13;i++){let a=Math.PI+i*Math.PI/12;line(x+w/2+Math.cos(a)*(w/2+2),y+w/2+Math.sin(a)*(w/2+2),x+w/2+Math.cos(a)*(w/2+18),y+w/2+Math.sin(a)*(w/2+18),gold,.8,.7)}}
 const building=(x,y,w,h,tower=false)=>{rect(x,y,w,h,'url(#stone)',gold,.9);
  path(`M${x+w} ${y}l${w*.12} ${-w*.08}v${h}l${-w*.12} ${w*.08}Z`,ink,gold,.55,.9)
  path(`M${x} ${y}l${w*.12} ${-w*.08}h${w}l${-w*.12} ${w*.08}Z`,p[2],gold,.55,.85)
  line(x+2,y+2,x+2,y+h,bright,.8,.5);bricks(x,y,w,h);arch(x+w*.31,y+h*.35,w*.38,h*.65);for(let i=0;i<(tower?5:8);i++){const ww=w/(tower?5:8);rect(x+i*ww,y-12,ww*.65,15,p[2],gold,.7)}line(x-5,y+h,x+w+5,y+h,bright,1,.7)}
 const temple=(x,y,wide=1)=>{
  parts.push(`<g transform="translate(${x} ${y}) scale(${wide})">`)
  for(let i=0;i<10;i++)rect(-180-i*9,20+i*10,360+i*18,10,p[1],gold,.65)
  rect(-174,-248,348,272,'url(#stone)',gold,1);bricks(-174,-248,348,272);arch(-65,-203,130,225)
  for(const xx of [-151,-107,90,134]){rect(xx,-223,18,235,p[2],gold,1);for(let i=0;i<4;i++)line(xx+3+i*4,-217,xx+3+i*4,8,bright,.6,.4);rect(xx-7,-233,32,11,p[3],gold,.7);rect(xx-6,8,30,12,p[3],gold,.7)}
  path('M-200 -250L0 -340L200 -250Z','url(#stone)',gold,1.3);path('M-170 -260L0 -320L170 -260Z','none',gold,1);for(let i=0;i<20;i++)rect(-190+i*20,-250,10,10,p[3]);parts.push('</g>')
 }
 const boat=(x,y,scale=1)=>{parts.push(`<g transform="translate(${x} ${y}) scale(${scale})">`);path('M-160 -20Q0 42 160 -28L125 36Q0 80 -127 36Z','url(#stone)',gold,1.3);for(let i=0;i<9;i++)path(`M${-147+i*4} ${-10+i*6}Q0 ${42+i*3} ${144-i*3} ${-16+i*6}`,'none',gold,.7,.6);line(0,-240,0,24,gold,4,.9);path('M7 -224Q124 -185 139 -51Q80 -69 7 -44Z',p[2],gold,1);for(let i=0;i<16;i++)path(`M${10+i*7} ${-220+i*6}Q${40+i*7} -131 ${12+i*7} -52`,'none',bright,.5,.28);line(0,-238,-132,0,gold,1,.7);line(0,-238,142,-9,gold,1,.7);parts.push('</g>')}
 const hillPath=()=>{path(`M${X-15} ${H+50}Q${X-160} ${H+160} ${X+30} 780Q${X+230} 910 ${X-100} 1020H${X-330}Q${X+50} 880 ${X-35} 780Q${X-210} ${H+150} ${X-15} ${H+50}Z`,p[2],gold,.7,.6);for(let i=0;i<22;i++)path(`M${X-48-i*3} ${H+100+i*18}q${60+i*4} -8 ${100+i*3} 3`,'none',gold,.65,.4)}
 switch(s.family){
 case 'sea':
  water(H,1);if(s.id==='exodus')for(const side of [0,1]){
   parts.push(`<g transform="${side?'translate(1600 0) scale(-1 1)':''}">`)
   path('M-80 1050V290Q70 238 180 295Q241 333 220 405Q213 486 325 677Q451 845 535 1050Z','url(#water)',gold,1.2)
   path('M-40 296Q75 249 177 310Q225 340 224 389Q222 418 211 430','none',bright,2,.65)
   for(let i=0;i<48;i++){const yy=400+i*13;path(`M-40 ${yy}Q90 ${yy-56} ${155+i*5.9} ${yy+46}`,'none',i%4===0?bright:gold,.7,.23)}
   for(let i=0;i<42;i++){const x=8+rand()*183,y=270+x*.35+rand()*25;line(x,y,x+7+rand()*14,y+2,bright,1,.42)}
   parts.push('</g>')
  }break
 case 'river':
  water(H+40);path(`M0 ${H+20}Q500 ${H+70} ${X-80} ${H+70}Q${X-260} 700 ${X-260} 810Q${X-600} 840 430 1030H0Z`,'url(#bank)',gold,.8);path(`M1600 ${H+20}Q${X+100} ${H+30} ${X+25} ${H+80}Q${X-100} 710 ${X+20} 820Q${X+300} 890 1350 1030H1600Z`,ink,gold,.8);tree(1380,930,1.15);flowers(150,975);break
 case 'garden':case 'harvest':
  mountain(2,H+210,.5);for(let i=0;i<45;i++)path(`M${-500+i*65} 1050Q${X+i*9-300} 740 ${X+i*4-140} ${H+80}`,'none',gold,.6,.25);ground();if(!['zechariah','psalms-fountain','john-living-well'].includes(s.id))tree(X+70,860,1.1,s.detail==='vine');if(s.family==='harvest')for(let i=0;i<95;i++){const xx=rand()*1600,yy=940+rand()*100,ll=50+rand()*150;path(`M${n(xx)} ${n(yy)}q20 ${n(-ll*.6)} 7 ${n(-ll)}`,'none',gold,.8,.65);for(let j=0;j<7;j++){line(xx+7,yy-ll+j*5,xx-2,yy-ll+j*5-8,bright,1.3,.7);line(xx+7,yy-ll+j*5,xx+17,yy-ll+j*5-7,gold,1.3,.8)}}else flowers(400,990);break
 case 'temple':
  ground();if(s.id!=='leviticus')temple(X,660,1.15);tree(1500,950,.85);lamp(X-230,840,.55);lamp(X+235,840,.55);break
 case 'city':
  mountain(2,H+220,1);for(let i=0;i<21;i++){const x=570+i*46,y=H+20+Math.sin(i*.5)*45,w=40+rand()*50,h=50+rand()*100;building(n(x),n(y-h),n(w),n(h));}building(X-210,H+120,430,150);ground();hillPath();break
 case 'tower':
  ground();path(`M${X-300} 900L${X-100} ${H+40}L${X+180} ${H+90}L${X+370} 960Z`,p[1],gold,.8);building(X-72,H-190,145,360,true);for(let j=0;j<3;j++)arch(X-42+j*29,H-152,20,40);circle(X,H-140,90,'url(#light)');break
 case 'bridge':
  water(H+100);path(`M500 700Q1000 600 1540 630L1530 840H500Z`,'url(#stone)',gold,1);bricks(520,690,980,150);for(let i=0;i<7;i++)arch(560+i*137,708,95,170);for(let i=0;i<80;i++)line(500+i*13,700-i*.7,500+i*13,679-i*.7,gold,.7,.65);ground();break
 case 'boat':
  water(H,1);boat(X,780,1.2);boat(370,H+85,.25);break
 case 'tomb':
  ground();path(`M${X-360} 890Q${X-440} 640 ${X-260} 480Q${X-150} 390 ${X+80} 460Q${X+400} 500 ${X+410} 900Z`,'url(#stone)',gold,1);for(let i=0;i<75;i++){const yy=490+i*5;path(`M${X-300-i*.6} ${yy}q100 -55 210 -18t210 5`,'none',gold,.65,.22)}arch(X-120,540,225,340);path(`M${X-95} 853h165l-20 -12h-105Z`,bright,'none',0,.55);circle(X+235,765,150,p[1]);for(let i=0;i<15;i++)parts.push(`<ellipse cx="${X+235}" cy="765" rx="${150-i*8}" ry="${145-i*7}" fill="none" stroke="${gold}" stroke-width=".7" opacity=".45"/>`);tree(1530,930,1.25);break
 case 'interior':
  rect(0,0,520,1000,ink);rect(1370,0,230,1000,ink);bricks(1370,0,230,1000,2);path('M520 1000V270Q900 -130 1370 270V1000','none',gold,2,.6);for(let i=0;i<14;i++)path(`M${520-i*8} 1000V270Q900 ${-130-i*12} ${1370+i*8} 270V1000`,'none',gold,.6,.24);rect(670,790,700,45,'url(#stone)',gold,.8);rect(740,835,28,180,p[1]);rect(1250,835,28,180,p[1]);if(!['daniel','philemon'].includes(s.id)){lamp(X-30,776,1.2);vessel(X+200,795,.65)}break
 case 'gate':
  ground();if(s.id==='2-kings'){
   path(`M${X-250} 925V${H-90}l55 8 0 60 40 -12 15 70 30 -14 4 140 32 34 -12 90Z`,'url(#stone)',gold,1.2)
   path(`M${X+100} 925l12 -138 34 -12 8 -110 36 9 0 -110 65 -5V925Z`,'url(#stone)',gold,1.2)
   bricks(X-248,800,105,120);bricks(X+155,800,100,120)
   for(let i=0;i<18;i++)stone(X-170+rand()*360,900+rand()*65,25+rand()*42,18+rand()*28)
  }else building(X-190,H-100,380,450);tree(X+280,950,1.1,true);if(s.id!=='2-kings')hillPath();break
 case 'desert':
  for(let j=0;j<5;j++){let yy=H+j*95;path(`M-100 ${yy}Q450 ${yy-160} 950 ${yy+5}T1700 ${yy-40}V1050H-100Z`,j%2?p[1]:p[2],gold,.7,.9);for(let i=0;i<20;i++)path(`M-100 ${yy+i*4}Q450 ${yy-155+i*5} 950 ${yy+8+i*4}T1700 ${yy-36+i*5}`,'none',gold,.45,.19)}for(let i=0;i<15;i++){let x=750+i*42,y=650+Math.sin(i)*24;path(`M${x} ${y}l24 -24 28 24Z`,p[1],gold,.8)}break
 case 'storm':
  mountain(2,H+240,2);for(let i=0;i<85;i++){let a=i*.15,r=60+i*3.5;path(`M${n(X+Math.cos(a)*r)} ${n(200+Math.sin(a)*r*.38)}q-110 -35 -210 12`,'none',gold,1,.23)}for(let i=0;i<150;i++){let x=rand()*1600,y=rand()*760;line(x,y,x-16,y+45,p[3],.5,.14)}break
 default:
  mountain(2,H+230,1.5);ground();hillPath();tree(1500,1000,1.1);break
 }

 // Passage scenes share the engraving vocabulary, with their own focal objects.
 if(['psalms-fountain','john-living-well'].includes(s.id)){
  tree(1490,920,.85);const yy=830
  if(s.id==='john-living-well'){
   // Circular stone well: open water surface, masonry drum and wooden crossbeam.
   path(`M${X-120} ${yy-100}v130q120 65 240 0v-130Z`,'url(#stone)',gold,1)
   for(let i=0;i<5;i++)path(`M${X-120} ${yy-77+i*24}q120 58 240 0`,'none',gold,.8,.5)
   for(let i=0;i<10;i++){const xx=X-108+i*24;line(xx,yy-67,xx,yy+40,gold,.6,.3)}
   parts.push(`<ellipse cx="${X}" cy="${yy-100}" rx="120" ry="39" fill="${ink}" stroke="${gold}" stroke-width="2"/><ellipse cx="${X}" cy="${yy-96}" rx="98" ry="24" fill="url(#water)"/>`)
   for(const dir of [-1,1]){rect(X+dir*145-9,yy-290,18,340,'url(#stone)',gold,1);line(X+dir*145-4,yy-280,X+dir*145-4,yy+42,bright,.7,.5)}
   rect(X-170,yy-304,340,20,p[2],gold,1);line(X,yy-284,X,yy-80,gold,2,.8)
   path(`M${X-21} ${yy-79}l6 38h31l5 -38Z`,p[2],gold,1)
  }else{
   // A low fountain feeds a basin; the rising jets remain behind the rim.
   parts.push(`<ellipse cx="${X}" cy="${yy+45}" rx="205" ry="60" fill="url(#stone)" stroke="${gold}"/><ellipse cx="${X}" cy="${yy+31}" rx="185" ry="41" fill="url(#water)" stroke="${gold}"/>`)
   for(let i=0;i<9;i++){const spread=30+i*13;path(`M${X} ${yy+22}q${-spread} -250 ${-spread*1.1} 0M${X} ${yy+22}q${spread} -250 ${spread*1.1} 0`,'none',i%3?gold:bright,.7,.6)}
   path(`M${X-23} ${yy+25}l8 -73h30l8 73Z`,'url(#stone)',gold,1)
  }
 }
 // Book-specific objects keep named subjects faithful to the intended meditation.
 const lion=(x,y,scale=1,flip=1)=>{
  parts.push(`<g transform="translate(${x} ${y}) scale(${scale*flip} ${scale})">`)
  path('M-135 -27Q-160 -90 -70 -104Q5 -112 46 -64Q78 -45 69 -9L-124 0Q-151 -5 -135 -27Z','url(#stone)',gold,1.3)
  path('M-127 -30Q-178 -80 -200 -25Q-206 -10 -195 -9','none',gold,5)
  path('M-90 -45Q-58 -65 -34 -29L-20 -9H-93Q-110 -23 -90 -45M24 -47Q55 -43 62 -4H4Q-8 -19 24 -47Z',p[2],gold,1)
  path('M22 -45Q29 -99 63 -105L110 -72Q86 -24 67 -8Z',p[2],gold,1)
  path('M57 -64Q10 -82 23 -150Q38 -204 96 -188Q154 -169 141 -111Q136 -74 105 -64Z',p[1],gold,1.4)
  for(let i=0;i<50;i++){let a=i*Math.PI*2/50;path(`M${n(81+Math.cos(a)*37)} ${n(-130+Math.sin(a)*43)}Q${n(82+Math.cos(a)*66)} ${n(-132+Math.sin(a)*69)} ${n(83+Math.cos(a)*58)} ${n(-130+Math.sin(a)*64)}`,'none',gold,.75,.6)}
  path('M49 -151Q47 -181 61 -176L72 -165Q94 -174 109 -158Q119 -177 127 -162L121 -139L129 -111Q119 -97 98 -105Q77 -93 65 -113Z',p[2],gold,1)
  path('M72 -137q9 -6 16 0M104 -138q10 -5 15 0M89 -122l15 -1 -7 9ZM98 -113v9m0 0l-12 2m12 -2 12 1','none',bright,1.2)
  for(let i=0;i<5;i++){line(82,-110+i*3,58-i*4,-112+i*4,bright,.6,.7);line(112,-111+i*3,133+i*4,-116+i*4,bright,.6,.7)}
  for(let i=0;i<25;i++)path(`M${-120+i*6} -68q-12 18 2 40`,'none',gold,.65,.3)
  parts.push('</g>')
 }
 if(s.id==='daniel'){rect(450,810,1040,190,ink);lion(X-130,934,1.6,1);lion(X+170,944,1.05,-1)}
 if(s.id==='zechariah'){
  tree(X-245,890,.78);tree(X+265,890,.78);line(X,820,X,485,gold,9,1)
  for(let i=1;i<=3;i++)for(const dir of [-1,1]){const xx=X+dir*i*42;path(`M${X} ${810-i*50}Q${xx} ${810-i*50} ${xx} ${610-i*33}V485`,'none',gold,7);lamp(xx,472,.28)}
  lamp(X,472,.28);path(`M${X-62} 850L${X-30} 829H${X+30}L${X+62} 850Z`,p[2],gold,1)
 }
 if(s.id==='exodus'){
  path(`M${X-22} ${H+6}Q${X-170} 750 ${X-225} 1030H${X+225}Q${X+115} 750 ${X+22} ${H+6}Z`,'url(#stone)',bright,.8)
  for(let i=0;i<100;i++){let yy=H+15+rand()*(1000-H),w=(yy-H)*.8,xx=X+(rand()-.5)*w;path(`M${n(xx)} ${n(yy)}l${n(5+rand()*26)} -3`,'none',gold,.8,.5)}
 }
 if(s.id==='jonah'){
  parts.push(`<g transform="translate(${X-100} 840)">`);path('M-340 -80Q-220 -190 35 -154Q160 -140 195 -92Q286 -121 322 -185Q338 -134 299 -82Q342 -52 347 7Q274 -41 185 -47Q50 21 -176 -14Q-296 -17 -340 -80Z',ink,gold,1.5);path('M-290 -72Q-156 -37 74 -65Q-10 45 -79 -13','none',gold,1);for(let i=0;i<25;i++)path(`M${-260+i*12} -120q42 35 15 83`,'none',gold,.7,.2);circle(-250,-104,4,bright);parts.push('</g>')
 }
 if(s.id==='leviticus'){
  rect(X-235,410,460,300,'url(#stone)',gold,1);path(`M${X-260} 410L${X-100} 340H${X+175}L${X+250} 410Z`,p[2],gold,1)
  for(let i=0;i<30;i++)path(`M${X-230+i*15} 416q-5 140 3 292`,'none',gold,.7,.6)
  rect(X-65,442,130,270,ink,gold);path(`M${X-65} 442q35 110 0 255M${X+65} 442q-35 110 0 255`,'none',bright,2)
  for(let i=0;i<24;i++){const xx=X-350+i*30;line(xx,840,xx,737,gold,3,.8);if(i<23)path(`M${xx} 745q15 12 30 0v85q-15 8 -30 0Z`,p[1],gold,.6)}
  rect(X-65,790,125,50,p[2],gold,1);lamp(X,786,.55)
 }
 if(s.id==='song-of-solomon'){
  // Low masonry encircles the garden without covering its tree canopy.
  path(`M${X-430} 975V755L${X-260} 680V745L${X-390} 810V975Z`,'url(#stone)',gold,1.1)
  path(`M${X+350} 975V760L${X+260} 690V750L${X+300} 805V975Z`,'url(#stone)',gold,1.1)
  rect(X-430,890,290,105,'url(#stone)',gold,1);bricks(X-430,890,290,105)
  rect(X+50,890,300,105,'url(#stone)',gold,1);bricks(X+50,890,300,105)
  for(const xx of [X-145,X+45]){rect(xx,840,28,155,p[2],gold,1);rect(xx-5,835,38,10,p[3],gold,1)}
  for(let i=0;i<9;i++)line(X-112+i*18,872,X-112+i*18,986,gold,2,.8)
  line(X-115,886,X+42,886,gold,3,.9);line(X-115,958,X+42,958,gold,3,.9)
 }
 if(s.id==='judges'){vessel(X-210,935,.6);vessel(X-80,940,.7);lamp(X-190,810,.65);lamp(X-60,812,.65)}
 if(s.id==='hebrews')for(const dir of [-1,1]){path(`M${X+dir*70} 425Q${X+dir*40} 530 ${X+dir*92} 682L${X+dir*12} 682Q${X+dir*55} 520 ${X+dir*20} 425Z`,p[3],gold,1,.85);for(let i=0;i<9;i++)path(`M${X+dir*(24+i*4)} 430Q${X+dir*(60-i)} 560 ${X+dir*(16+i*7)} 677`,'none',ink,.8,.4)}
 if(s.id==='philemon')for(const xx of [X-200,X+220]){rect(xx-44,855,88,16,p[2],gold,1);line(xx-32,871,xx-45,955,gold,7,.8);line(xx+32,871,xx+45,955,gold,7,.8)}
 if(s.id==='revelation'){for(let i=0;i<12;i++){let xx=660+i*52,yy=H+30;building(xx,yy-78-rand()*40,47,100); } }
 if(s.id==='2-peter'){path(`M${s.sunX} 260l5 24 20 5-20 5-5 24-5-24-20-5 20-5Z`,bright,'none');circle(s.sunX,289,85,'url(#light)')}
 if(s.detail==='scroll'){path(`M${X-170} 774q-18 -15 -6 -38h150q-12 15 -4 33Z`,p[3],gold,.8);path(`M${X-176} 736q16 -10 15 16q-9 13 -16 0M${X-24} 736q-12 -10 -10 16q7 10 15 0`,'none',bright,1)}
 if(s.id==='galatians'){for(let i=0;i<8;i++)parts.push(`<ellipse cx="${X-180+i*12}" cy="${960+Math.sin(i)*5}" rx="10" ry="5" fill="none" stroke="${gold}" stroke-width="2"/>`)}
 if(['haggai','ezra','nehemiah'].includes(s.id)){for(let i=0;i<5;i++){let xx=X-270+i*125;line(xx,900,xx,480,gold,3,.8);line(xx,720,xx+125,585,gold,2,.7)}line(X-280,580,X+260,580,gold,4,.9);line(X-280,730,X+260,730,gold,4,.9)}
 if(s.detail==='boat')boat(X,H+180,.72)
 if(s.detail==='stones'&&s.id!=='exodus')for(let i=0;i<7;i++)stone(750+i*70,900+rand()*45,40+rand()*35,45+rand()*55)
 if(s.detail==='flowers'&&!['garden','harvest','river'].includes(s.family))flowers(X-400,990)
 if(s.detail==='lamp'&&!['interior','temple'].includes(s.family))lamp(X+180,938,.72)
 if(s.detail==='vessel'&&s.family!=='interior')vessel(X+100,960,1)
 if(['olive','vine'].includes(s.detail)&&!['garden','harvest','river','tomb','temple','gate'].includes(s.family))tree(1470,1000,.8,s.detail==='vine')
 // Very fine edge engraving around foreground leaves / rocks, not a UI border.
 parts.push('</svg>');return parts.join('')
}
await mkdir(new URL('public/art/scripture/',root),{recursive:true});const manifest=[]
for(const book of books){const d=directions.find(d=>d.id===book.id);if(!d||!palettes[d.palette])throw Error('Invalid direction');const seed=createHash('sha256').update(book.id).digest().readUInt32LE(0);const svg=optimize(render(d,seed),{multipass:true,plugins:[{name:'preset-default'},{name:'cleanupNumericValues',params:{floatPrecision:2}},{name:'convertPathData',params:{floatPrecision:2}}]}).data;await writeFile(new URL(`public/art/scripture/${book.id}.svg`,root),svg);manifest.push({...book,bookTitle:book.title,...subjects[book.id],family:editorial[book.id]?.family??d.family,palette:d.palette,weather:d.weather,horizon:d.horizon,file:`${book.id}.svg`,bytes:Buffer.byteLength(svg),sha256:createHash('sha256').update(svg).digest('hex')})}
await writeFile(new URL('docs/art/manifest.json',root),JSON.stringify(manifest,null,2));await writeFile(new URL('src/art/catalog.json',root),JSON.stringify(manifest.map(({id,bookTitle,title,file,family,palette,weather,horizon})=>({id,bookTitle,title,file,family,palette,weather,horizon})),null,2));console.log(`Rendered ${manifest.length} deterministic illustrations; ${Math.round(manifest.reduce((n,a)=>n+a.bytes,0)/1024)} KB total SVG.`)

const passageManifest=[]
if(passageDirections.length!==12||new Set(passageDirections.map(s=>s.id)).size!==12)throw Error('Expected 12 distinct passage scenes')
for(const scene of passageDirections){
 if(!families.includes(scene.family)||!palettes[scene.palette]||!Number.isFinite(scene.horizon)||scene.horizon<430||scene.horizon>650)throw Error('Invalid passage direction')
 const seed=createHash('sha256').update(scene.id).digest().readUInt32LE(0)
 const svg=optimize(render(scene,seed),{multipass:true,plugins:[{name:'preset-default'},{name:'cleanupNumericValues',params:{floatPrecision:2}},{name:'convertPathData',params:{floatPrecision:2}}]}).data
 const bytes=Buffer.byteLength(svg);if(bytes>=350000)throw Error(`Passage artwork exceeds budget: ${scene.id}`)
 await writeFile(new URL(`public/art/scripture/${scene.id}.svg`,root),svg)
 const {id,ref,bookTitle,title,family,palette,weather,horizon}=scene
 passageManifest.push({id,ref,bookTitle,title,family,palette,weather,horizon,file:`${id}.svg`,bytes,sha256:createHash('sha256').update(svg).digest('hex')})
}
await writeFile(new URL('docs/art/passage-manifest.json',root),JSON.stringify(passageManifest,null,2))
await writeFile(new URL('src/art/passage-art.json',root),JSON.stringify(passageManifest.map(({bytes,sha256,...art})=>art),null,2))
console.log(`Rendered ${passageManifest.length} passage illustrations; ${Math.round(passageManifest.reduce((n,a)=>n+a.bytes,0)/1024)} KB additional SVG.`)
