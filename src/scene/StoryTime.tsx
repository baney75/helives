import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useRef, type ReactNode } from 'react'

const StoryTime = createContext(0)
export function StoryTimeProvider({ seconds, children }: { seconds: number; children: ReactNode }) {
  return <StoryTime.Provider value={seconds}>{children}</StoryTime.Provider>
}

/** Every motion follows the same media clock: pause, seek and speed apply together. */
export function useStoryFrame(callback: (seconds: number, delta: number) => void) {
  const seconds = useContext(StoryTime)
  const previous = useRef<number | null>(null)
  useFrame(() => {
    const delta = previous.current === null ? 1 : Math.abs(seconds - previous.current)
    previous.current = seconds
    callback(seconds, delta > 0.2 ? 1 : delta)
  })
}
