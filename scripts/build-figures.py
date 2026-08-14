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


def build_person(role: str) -> bpy.types.Object:
    man = role == "man"
    skin = material(f"{role}-skin", (0.77, 0.63, 0.48) if man else (0.82, 0.69, 0.55), 0.58)
    robe = material(f"{role}-robe", (0.72, 0.63, 0.47) if man else (0.83, 0.77, 0.64), 0.86)
    hair = material(f"{role}-hair", (0.12, 0.09, 0.07) if man else (0.08, 0.06, 0.05), 0.9)

    root = empty("Root", (0.0, 0.0, 0.0))
    height = 1.22 if man else 1.14
    scale = height / 1.22

    # Feet on Z=0. Body is a person: head, neck, shoulders, hanging robe, arms, feet.
    l_foot = mesh("cube", "LFoot", (-0.07 * scale, 0.03, 0.025 * scale), size=1.0)
    l_foot.scale = (0.045 * scale, 0.09 * scale, 0.025 * scale)
    r_foot = mesh("cube", "RFoot", (0.07 * scale, 0.03, 0.025 * scale), size=1.0)
    r_foot.scale = (0.045 * scale, 0.09 * scale, 0.025 * scale)
    for foot in (l_foot, r_foot):
        assign(foot, skin)
        parent(foot, root)

    robe_obj = mesh(
        "cone",
        "Robe",
        (0.0, 0.0, 0.46 * scale),
        radius1=0.16 * scale,
        radius2=0.09 * scale,
        depth=0.78 * scale,
        vertices=22,
    )
    assign(robe_obj, robe)
    parent(robe_obj, root)

    chest = mesh("uv_sphere", "Chest", (0.0, 0.02 * scale, 0.96 * scale), radius=0.13 * scale, segments=16, ring_count=10)
    chest.scale = (1.15 if man else 1.0, 0.72, 0.85)
    assign(chest, robe)
    parent(chest, root)

    neck = mesh("cylinder", "Neck", (0.0, 0.01 * scale, 1.08 * scale), radius=0.032 * scale, depth=0.07 * scale, vertices=12)
    assign(neck, skin)
    parent(neck, root)

    head = mesh("uv_sphere", "Head", (0.0, 0.015 * scale, 1.18 * scale), radius=0.088 * scale, segments=20, ring_count=14)
    assign(head, skin)
    parent(head, root)

    if man:
        hair_cap = mesh("uv_sphere", "Hair", (0.0, 0.0, 1.205 * scale), radius=0.09 * scale, segments=16, ring_count=10)
        hair_cap.scale = (1.0, 1.02, 0.72)
        assign(hair_cap, hair)
        parent(hair_cap, head)
        beard = mesh("uv_sphere", "Beard", (0.0, 0.055 * scale, 1.145 * scale), radius=0.05 * scale, segments=12, ring_count=8)
        beard.scale = (0.85, 0.7, 0.55)
        assign(beard, hair)
        parent(beard, head)
    else:
        hair_cap = mesh("uv_sphere", "Hair", (0.0, -0.005 * scale, 1.195 * scale), radius=0.095 * scale, segments=16, ring_count=10)
        assign(hair_cap, hair)
        parent(hair_cap, head)
        fall = mesh("uv_sphere", "HairFall", (0.0, -0.07 * scale, 1.02 * scale), radius=0.07 * scale, segments=12, ring_count=8)
        fall.scale = (0.7, 1.15, 1.6)
        assign(fall, hair)
        parent(fall, head)

    shoulder_y = 1.02 * scale
    shoulder_x = 0.16 * scale if man else 0.145 * scale

    def arm(side: str, x: float) -> None:
        upper = empty(f"{side}Upper", (x, 0.0, shoulder_y))
        parent(upper, root)
        sleeve = mesh(
            "cylinder",
            f"{side}Sleeve",
            (0.0, 0.0, -0.13 * scale),
            radius=0.042 * scale,
            depth=0.26 * scale,
            vertices=12,
        )
        assign(sleeve, robe)
        parent(sleeve, upper)
        lower = empty(f"{side}Lower", (0.0, 0.0, -0.26 * scale))
        parent(lower, upper)
        forearm = mesh(
            "cylinder",
            f"{side}Forearm",
            (0.0, 0.0, -0.1 * scale),
            radius=0.028 * scale,
            depth=0.2 * scale,
            vertices=10,
        )
        assign(forearm, skin)
        parent(forearm, lower)
        hand = mesh("uv_sphere", f"{side}Hand", (0.0, 0.0, -0.21 * scale), radius=0.03 * scale, segments=10, ring_count=8)
        assign(hand, skin)
        parent(hand, lower)
        # Rest pose: arms hang down (Blender Z-up, negative Z is down from shoulder).
        upper.rotation_euler = (0.35, 0.0, 0.22 if x > 0 else -0.22)

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
