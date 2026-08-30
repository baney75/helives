import { BrandMark } from './BrandMark.tsx'

export type NavId = 'home' | 'genesis' | 'scriptures' | 'afterword' | 'faith'

const LINKS: readonly { id: NavId; href: string; label: string }[] = [
  { id: 'scriptures', href: '/scriptures', label: 'Scriptures' },
  { id: 'faith', href: '/faith', label: 'Faith' },
  { id: 'afterword', href: '/genesis/afterword', label: 'Afterword' },
  { id: 'genesis', href: '/genesis', label: 'Genesis' },
]

export function SiteNav({ current }: { current?: NavId }) {
  return (
    <header className="nav">
      <a className="nav-mark" href="/" aria-current={current === 'home' ? 'page' : undefined}>
        <BrandMark size={22} framed />
        <span className="nav-mark-label">He Lives</span>
      </a>
      <nav>
        {LINKS.map((link) => (
          <a key={link.id} href={link.href} aria-current={current === link.id ? 'page' : undefined}>
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
