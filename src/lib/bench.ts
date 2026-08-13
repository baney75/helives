const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = `
precision mediump float;
uniform float uTime;
void main() {
  vec2 uv = gl_FragCoord.xy * 0.008;
  float n = 0.0;
  for (int i = 1; i <= 20; i++) {
    float f = float(i);
    n += sin(uv.x * f + uTime) * cos(uv.y * f - uTime);
    uv *= 1.12;
  }
  gl_FragColor = vec4(n * 0.05 + 0.08, 0.04, 0.1, 1.0);
}
`

const POINT_VERT = `
attribute vec2 aPos;
uniform float uTime;
void main() {
  float s = sin(uTime + aPos.x * 6.0) * 0.04;
  gl_Position = vec4(aPos.x, aPos.y + s, 0.0, 1.0);
  gl_PointSize = 2.0;
}
`

const POINT_FRAG = `
precision mediump float;
void main() {
  gl_FragColor = vec4(1.0, 0.85, 0.55, 0.7);
}
`

const WARMUP_FRAMES = 10
const SAMPLE_FRAMES = 28
const MAX_BENCH_MS = 800
const POINT_COUNT = 6000

type Probe = {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  fill: WebGLProgram
  points: WebGLProgram
  quad: WebGLBuffer
  cloud: WebGLBuffer
  uTimeFill: WebGLUniformLocation | null
  uTimePoints: WebGLUniformLocation | null
}

export function runGpuBench(signal?: AbortSignal): Promise<number[]> {
  const probe = createProbe()
  if (signal?.aborted) {
    destroyProbe(probe)
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }
  return sampleProbe(probe, signal)
}

function sampleProbe(probe: Probe, signal?: AbortSignal): Promise<number[]> {
  const samples: number[] = []
  let frames = 0
  let last = 0
  let raf = 0
  const started = performance.now()

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      cancelAnimationFrame(raf)
      destroyProbe(probe)
      if (error) reject(error)
      else resolve(samples)
    }
    const onAbort = () => finish(new DOMException('Aborted', 'AbortError'))
    signal?.addEventListener('abort', onAbort, { once: true })

    const tick = (now: number) => {
      drawProbe(probe, now * 0.001)
      frames += 1
      if (last > 0 && frames > WARMUP_FRAMES) samples.push(now - last)
      last = now
      if (samples.length >= SAMPLE_FRAMES || now - started >= MAX_BENCH_MS) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
  })
}

function createProbe(): Probe {
  const canvas = document.createElement('canvas')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const width = Math.min(960, Math.max(320, window.innerWidth))
  const height = Math.min(540, Math.max(240, window.innerHeight))
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none'
  document.body.appendChild(canvas)
  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  })
  if (!gl) {
    canvas.remove()
    throw new Error('WebGL unavailable')
  }
  try {
    return bindProbe(canvas, gl)
  } catch (error) {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    canvas.remove()
    throw error
  }
}

function bindProbe(canvas: HTMLCanvasElement, gl: WebGLRenderingContext): Probe {
  const fill = link(gl, VERT, FRAG)
  const points = link(gl, POINT_VERT, POINT_FRAG)
  const quad = buffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]))
  const cloud = buffer(gl, randomPoints(POINT_COUNT))
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  return {
    canvas,
    gl,
    fill,
    points,
    quad,
    cloud,
    uTimeFill: gl.getUniformLocation(fill, 'uTime'),
    uTimePoints: gl.getUniformLocation(points, 'uTime'),
  }
}

function drawProbe(probe: Probe, time: number): void {
  const { gl } = probe
  gl.clearColor(0.01, 0.01, 0.03, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(probe.fill)
  if (probe.uTimeFill) gl.uniform1f(probe.uTimeFill, time)
  bindAttrib(gl, probe.fill, probe.quad)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.useProgram(probe.points)
  if (probe.uTimePoints) gl.uniform1f(probe.uTimePoints, time)
  bindAttrib(gl, probe.points, probe.cloud)
  gl.drawArrays(gl.POINTS, 0, POINT_COUNT)
}

function destroyProbe(probe: Probe): void {
  const { gl } = probe
  gl.deleteBuffer(probe.quad)
  gl.deleteBuffer(probe.cloud)
  gl.deleteProgram(probe.fill)
  gl.deleteProgram(probe.points)
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  probe.canvas.remove()
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('shader alloc failed')
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  const log = gl.getShaderInfoLog(shader) ?? 'compile failed'
  gl.deleteShader(shader)
  throw new Error(log)
}

function link(gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('program alloc failed')
  const vs = compile(gl, gl.VERTEX_SHADER, vert)
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program
  const log = gl.getProgramInfoLog(program) ?? 'link failed'
  gl.deleteProgram(program)
  throw new Error(log)
}

function buffer(gl: WebGLRenderingContext, data: Float32Array): WebGLBuffer {
  const buf = gl.createBuffer()
  if (!buf) throw new Error('buffer alloc failed')
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  return buf
}

function bindAttrib(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  buf: WebGLBuffer,
): void {
  const loc = gl.getAttribLocation(program, 'aPos')
  if (loc < 0) return
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
}

function randomPoints(count: number): Float32Array {
  const data = new Float32Array(count * 2)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  return data
}
