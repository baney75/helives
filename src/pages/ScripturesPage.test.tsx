import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScripturesPage } from './ScripturesPage.tsx'

describe('ScripturesPage', () => {
  it('renders the whole canon while linking only the live Genesis experience', () => {
    const html = renderToStaticMarkup(<ScripturesPage />)

    expect((html.match(/<li class="canon-book(?: is-live)?"/g) ?? [])).toHaveLength(66)
    expect(html).toContain('Old Testament')
    expect(html).toContain('New Testament')
    expect(html).toContain('href="/genesis"')
    expect(html).not.toContain('href="/exodus"')
    expect(html).not.toContain('disabled')
    expect(html).toContain('660 illustrations, ten for each book')
  })
})
