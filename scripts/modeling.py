"""Original mesh-authoring helpers and a small uncompressed, Y-up GLB exporter.
No network assets, compression decoders, or external textures are required.
"""
import bpy, math, json, struct
from mathutils import Vector

def wipe():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for pool in (bpy.data.meshes,bpy.data.curves,bpy.data.materials):
        for item in list(pool):
            if item.users == 0: pool.remove(item)

def mat(name, color, rough=.7, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    return m

def parent(o,p):
    if p:
        world=o.matrix_world.copy(); o.parent=p; o.matrix_world=world
    return o

def joint(name, at, host=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=at
    bpy.context.view_layer.update(); parent(o,host); return o

def surface(name, verts, faces, material, host=None):
    m=bpy.data.meshes.new(name); m.from_pydata(verts,[],faces); m.update()
    o=bpy.data.objects.new(name,m); bpy.context.collection.objects.link(o); m.materials.append(material)
    for p in m.polygons: p.use_smooth=True
    return parent(o,host)

def ellipsoid(name, at, scale, material, host=None, seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=at)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth=True
    bpy.context.view_layer.update(); return parent(o,host)

def tube(name, points, radii, material, host=None, sides=12):
    vs=[]; fs=[]
    for i,p in enumerate(points):
        p=Vector(p); tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        tangent.normalize(); ref=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))
        n=tangent.cross(ref).normalized(); b=tangent.cross(n).normalized()
        r=radii[i] if isinstance(radii,list) else radii
        for j in range(sides):
            a=j*math.tau/sides; vs.append(tuple(p+r*(n*math.cos(a)+b*math.sin(a))))
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides; fs.append((a,b,b+sides,a+sides))
    fs.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))])
    return surface(name,vs,fs,material,host)

def loft(name, rings, material, host=None, segments=64, folds=0):
    # rings are z, x-radius, y-radius, center-x, center-y
    vs=[]; fs=[]
    for k,(z,rx,ry,cx,cy) in enumerate(rings):
        for j in range(segments):
            a=math.tau*j/segments
            f=1+folds*(.7*math.sin(a*11+z*1.5)+.3*math.sin(a*19-z*4))
            vs.append((cx+math.cos(a)*rx*f,cy+math.sin(a)*ry*f,z))
    for k in range(len(rings)-1):
        for j in range(segments):
            a=k*segments+j; b=k*segments+(j+1)%segments; fs.append((a,b,b+segments,a+segments))
    fs.extend([tuple(reversed(range(segments))),tuple((len(rings)-1)*segments+j for j in range(segments))])
    return surface(name,vs,fs,material,host)

def fuse(objects, name, material, host, voxel=.004):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); o=bpy.context.object
    o.name=name; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    m=o.modifiers.new('Sculpt union','REMESH');m.mode='VOXEL';m.voxel_size=voxel
    bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('Sculpt smoothing','SMOOTH');m.factor=1.1;m.iterations=5
    bpy.ops.object.modifier_apply(modifier=m.name)
    for p in o.data.polygons:p.use_smooth=True
    o.data.materials.clear();o.data.materials.append(material)
    return parent(o,host)

def batch_details():
    # Consolidate static surface detail while retaining named rig and facial parts.
    groups={}
    keep={'Robe','Sash','Neck','LEye','REye','LEar','REar'}
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH' or o.name in keep or o.children: continue
        key=(o.parent.name if o.parent else '',o.data.materials[0].name if o.data.materials else '')
        groups.setdefault(key,[]).append(o)
    for objects in groups.values():
        if len(objects)<2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()

def export_glb(path):
    # Bake mesh transforms to local joint coordinates. Runtime bones are ordinary
    # glTF nodes with identity rest rotations and a consistent Y-up coordinate frame.
    batch_details()
    bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get()
    objects=[o for o in bpy.context.scene.objects if o.type in {'EMPTY','MESH','CURVE'}]
    ids={o.name:i for i,o in enumerate(objects)}; nodes=[]; meshes=[]; mats=[]; mid={}; views=[]; acc=[]; binary=bytearray()
    def conv(v):return (float(v[0]),float(v[2]),float(-v[1]))
    def anchor(o): return o.matrix_world.translation if o and o.type=='EMPTY' else anchor(o.parent) if o else Vector((0,0,0))
    def attribute(values,dim,typ='VEC3',component=5126,normalized=False):
        while len(binary)%4:binary.append(0)
        offset=len(binary);flat=[v for row in values for v in row] if dim>1 else values
        format_code={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}[component]
        binary.extend(struct.pack('<'+format_code*len(flat),*flat))
        views.append({'buffer':0,'byteOffset':offset,'byteLength':len(binary)-offset})
        a={'bufferView':len(views)-1,'componentType':component,'count':len(values),'type':typ}
        if normalized:a['normalized']=True
        if typ=='VEC3' and component==5126:a.update(min=[min(v[i] for v in values) for i in range(3)],max=[max(v[i] for v in values) for i in range(3)])
        acc.append(a);return len(acc)-1
    for o in objects:
        a=anchor(o); pa=anchor(o.parent); node={'name':o.name,'translation':conv(a-pa)}
        children=[ids[c.name] for c in o.children if c.name in ids]
        if children:node['children']=children
        if o.type in {'MESH','CURVE'}:
            ev=o.evaluated_get(deps); m=ev.to_mesh();m.calc_loop_triangles();matrix=o.matrix_world;nm=matrix.to_3x3().inverted().transposed()
            positions=[]; normals=[];indices=[]; cache={}
            for tri in m.loop_triangles:
                for vi in tri.vertices:
                    v=m.vertices[vi];normal=v.normal if m.polygons[tri.polygon_index].use_smooth else tri.normal
                    n=conv((nm@normal).normalized());key=(vi,tuple(round(x,6) for x in n))
                    if key not in cache:
                        cache[key]=len(positions);positions.append(conv(matrix@v.co-a));normals.append(n)
                    indices.append(cache[key])
            if positions:
                material=o.data.materials[0] if o.data.materials else None
                if material and material.name not in mid:
                    p=material.node_tree.nodes.get('Principled BSDF');mid[material.name]=len(mats)
                    mats.append({'name':material.name,'pbrMetallicRoughness':{'baseColorFactor':list(p.inputs['Base Color'].default_value),'roughnessFactor':p.inputs['Roughness'].default_value,'metallicFactor':p.inputs['Metallic'].default_value},'doubleSided':True})
                packed_normals=[tuple(max(-127,min(127,round(value*127))) for value in normal) for normal in normals]
                index_component=5123 if max(indices)<65536 else 5125
                prim={'attributes':{'POSITION':attribute(positions,3),'NORMAL':attribute(packed_normals,3,'VEC3',5120,True)},'indices':attribute(indices,1,'SCALAR',index_component)}
                if material:prim['material']=mid[material.name]
                meshes.append({'name':o.name,'primitives':[prim]});node['mesh']=len(meshes)-1
            ev.to_mesh_clear()
        nodes.append(node)
    doc={'asset':{'version':'2.0','generator':'He Lives original Blender mesh pipeline'},'scene':0,'scenes':[{'nodes':[ids[o.name] for o in objects if not o.parent]}],'nodes':nodes,'meshes':meshes,'materials':mats,'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':acc}
    raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);binary+=b'\0'*((-len(binary))%4)
    data=struct.pack('<III',0x46546c67,2,12+8+len(raw)+8+len(binary))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(binary),0x004e4942)+binary
    path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);print(f'EXPORTED {path.name}: {len(data):,} bytes')
