import type { ReactNode } from 'react'
import { BrandMark } from './BrandMark.tsx'
import { MusicControls } from '../music/MusicControls.tsx'

export type NavId = 'home' | 'genesis' | 'scriptures' | 'afterword' | 'faith'

const LINKS: readonly { id: NavId; href: string; label: string }[] = [
  { id: 'genesis', href: '/genesis', label: 'Genesis' },
  { id: 'scriptures', href: '/scriptures', label: 'Scriptures' },
  { id: 'faith', href: '/faith', label: 'Faith' },
  { id: 'afterword', href: '/genesis/afterword', label: 'Afterword' },
]

export function SiteNav({ current, extra }: { current?: NavId; extra?: ReactNode }) {
  return (
    <header className="nav">
      <a className="skip" href="#main-content">Skip to content</a>
      <div className="nav-identity">
      <a className="nav-mark" href="/" aria-current={current === 'home' ? 'page' : undefined}>
        <BrandMark size={30} />
        He Lives
      </a>
      {extra}
      </div>
      <nav aria-label="Main navigation">
        {LINKS.map((link) => (
          <a key={link.id} href={link.href} aria-current={current === link.id ? 'page' : undefined}>
            {link.label}
          </a>
        ))}
      </nav>
      {current !== 'home' && <MusicControls />}
    </header>
  )
}
