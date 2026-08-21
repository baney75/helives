#!/usr/bin/env python3
"""Render six acceptance angles for every shipped Genesis hero model GLB."""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "demo" / "model-acceptance"
ANGLES = (0, 60, 120, 180, 240, 300)


def wipe() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def look_at(camera: bpy.types.Object, point: Vector) -> None:
    camera.rotation_euler = (point - camera.location).to_track_quat("-Z", "Y").to_euler()


def render_role(role: str) -> None:
    wipe()
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "public" / "models" / "genesis" / f"{role}.glb"))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    low = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    high = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    center = (low + high) * 0.5
    height = high.z - low.z
    extent = max(high.x - low.x, high.y - low.y, height)

    bpy.ops.object.camera_add()
    camera = bpy.context.active_object
    assert camera is not None
    camera.data.lens = 58
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(2.4, -2.8, high.z + 1.5))
    key = bpy.context.active_object
    key.data.energy = 900
    key.data.shape = "DISK"
    key.data.size = 2.4
    bpy.ops.object.light_add(type="AREA", location=(-2.2, 1.8, center.z + 0.8))
    fill = bpy.context.active_object
    fill.data.energy = 520
    fill.data.color = (0.78, 0.84, 1.0)
    fill.data.size = 2.0
    bpy.ops.object.light_add(type="AREA", location=(0.0, 2.2, high.z + 1.0))
    rim = bpy.context.active_object
    rim.data.energy = 700
    rim.data.color = (1.0, 0.65, 0.28)
    rim.data.size = 1.4

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 640 if role in {"man", "woman"} else 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.007, 0.005, 0.012)

    OUT.mkdir(parents=True, exist_ok=True)
    radius = max(2.15, height * 1.7) if role in {"man", "woman"} else max(1.4, extent * 2.25)
    target = Vector((center.x, center.y, low.z + height * 0.52)) if role in {"man", "woman"} else center
    for degrees in ANGLES:
        angle = math.radians(degrees)
        camera.location = (center.x + math.sin(angle) * radius, center.y - math.cos(angle) * radius, target.z + height * 0.04)
        look_at(camera, target)
        scene.render.filepath = str(OUT / f"{role}-{degrees:03d}.png")
        bpy.ops.render.render(write_still=True)


for model_role in ("man", "woman", "fish", "bird"):
    render_role(model_role)
print(f"wrote {OUT}")
