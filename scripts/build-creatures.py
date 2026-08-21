#!/usr/bin/env python3
"""Build authored, articulated hero fish and bird GLBs for Genesis Day 5."""
from __future__ import annotations

import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "models" / "genesis"


def wipe() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for group in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for item in list(group):
            group.remove(item)


def mat(name: str, color: tuple[float, float, float], roughness: float = 0.48, metallic: float = 0.0):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.use_nodes = True
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return value


def empty(name: str, location=(0.0, 0.0, 0.0)):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=location)
    obj = bpy.context.object
    obj.name = name
    return obj


def parent(child, host) -> None:
    child.parent = host
    child.matrix_parent_inverse = host.matrix_world.inverted()


def sphere(name: str, location, scale, material, host):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    parent(obj, host)
    return obj


def cone(name: str, location, scale, rotation, material, host, vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=1.0, radius2=0.0, depth=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    parent(obj, host)
    return obj


def fin(name: str, points, thickness: float, material, host):
    front = [(x, y - thickness, z) for x, y, z in points]
    back = [(x, y + thickness, z) for x, y, z in points]
    vertices = front + back
    faces = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    data = bpy.data.meshes.new(f"{name}Mesh")
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new(name="SoftFinEdges", type="BEVEL")
    bevel.width = 0.008
    bevel.segments = 2
    parent(obj, host)
    return obj


def line(name: str, points, thickness: float, material, host):
    data = bpy.data.curves.new(f"{name}Curve", type="CURVE")
    data.dimensions = "3D"
    data.resolution_u = 2
    data.bevel_depth = thickness
    data.bevel_resolution = 2
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coords in zip(spline.bezier_points, points):
        point.co = coords
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    parent(obj, host)
    return obj


def build_fish() -> None:
    body_mat = mat("FishBody", (0.20, 0.43, 0.51), 0.32, 0.04)
    belly_mat = mat("FishBelly", (0.56, 0.70, 0.70), 0.4)
    fin_mat = mat("FishFins", (0.55, 0.36, 0.20), 0.44)
    eye_mat = mat("FishEye", (0.03, 0.025, 0.02), 0.18)
    gold_mat = mat("FishIris", (0.88, 0.61, 0.20), 0.3, 0.08)

    root = empty("Root")
    sphere("Body", (0, 0, 0), (0.52, 0.17, 0.16), body_mat, root)
    sphere("Belly", (0.08, 0, -0.055), (0.42, 0.172, 0.10), belly_mat, root)
    sphere("Head", (0.35, 0, 0.015), (0.25, 0.16, 0.15), body_mat, root)

    tail = empty("Tail", (-0.5, 0, 0))
    parent(tail, root)
    fin("TailUpper", [(-0.51, 0, 0), (-0.82, 0, 0.29), (-0.75, 0, 0)], 0.018, fin_mat, tail)
    fin("TailLower", [(-0.51, 0, 0), (-0.82, 0, -0.27), (-0.75, 0, 0)], 0.018, fin_mat, tail)
    fin("DorsalFin", [(-0.18, 0, 0.12), (0.04, 0, 0.34), (0.22, 0, 0.12)], 0.016, fin_mat, root)
    for side in (-1, 1):
        fin(f"Pectoral{side}", [(0.16, side * 0.13, 0), (-0.08, side * 0.34, -0.08), (-0.02, side * 0.13, -0.02)], 0.01, fin_mat, root)
        sphere(f"Eye{side}", (0.45, side * 0.142, 0.07), (0.035, 0.018, 0.035), gold_mat, root)
        sphere(f"Pupil{side}", (0.462, side * 0.158, 0.071), (0.016, 0.008, 0.018), eye_mat, root)
        line(f"Gill{side}", [(0.19, side * 0.169, -0.08), (0.27, side * 0.173, -0.025), (0.29, side * 0.173, 0.055), (0.23, side * 0.169, 0.12)], 0.007, eye_mat, root)
        line(f"LateralLine{side}", [(-0.35, side * 0.165, 0.015), (-0.05, side * 0.174, 0.02), (0.18, side * 0.168, 0.025)], 0.004, fin_mat, root)
    fin("Mouth", [(0.56, -0.08, -0.03), (0.59, 0, -0.01), (0.56, 0.08, -0.03)], 0.006, eye_mat, root)


def build_bird() -> None:
    feather = mat("BirdFeather", (0.66, 0.58, 0.46), 0.68)
    light = mat("BirdLight", (0.86, 0.82, 0.70), 0.72)
    dark = mat("BirdDark", (0.18, 0.17, 0.16), 0.64)
    beak = mat("BirdBeak", (0.82, 0.51, 0.16), 0.52)

    root = empty("Root")
    sphere("Body", (0, 0, 0), (0.34, 0.13, 0.15), feather, root)
    sphere("Breast", (0.14, 0, -0.04), (0.23, 0.132, 0.12), light, root)
    sphere("Head", (0.31, 0, 0.08), (0.13, 0.12, 0.13), light, root)
    cone("Beak", (0.47, 0, 0.075), (0.065, 0.055, 0.17), (0, math.pi / 2, 0), beak, root)
    for side in (-1, 1):
        sphere(f"Eye{side}", (0.355, side * 0.111, 0.12), (0.018, 0.01, 0.018), dark, root)

    for side, name in ((1, "LeftWing"), (-1, "RightWing")):
        wing = empty(name, (0.02, side * 0.1, 0.05))
        parent(wing, root)
        fin(f"{name}Surface", [(0.12, side * 0.11, 0.06), (0.02, side * 0.82, 0.12), (-0.36, side * 0.62, 0.0)], 0.018, feather, wing)
        for index in range(3):
            line(
                f"{name}FeatherLine{index}",
                [(-0.03 - index * 0.06, side * 0.15, 0.07 - index * 0.02), (-0.09 - index * 0.07, side * (0.62 - index * 0.04), 0.06 - index * 0.02)],
                0.008,
                dark,
                wing,
            )

    for index, y in enumerate((-0.07, 0.0, 0.07)):
        feather_obj = sphere(f"TailFeather{index}", (-0.38 - index * 0.03, y, 0.02), (0.23, 0.045, 0.035), feather, root)
        feather_obj.rotation_euler.z = math.pi * 0.02 * (index - 1)


def export(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_yup=True, export_apply=True)
    print(f"wrote {path} ({path.stat().st_size} bytes)")


for creature, builder in (("fish", build_fish), ("bird", build_bird)):
    wipe()
    builder()
    export(OUT / f"{creature}.glb")
