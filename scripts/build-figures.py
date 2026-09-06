#!/usr/bin/env python3
"""Authored sculpted figures: connected arm joints, shaped faces, hair and folded linen."""
import sys, math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from modeling import *
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/genesis'
WORK=ROOT/'demo/models-v2/sources'

def person(role):
    man=role=='man'; scale=1
    skin=mat(role+' warm skin',(.47,.275,.16) if man else (.58,.355,.23),.64)
    linen=mat(role+' woven linen',(.48,.40,.29) if man else (.69,.60,.45),.98)
    trim=mat(role+' linen seam',(.32,.25,.16) if man else (.47,.38,.26),.96)
    hair=mat(role+' hair',(.048,.027,.016),.85)
    hairlight=mat(role+' hair strands',(.075,.045,.026),.88)
    lip=mat(role+' lips',(.31,.13,.085),.7)
    eye=mat(role+' eye',(.036,.023,.014),.24)
    sclera=mat(role+' sclera',(.57,.49,.37),.55)
    root=joint('Root',(0,0,0))
    # Continuous cloth follows the waist, shoulder slope and neckline. Fine folds
    # are part of the silhouette, with no stuck-on rectangular strips.
    profile=[(.12,.135,.085),(.18,.149,.088),(.35,.144,.083),(.50,.13,.08),(.68,.108,.069),(.78,.10,.066),(.86,.14,.075),(.94,.151 if man else .139,.080),(.975,.129,.065),(.999,.085,.051),(1.025,.044,.039)]
    rings=[]
    for k in range(len(profile)-1):
        a,b=profile[k],profile[k+1]
        for j in range(5):
            t=j/5;z=a[0]*(1-t)+b[0]*t
            previous=profile[max(0,k-1)];following=profile[min(len(profile)-1,k+2)]
            def curve(index):
                p0,p1,p2,p3=previous[index],a[index],b[index],following[index]
                return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
            rings.append((z*scale,curve(1)*scale,curve(2)*scale,0,.003*math.sin(z*5)))
    a=profile[-1];rings.append((a[0]*scale,a[1]*scale,a[2]*scale,0,0))
    loft('Robe',rings,linen,root,segments=64,folds=.035)
    # Belt and a draped end in the same cloth language.
    belt=[]
    for i in range(65):
        t=i*math.tau/64;belt.append((.111*scale*math.cos(t),.072*scale*math.sin(t),(.755+.008*math.sin(t))*scale))
    tube('Sash',belt,.008*scale,trim,root,sides=8)
    tube('BeltTie',[(.025,.08,.755),(.03,.088,.70),(.045,.086,.61),(.031,.08,.55)],.007,trim,root,sides=8)
    neck=ellipsoid('Neck',(0,0,1.028*scale),(.042,.039,.072),skin,root)
    head=joint('Head',(0,.0,1.052*scale),root)
    # Fused cranium, cheekbones, jaw and nose, with restrained adult proportions.
    def S(name,at,sz):return ellipsoid(name,tuple(v*scale for v in at),tuple(v*scale for v in sz),skin,seg=32,rings=24)
    parts=[S('Cranium',(0,.0,1.124),(.073,.068,.093)),S('Jaw',(0,.013,1.087),(.054,.053,.052)),S('Chin',(0,.041,1.065),(.029,.029,.020)),S('NoseBridge',(0,.059,1.119),(.009,.019,.030)),S('NoseTip',(0,.075,1.102),(.011,.013,.010))]
    for side in [-1,1]:
        parts += [S('Cheek',(side*.035,.030,1.108),(.024,.019,.024))]
    fuse(parts,'Face',skin,head,.0025*scale)
    for side,code in [(-1,'L'),(1,'R')]:
        ellipsoid(code+'Ear',(side*.071*scale,0,1.117*scale),(.010,.018,.026),skin,head,24,16)
        ellipsoid(code+'EarInner',(side*.078*scale,.006,1.117*scale),(.003,.010,.016),lip,head,16,12)
        ellipsoid(code+'Eye',(side*.027*scale,.058*scale,1.135*scale),(.011,.006,.004),sclera,head,24,12)
        ellipsoid(code+'Iris',(side*.027*scale,.063*scale,1.135*scale),(.004,.002,.004),eye,head,20,12)
        tube(code+'UpperLid',[(side*.016,.061,1.135),(side*.027,.065,1.139),(side*.038,.056,1.135)],.0025,skin,head,8)
        tube(code+'Brow',[(side*.013,.063,1.151),(side*.028,.063,1.154),(side*.045,.051,1.148)],.003,hair,head,8)
    tube('UpperLip',[(-.024,.058,1.080),(-.009,.069,1.082),(0,.067,1.08),(.01,.069,1.082),(.024,.058,1.080)],.003,lip,head,8)
    tube('LowerLip',[(-.02,.059,1.076),(0,.069,1.075),(.02,.059,1.076)],.0035,lip,head,8)
    # Hair cap follows the skull above the hairline, leaving the forehead visible.
    vs=[];fs=[]
    for k in range(15):
        for j in range(48):
            a=j*math.tau/48; end=1.12+.68*(1-math.sin(a))/2;ph=.02+(end-.02)*k/14
            r=1+.028*math.sin(a*15+ph*7)
            vs.append((.077*math.cos(a)*math.sin(ph)*r,-.004+.074*math.sin(a)*math.sin(ph)*r,1.127+.092*math.cos(ph)*r))
    for k in range(14):
        for j in range(48):
            a=k*48+j;b=k*48+(j+1)%48;fs.append((a,b,b+48,a+48))
    surface('Hair',vs,fs,hair,head)
    if man:
        # Tapered beard contour, composed of small curved locks rather than a ball.
        for i in range(27):
            a=-1.2+i*2.4/26;x=.048*math.sin(a);y=.045+.019*math.cos(a)
            tube('BeardLock'+str(i),[(x,y,1.098),(x*.91,y+.005,1.075),(x*.74,y-.001,1.046+abs(x)*.20)], [.006,.007,.0025],hairlight if i%4==0 else hair,head,6)
    else:
        for i in range(30):
            a=math.pi+.10+i*(math.pi-.20)/29;x=.072*math.cos(a);y=.066*math.sin(a)
            tube('HairLock'+str(i),[(x,y,1.165),(x*1.10,y-.012,1.102),(x*1.03+.004*math.sin(i),y-.025,1.022),(x*.83,y-.019,.956)], [.014,.013,.012,.002],hairlight if i%5==0 else hair,head,8)
    # Long sleeves and connected parent-child limbs. Hands move with wrists.
    for side,code in [(-1,'L'),(1,'R')]:
        x=side*(.155 if man else .14)*scale; shoulder=(x,0,.958*scale)
        upper=joint(code+'UpperArm',shoulder,root)
        elbow=(x,.0,.769*scale); fore=joint(code+'Forearm',elbow,upper)
        wrist=(x,0,.590*scale); hand=joint(code+'Hand',wrist,fore)
        sleeveRings=[(.985*scale,.004,.004,x,0),(.978*scale,.021,.022,x,0),(.963*scale,.037,.036,x,0)]
        for i in range(16):
            t=i/15;z=(.950-.191*t)*scale;r=(.043*(1-t)+.034*t+.003*math.sin(t*math.pi))*scale
            sleeveRings.append((z,r,r*.88,x,0))
        loft(code+'Sleeve',sleeveRings,linen,upper,segments=32,folds=.028)
        tube(code+'ArmSkin',[elbow,(x,.006,.70*scale),wrist],[.030,.031,.020],skin,fore,16)
        ellipsoid(code+'Palm',(x,.003,.570*scale),(.023,.014,.033),skin,hand,24,16)
        for f in range(4):
            xx=x+(f-1.5)*.009;z=.548*scale
            tube(code+'Finger'+str(f),[(xx,.002,z),(xx,.009,z-.024),(xx,.014,z-.032+abs(f-1.5)*.004)],[.0055,.0045,.0025],skin,hand,8)
        tube(code+'Thumb',[(x-side*.023,.0,.585*scale),(x-side*.033,.017,.568*scale),(x-side*.029,.022,.553*scale)],[.007,.006,.003],skin,hand,10)
        leg=joint(code+'LowerLeg',(side*.065,0,.37*scale),root)
        ellipsoid(code+'Knee',(side*.065,0,.37*scale),(.035,.034,.04),skin,leg)
        tube(code+'Shin',[(side*.065,0,.37*scale),(side*.065,0,.22*scale),(side*.065,0,.05*scale)],[.036,.032,.024],skin,leg,16)
        foot=joint(code+'Foot',(side*.065,0,.055*scale),leg)
        ellipsoid(code+'FootSkin',(side*.065,.031,.029),(.032,.069,.026),skin,foot)
        for toe in range(5):
            ellipsoid(code+'Toe'+str(toe),(side*.065+(toe-2)*.011,.088,.023),(.007,.017-abs(toe-1)*.002,.009),skin,foot,12,8)
    return root

if __name__=='__main__':
    WORK.mkdir(parents=True,exist_ok=True)
    for role in ['man','woman']:
        wipe();person(role);bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(role+'-sculpt.blend')))
        export_glb(OUT/(role+'.glb'))
