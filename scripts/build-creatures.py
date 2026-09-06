#!/usr/bin/env python3
"""Original articulated fish and feathered dove, built as actual meshes."""
import sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from modeling import *
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/models/genesis';WORK=ROOT/'demo/models-v2/sources'

def fin(name,origin,edge,material,host):
    vs=[origin];fs=[]
    for i,p in enumerate(edge):
        vs.append(p)
        if i:fs.append((0,i,i+1))
    return surface(name,vs,fs,material,host)

def feather(name,start,end,width,material,host):
    a=Vector(start);b=Vector(end);d=b-a; side=d.cross(Vector((0,0,1))).normalized();vs=[];fs=[]
    for i in range(17):
        t=i/16;c=a+d*t;c.z+=.025*math.sin(t*math.pi)
        w=width*(math.sin(math.pi*t)**.65)
        for j in [-1,0,1]:
            v=c+side*w*j;v.z-=abs(j)*.007;vs.append(tuple(v))
    for i in range(16):
        for j in range(2):
            a0=i*3+j;fs.append((a0,a0+1,a0+4,a0+3))
    return surface(name,vs,fs,material,host)

def build_fish():
    root=joint('Root',(0,0,0));bodymat=mat('Fish silver olive',(.28,.40,.36),.31,.28)
    belly=mat('Fish pearl belly',(.63,.66,.51),.38,.16);fins=mat('Fish bronze translucent fins',(.36,.28,.15),.48,.05)
    scaleMat=mat('Fish scale edges',(.40,.48,.35),.37,.2);dark=mat('Fish eye black',(.009,.014,.012),.14);iris=mat('Fish iris amber',(.52,.38,.12),.3,.18)
    # Smooth streamlined single body, pinched at the tail rather than intersecting balls.
    vs=[];fs=[];n=48;m=32
    def radius(t):return max(.015,(math.sin(math.pi*t)**.85)*(.19-.045*t))
    for i in range(n+1):
        t=i/n;x=-.50+t*1.10;r=radius(t)
        for j in range(m):
            a=j*math.tau/m;vs.append((x,r*.82*math.cos(a),r*math.sin(a)))
    for i in range(n):
        for j in range(m):
            a=i*m+j;b=i*m+(j+1)%m;fs.append((a,b,b+m,a+m))
    surface('Body',vs,fs,bodymat,root)
    # Hundreds of overlapping scale outlines collected into one mesh.
    vs=[];fs=[]
    for row in range(22):
        t=.12+row*.033;x=-.5+t*1.10;r=radius(t)
        for col in range(24):
            a=(col+(row%2)*.5)*math.tau/24
            n0=len(vs)
            for k in range(7):
                q=-math.pi/2+k*math.pi/6;xx=x+.020*math.cos(q);aa=a+.090*math.sin(q)
                vs.extend([(xx,(r+.001)*.82*math.cos(aa),(r+.001)*math.sin(aa)),(xx-.0015,(r+.0018)*.82*math.cos(aa),(r+.0018)*math.sin(aa))])
            for k in range(6):a0=n0+k*2;fs.append((a0,a0+1,a0+3,a0+2))
    surface('Scales',vs,fs,scaleMat,root)
    tail=joint('Tail',(-.48,0,0),root)
    edge=[(-.52,0,0),(-.80,0,.25),(-.77,0,.16),(-.70,0,.06),(-.67,0,0),(-.70,0,-.06),(-.77,0,-.16),(-.80,0,-.25),(-.52,0,0)]
    fin('ForkedTail',(-.49,0,0),edge,fins,tail)
    for i in range(15):
        a=-1+i/7;end=(-.70-.10*abs(a),0,.24*a)
        tube('TailRay'+str(i),[(-.49,0,0),(-.6,0,.10*a),end],[.0025,.002,.0008],scaleMat,tail,5)
    fin('DorsalFin',(-.20,0,.11),[(-.31,0,.1),(-.27,0,.28),(-.16,0,.32),(.02,0,.29),(.18,0,.15)],fins,root)
    for i in range(11):
        x=-.27+i*.039;tube('DorsalRay'+str(i),[(x,0,.13),(x-.035,0,.28-max(0,x)*.5)],[.002,.0008],scaleMat,root,5)
    for side in [-1,1]:
        fin('Pectoral'+str(side),(.21,side*.12,.01),[(.18,side*.12,.01),(-.03,side*.34,-.10),(.0,side*.15,-.06)],fins,root)
        ellipsoid('Eye'+str(side),(.43,side*.091,.045),(.026,.012,.026),iris,root)
        ellipsoid('Pupil'+str(side),(.437,side*.100,.047),(.013,.007,.014),dark,root)
        tube('Gill'+str(side),[(.31,side*.116,.09),(.35,side*.126,.03),(.34,side*.122,-.055),(.28,side*.100,-.11)],.0035,scaleMat,root,8)
    tube('Mouth',[(.588,-.023,-.01),(.603,0,-.016),(.588,.023,-.01)],.004,dark,root)

