#!/usr/bin/env python3
"""Build robed man/woman GLBs. Blender Z-up; glTF export is Y-up."""
from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "models" / "genesis"


def wipe() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for item in list(block):
            block.remove(item)


def material(name: str, color: tuple[float, float, float], rough: float = 0.72) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    assert tree is not None
    bsdf = tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    return mat


def mesh(kind: str, name: str, loc: tuple[float, float, float], **kwargs) -> bpy.types.Object:
    op = {
        "uv_sphere": bpy.ops.mesh.primitive_uv_sphere_add,
        "cylinder": bpy.ops.mesh.primitive_cylinder_add,
        "cone": bpy.ops.mesh.primitive_cone_add,
        "cube": bpy.ops.mesh.primitive_cube_add,
        "torus": bpy.ops.mesh.primitive_torus_add,
    }[kind]
    op(location=loc, **kwargs)
    obj = bpy.context.active_object
    assert obj is not None
    obj.name = name
    bpy.ops.object.shade_smooth()
    return obj


def cloth_prism(
    name: str,
    z_bottom: float,
    z_top: float,
    bottom_half_width: float,
    waist_half_width: float,
    top_half_width: float,
    depth: float,
) -> bpy.types.Object:
    """A shouldered, waisted cloth mesh with shallow procedural folds."""
    z_waist = z_bottom + (z_top - z_bottom) * 0.62
    rings = [
        (z_bottom, bottom_half_width, depth * 0.62),
        (z_bottom + (z_top - z_bottom) * 0.28, bottom_half_width * 0.94, depth * 0.56),
        (z_waist, waist_half_width, depth * 0.5),
        (z_waist + (z_top - z_waist) * 0.48, waist_half_width * 1.18, depth * 0.55),
        (z_top - 0.075, top_half_width * 0.96, depth * 0.57),
        # Keep the shoulder line broad and level. A pinched final ring looked
        # passable head-on but formed two sharp fins in rear/three-quarter views.
        (z_top, top_half_width, depth * 0.58),
    ]
    segments = 18
    vertices: list[tuple[float, float, float]] = []
    for ring_index, (z, width, half_depth) in enumerate(rings):
        for segment in range(segments):
            angle = (segment / segments) * math.tau
            fold = 1.0 + math.cos(angle * 6 + ring_index * 0.35) * 0.035
            hem = 0.0
            if ring_index == 0:
                hem = math.sin(angle * 2.0 + 0.35) * 0.018 + math.sin(angle * 5.0) * 0.007
            vertices.append((math.cos(angle) * width * fold, math.sin(angle) * half_depth, z + hem))

    faces: list[tuple[int, ...]] = []
    for ring_index in range(len(rings) - 1):
        base = ring_index * segments
        above = (ring_index + 1) * segments
        for segment in range(segments):
            nxt = (segment + 1) % segments
            faces.append((base + segment, base + nxt, above + nxt, above + segment))
    faces.append(tuple(reversed(range(segments))))
    top = (len(rings) - 1) * segments
    faces.append(tuple(top + segment for segment in range(segments)))
    data = bpy.data.meshes.new(f"{name}Mesh")
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.shade_smooth()
    bevel = obj.modifiers.new(name="ClothEdgeSoftening", type="BEVEL")
    bevel.width = 0.006
    bevel.segments = 2
    return obj


def cloth_strip(name: str, top_x: float, bottom_x: float, top_z: float, bottom_z: float, width: float, y: float) -> bpy.types.Object:
    """A thin diagonal linen strip that stays on the garment instead of protruding as a slab."""
    vertices = [
        (top_x - width, y, top_z),
        (top_x + width, y, top_z),
        (bottom_x + width, y, bottom_z),
        (bottom_x - width, y, bottom_z),
    ]
    data = bpy.data.meshes.new(f"{name}Mesh")
    data.from_pydata(vertices, [], [(0, 1, 2, 3)])
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    solidify = obj.modifiers.new(name="ClothThickness", type="SOLIDIFY")
    solidify.thickness = 0.004
    bevel = obj.modifiers.new(name="SoftEdges", type="BEVEL")
    bevel.width = 0.002
    bevel.segments = 2
    return obj


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def parent(child: bpy.types.Object, host: bpy.types.Object) -> None:
    child.parent = host
    child.matrix_parent_inverse = host.matrix_world.inverted()


def empty(name: str, loc: tuple[float, float, float]) -> bpy.types.Object:
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=loc)
    obj = bpy.context.active_object
    assert obj is not None
    obj.name = name
    obj.empty_display_size = 0.04
    return obj


