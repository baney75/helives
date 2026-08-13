import { useEffect, useState } from 'react'
import { type Quality } from '../lib/budget.ts'
import { runGpuBench } from '../lib/bench.ts'
import {
  chooseTier,
  hashUa,
  makeQualityRecord,
  qualityFromSearch,
  readReusableQuality,
  STORAGE_KEY,
} from '../lib/quality.ts'

export type QualityGate =
  | { status: 'pending' }
  | { status: 'ready'; quality: Quality }

export function useAutoQuality(
  reducedMotion: boolean,
  visible: boolean,
  search: string,
): QualityGate {
  const [gate, setGate] = useState<QualityGate>(() => initialGate(search, reducedMotion))

  useEffect(() => {
    if (reducedMotion) {
      setGate({ status: 'ready', quality: 'low' })
      return
    }
    const override = qualityFromSearch(search)
    if (override) setGate({ status: 'ready', quality: override })
  }, [reducedMotion, search])

  useEffect(() => {
    if (gate.status === 'ready' || !visible) return
    const abort = new AbortController()
    void measureAndStore(abort.signal, (quality) => {
      setGate({ status: 'ready', quality })
    })
    return () => abort.abort()
  }, [gate.status, visible])

  return gate
}

function initialGate(search: string, reducedMotion: boolean): QualityGate {
  const override = qualityFromSearch(search)
  if (override) return { status: 'ready', quality: override }
  if (reducedMotion) return { status: 'ready', quality: 'low' }
  if (typeof window === 'undefined') return { status: 'pending' }
  const stored = readReusableQuality(
    window.localStorage.getItem(STORAGE_KEY),
    Date.now(),
    hashUa(window.navigator.userAgent),
  )
  if (stored) return { status: 'ready', quality: stored.tier }
  return { status: 'pending' }
}

async function measureAndStore(
  signal: AbortSignal,
  onReady: (quality: Quality) => void,
): Promise<void> {
  try {
    const times = await runGpuBench(signal)
    if (signal.aborted) return
    const quality = chooseTier(times)
    writeQuality(quality)
    onReady(quality)
  } catch (error) {
    if (signal.aborted || isAbort(error)) return
    writeQuality('low')
    onReady('low')
  }
}

function writeQuality(quality: Quality): void {
  const record = makeQualityRecord(quality, Date.now(), window.navigator.userAgent)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // private mode / quota
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