def build_bird():
    root=joint('Root',(0,0,0));ivory=mat('Dove warm ivory',(.74,.69,.57),.82)
    soft=mat('Dove soft coverts',(.57,.55,.45),.88);tips=mat('Dove flight feathers',(.34,.34,.29),.84)
    beak=mat('Dove beak',(.28,.22,.14),.6);eye=mat('Dove eyes',(.008,.009,.008),.16)
    fuse([ellipsoid('BodyBase',(0,0,0),(.29,.105,.125),ivory),ellipsoid('NeckBase',(.22,0,.05),(.14,.09,.115),ivory),ellipsoid('HeadBase',(.33,0,.10),(.102,.08,.091),ivory)],'Body',ivory,root,.006)
    tube('Beak',[(.408,0,.08),(.46,0,.071),(.477,0,.062)],[.025,.013,.0015],beak,root,16)
    for side in [-1,1]:
        ellipsoid('Eye'+str(side),(.365,side*.073,.127),(.012,.006,.013),eye,root,20,12)
    for side,name in [(1,'LeftWing'),(-1,'RightWing')]:
        wing=joint(name,(.03,side*.08,.04),root)
        # Individual curved primaries give a tapered, scalloped silhouette.
        for i in range(12):
            t=i/11
            start=(.10-.25*t,side*(.10+.16*t),.035)
            end=(-.03-.43*t,side*(.58+.29*math.sin(t*math.pi*.8)),.085-.045*t)
            feather(name+'Primary'+str(i),start,end,.045 if i<9 else .04,ivory if i<3 else tips,wing)
        for row in range(3):
            for i in range(9):
                t=i/8
                start=(.13-.28*t,side*(.09+.075*row),.062+.008*row)
                end=(.05-.36*t,side*(.27+.09*row+.13*math.sin(t*math.pi)),.084)
                feather(name+'Covert'+str(row)+'-'+str(i),start,end,.034,ivory if row==0 else soft,wing)
    for i in range(9):
        a=(i-4)*.08
        feather('TailFeather'+str(i),(-.22,a*.15,-.015),(-.61+abs(a)*.14,a*.55,-.035),.036,ivory if i%2 else soft,root)
    # Tucked feet remain subtle beneath the tail.
    feet=mat('Dove feet',(.33,.18,.12),.8)
    for side in [-1,1]:
        tube('Leg'+str(side),[(-.08,side*.07,-.085),(-.18,side*.065,-.13),(-.25,side*.065,-.11)],[.012,.008,.005],feet,root,8)
        for i in range(3):tube('Toe'+str(side)+'-'+str(i),[(-.24,side*.065,-.11),(-.30,side*.065+(i-1)*.012,-.10)],[.004,.001],feet,root,6)

if __name__=='__main__':
    for name,build in [('fish',build_fish),('bird',build_bird)]:
        wipe();build();bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(name+'-sculpt.blend')));export_glb(OUT/(name+'.glb'))