def limb_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
    root: bpy.types.Object,
) -> bpy.types.Object:
    """Create a Z-aligned limb in world space, then orient it between two joints."""
    a = Vector(start)
    b = Vector(end)
    delta = b - a
    obj = mesh(
        "cylinder",
        name,
        tuple((a + b) * 0.5),
        radius=radius,
        depth=delta.length,
        vertices=14,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    assign(obj, mat)
    parent(obj, root)
    return obj


def tapered_limb_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    start_radius: float,
    end_radius: float,
    mat: bpy.types.Material,
    root: bpy.types.Object,
) -> bpy.types.Object:
    a = Vector(start)
    b = Vector(end)
    delta = b - a
    obj = mesh(
        "cone",
        name,
        tuple((a + b) * 0.5),
        radius1=start_radius,
        radius2=end_radius,
        depth=delta.length,
        vertices=18,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    assign(obj, mat)
    parent(obj, root)
    return obj


def build_person(role: str) -> bpy.types.Object:
    man = role == "man"
    skin = material(f"{role}-skin", (0.58, 0.39, 0.25) if man else (0.66, 0.47, 0.31), 0.62)
    robe = material(f"{role}-robe", (0.32, 0.25, 0.16) if man else (0.48, 0.39, 0.27), 0.94)
    robe_edge = material(f"{role}-robe-edge", (0.52, 0.42, 0.27) if man else (0.67, 0.57, 0.4), 0.88)
    hair = material(f"{role}-hair", (0.12, 0.09, 0.07) if man else (0.08, 0.06, 0.05), 0.9)

    root = empty("Root", (0.0, 0.0, 0.0))
    height = 1.22 if man else 1.14
    scale = height / 1.22

    # Feet on Z=0, with visible lower legs and a knee-length garment. This keeps
    # every view recognisably human instead of collapsing into a robe tube.
    l_foot = mesh("uv_sphere", "LFoot", (-0.07 * scale, 0.035, 0.027 * scale), radius=0.05 * scale, segments=12, ring_count=8)
    l_foot.scale = (0.72, 1.45, 0.5)
    r_foot = mesh("uv_sphere", "RFoot", (0.07 * scale, 0.035, 0.027 * scale), radius=0.05 * scale, segments=12, ring_count=8)
    r_foot.scale = (0.72, 1.45, 0.5)
    for foot in (l_foot, r_foot):
        assign(foot, skin)
        parent(foot, root)

    for side, base_x in (("L", -0.07 * scale), ("R", 0.07 * scale)):
        for toe_index, x_offset in enumerate((-0.018, 0.0, 0.018)):
            toe = mesh(
                "uv_sphere",
                f"{side}Toe{toe_index}",
                (base_x + x_offset * scale, 0.096 * scale, 0.024 * scale),
                radius=(0.012 - abs(x_offset) * 0.08) * scale,
                segments=8,
                ring_count=6,
            )
            toe.scale = (0.82, 1.15, 0.62)
            assign(toe, skin)
            parent(toe, root)

    for side, x in (("L", -0.07 * scale), ("R", 0.07 * scale)):
        tapered_limb_between(
            f"{side}LowerLeg",
            (x, 0.0, 0.07 * scale),
            (x, 0.0, 0.39 * scale),
            0.031 * scale,
            0.041 * scale,
            skin,
            root,
        )
        knee = mesh(
            "uv_sphere",
            f"{side}Knee",
            (x, 0.0, 0.39 * scale),
            radius=0.038 * scale,
            segments=12,
            ring_count=8,
        )
        knee.scale = (0.9, 0.86, 1.0)
        assign(knee, skin)
        parent(knee, root)

    robe_obj = cloth_prism(
        "Robe",
        (0.34 if man else 0.31) * scale,
        0.99 * scale,
        (0.15 if man else 0.155) * scale,
        (0.1 if man else 0.095) * scale,
        (0.135 if man else 0.13) * scale,
        0.12 * scale,
    )
    assign(robe_obj, robe)
    parent(robe_obj, root)

    sash = cloth_strip(
        "Sash",
        (-0.075 if man else 0.075) * scale,
        (0.075 if man else -0.075) * scale,
        0.96 * scale,
        0.56 * scale,
        0.022 * scale,
        0.064 * scale,
    )
    assign(sash, robe_edge)
    parent(sash, root)

    # Two quiet front folds give the cloth depth without pretending to be anatomy.
    for side, x in (("L", -0.052 * scale), ("R", 0.052 * scale)):
        fold = mesh("cube", f"{side}Fold", (x, 0.058 * scale, 0.64 * scale), size=1.0)
        fold.scale = (0.018 * scale, 0.009 * scale, 0.25 * scale)
        assign(fold, robe)
        parent(fold, root)

    belt = mesh(
        "torus",
        "Belt",
        (0.0, 0.0, 0.73 * scale),
        major_radius=(0.105 if man else 0.1) * scale,
        minor_radius=0.012 * scale,
        major_segments=24,
        minor_segments=8,
    )
    assign(belt, robe_edge)
    parent(belt, root)

    neck = mesh("cylinder", "Neck", (0.0, 0.0, 1.035 * scale), radius=0.035 * scale, depth=0.11 * scale, vertices=14)
    assign(neck, skin)
    parent(neck, root)

    head = mesh("uv_sphere", "Head", (0.0, 0.012 * scale, 1.13 * scale), radius=0.09 * scale, segments=24, ring_count=16)
    head.scale = (0.88, 0.94, 1.08)
    assign(head, skin)
    parent(head, root)

    nose = mesh("cone", "Nose", (0.0, 0.096 * scale, 1.125 * scale), radius1=0.011 * scale, radius2=0.003 * scale, depth=0.032 * scale, vertices=10)
    nose.rotation_euler.x = math.radians(90)
    assign(nose, skin)
    parent(nose, root)

    for side, x in (("L", -0.026 * scale), ("R", 0.026 * scale)):
        eye = mesh(
            "uv_sphere",
            f"{side}Eye",
            (x, 0.096 * scale, 1.145 * scale),
            radius=0.0075 * scale,
            segments=8,
            ring_count=6,
        )
        assign(eye, hair)
        parent(eye, head)
        brow = mesh("cube", f"{side}Brow", (x, 0.097 * scale, 1.166 * scale), size=1.0)
        brow.scale = (0.017 * scale, 0.0025 * scale, 0.0025 * scale)
        brow.rotation_euler.y = (-0.08 if side == "L" else 0.08)
        assign(brow, hair)
        parent(brow, head)

    for side, x in (("L", -0.082 * scale), ("R", 0.082 * scale)):
        ear = mesh(
            "uv_sphere",
            f"{side}Ear",
            (x, 0.012 * scale, 1.13 * scale),
            radius=0.017 * scale,
            segments=10,
            ring_count=8,
        )
        ear.scale = (0.5, 0.42, 1.0)
        assign(ear, skin)
        parent(ear, head)

    mouth = mesh("cube", "Mouth", (0.0, 0.101 * scale, 1.09 * scale), size=1.0)
    mouth.scale = (0.023 * scale, 0.0035 * scale, 0.003 * scale)
    assign(mouth, hair)
    parent(mouth, head)

    if man:
        hair_cap = mesh("uv_sphere", "Hair", (0.0, -0.024 * scale, 1.158 * scale), radius=0.096 * scale, segments=18, ring_count=12)
        hair_cap.scale = (1.0, 0.82, 0.72)
        assign(hair_cap, hair)
        parent(hair_cap, head)
    else:
        hair_cap = mesh("uv_sphere", "Hair", (0.0, -0.028 * scale, 1.15 * scale), radius=0.1 * scale, segments=18, ring_count=12)
        hair_cap.scale = (1.0, 0.8, 1.0)
        assign(hair_cap, hair)
        parent(hair_cap, head)
        fall = mesh("uv_sphere", "HairFall", (0.0, -0.075 * scale, 1.01 * scale), radius=0.072 * scale, segments=14, ring_count=10)
        fall.scale = (0.76, 1.1, 1.5)
        assign(fall, hair)
        parent(fall, head)

    shoulder_z = 0.95 * scale
    shoulder_x = 0.15 * scale if man else 0.14 * scale

    def arm(side: str, x: float) -> None:
        sign = 1.0 if x > 0 else -1.0
        shoulder = (x, 0.0, shoulder_z)
        elbow = (sign * 0.18 * scale, 0.025 * scale, 0.76 * scale)
        wrist = (sign * 0.13 * scale, 0.09 * scale, 0.59 * scale)
        tapered_limb_between(f"{side}Sleeve", shoulder, elbow, 0.044 * scale, 0.035 * scale, robe, root)
        tapered_limb_between(f"{side}Forearm", elbow, wrist, 0.028 * scale, 0.021 * scale, skin, root)
        hand = mesh("uv_sphere", f"{side}Hand", wrist, radius=0.027 * scale, segments=12, ring_count=8)
        hand.scale = (0.8, 0.68, 1.18)
        assign(hand, skin)
        parent(hand, root)

    arm("L", -shoulder_x)
    arm("R", shoulder_x)
    return root


def export_glb(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        use_selection=False,
    )


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for role in ("man", "woman"):
        wipe()
        build_person(role)
        dest = OUT / f"{role}.glb"
        export_glb(dest)
        print(f"wrote {dest} ({dest.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
