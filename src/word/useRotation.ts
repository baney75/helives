import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentVisible } from '../hooks/useDocumentVisible.ts'
import { rotatedPassage } from './rotation.ts'

/** Session-relative reading intervals: every new passage gets its full reading time. */
export function useRotation(now?: Date) {
  const [start] = useState(() => now ?? new Date())
  const [offset, setOffset] = useState(0)
  const seconds = 60
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const last = useRef(0)
  const visible = useDocumentVisible()
  const move = useCallback((direction: number) => {
    setOffset(value => value + direction)
    elapsedRef.current = 0
    setElapsed(0)
    last.current = Date.now()
  }, [])
  useEffect(() => {
    if (now || paused || !visible) return
    last.current = Date.now()
    const timer = window.setInterval(() => {
      const at = Date.now()
      const delta = Math.max(0, at-last.current)
      last.current = at
      elapsedRef.current += delta
      const duration = seconds*1000
      if (elapsedRef.current >= duration) {
        const steps = Math.floor(elapsedRef.current/duration)
        setOffset(value => value+steps)
        elapsedRef.current %= duration
      }
      setElapsed(elapsedRef.current)
    }, 250)
    return () => clearInterval(timer)
  }, [now, paused, seconds, visible])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [contenteditable]'))) return
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
      if (event.code === 'Space') { event.preventDefault(); setPaused(value => !value) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [move])
  return { passage: rotatedPassage(start, offset), sequence: offset, epoch: Math.floor(start.getTime() / 3_600_000), seconds,
    paused, toggle: () => setPaused(value => !value), move, remain: seconds*1000-elapsed, visible }
}
