import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findSceneAt, presenceById } from '../genesis/scenes.ts'

const useNarration = vi.fn()

vi.mock('../hooks/useAutoQuality.ts', () => ({
  useAutoQuality: () => ({ status: 'pending', quality: 'medium' }),
}))
vi.mock('../hooks/useDocumentVisible.ts', () => ({ useDocumentVisible: () => true }))
vi.mock('../hooks/useGenesisClock.ts', () => ({
  useGenesisClock: () => ({
    progress: 0,
    setProgress: vi.fn(),
    playing: true,
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    reset: vi.fn(),
    speed: 1,
    setSpeed: vi.fn(),
    scale: 0.2,
    distance: 4.2,
    scene: findSceneAt(0),
    presence: presenceById(0),
  }),
}))
vi.mock('../hooks/useIsMobile.ts', () => ({ useIsMobile: () => false }))
vi.mock('../hooks/useNarration.ts', () => ({
  useNarration: (options: unknown) => useNarration(options),
}))
vi.mock('../hooks/usePrefersReducedMotion.ts', () => ({
  usePrefersReducedMotion: () => false,
}))
vi.mock('../scene/GenesisCanvas.tsx', () => ({ GenesisCanvas: () => null }))

import { GenesisPage } from './GenesisPage.tsx'

describe('Genesis first paint', () => {
  beforeEach(() => {
    useNarration.mockClear()
    useNarration.mockReturnValue({ blocked: false, hold: false, retry: vi.fn().mockResolvedValue(true) })
    vi.stubGlobal('window', { location: { search: '' } })
  })

  it('shows the beginning Scripture while GPU quality is still pending', () => {
    const html = renderToStaticMarkup(createElement(GenesisPage))

    expect(html).toContain('In the beginning')
    expect(html).toContain('In the beginning God created the heaven and the earth.')
    expect(html).toContain(
      'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.',
    )
    expect(html).not.toContain('Calibrating')
    expect(useNarration).toHaveBeenCalledWith(
      expect.objectContaining({ sceneId: 'beginning', playing: true }),
    )
  })
})
