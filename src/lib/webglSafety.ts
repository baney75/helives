import type { BufferGeometry, Material, Object3D } from 'three'

/** Keep the tab alive after a GPU reset. preventDefault lets `webglcontextrestored` fire. */
export function guardWebGLContext(
  canvas: HTMLCanvasElement,
  onLost: () => void,
  onRestored?: () => void,
): () => void {
  const lost = (event: Event) => {
    event.preventDefault()
    onLost()
  }
  const restored = () => onRestored?.()
  canvas.addEventListener('webglcontextlost', lost, false)
  canvas.addEventListener('webglcontextrestored', restored, false)
  return () => {
    canvas.removeEventListener('webglcontextlost', lost, false)
    canvas.removeEventListener('webglcontextrestored', restored, false)
  }
}

export function disposeGeometry(geometry: BufferGeometry | undefined | null): void {
  geometry?.dispose()
}

export function disposeMaterial(material: Material | Material[] | undefined | null): void {
  if (!material) return
  if (Array.isArray(material)) {
    for (const item of material) item.dispose()
    return
  }
  material.dispose()
}

/** Manual geometries only. Do not dispose shared GLTF buffers. */
export function disposeManualObject(object: Object3D, disposeMaterials = false): void {
  object.traverse((child) => {
    const mesh = child as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] }
    if (mesh.geometry) disposeGeometry(mesh.geometry)
    if (disposeMaterials) disposeMaterial(mesh.material)
  })
}
