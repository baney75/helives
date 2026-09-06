"""Render authored Blender sources with consistent studio light for inspection."""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
for role in ['man','woman','bird','fish']:
    bpy.ops.wm.open_mainfile(filepath=str(root/'demo/models-v2/sources'/f'{role}-sculpt.blend'))
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.render.resolution_x=600;scene.render.resolution_y=800 if role in ['man','woman'] else 500;scene.render.resolution_percentage=100
    scene.world.color=(.13,.13,.13)
    target=Vector((0,0,.66 if role in ['man','woman'] else 0))
    bpy.ops.object.camera_add(location=(1.4,3.3,1.4) if role in ['man','woman'] else (1.8,2.4,1.4))
    camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.55 if role in ['man','woman'] else 1.95;scene.camera=camera
    for at,power,size,color in [((2,3,4),500,3,(1,.85,.64)),((-2,1,2),300,2,(.65,.77,1)),((0,-2,3),600,2,(1,.78,.5))]:
        bpy.ops.object.light_add(type='AREA',location=at);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.data.color=color;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(root/'demo/models-v2'/f'{role}-studio.png');bpy.ops.render.render(write_still=True)
