export type SourceKind = 'primary' | 'commentary'

export type Source = {
  id: string
  kind: SourceKind
  title: string
  href: string
  note: string
}

/** Verified 2026-09-07. Primary pages are NASA / ESA / NASA GSFC. Register is labeled commentary. */
export const COSMOLOGY_SOURCES: readonly Source[] = [
  {
    id: 'nasa-big-bang',
    kind: 'primary',
    title: 'NASA Science — The Big Bang',
    href: 'https://science.nasa.gov/universe/the-big-bang/',
    note: 'Agency overview of cosmic history and the oldest light we can observe.',
  },
  {
    id: 'nasa-overview',
    kind: 'primary',
    title: 'NASA Science — Cosmic History',
    href: 'https://science.nasa.gov/universe/overview/',
    note: 'Inflation, nucleosynthesis, recombination, and the cosmic microwave background.',
  },
  {
    id: 'nasa-space-place',
    kind: 'primary',
    title: 'NASA Space Place — What Is the Big Bang?',
    href: 'https://spaceplace.nasa.gov/big-bang/',
    note: 'Plain-language expanding universe; names Georges Lemaître and Hubble.',
  },
  {
    id: 'esa-planck-cmb',
    kind: 'primary',
    title: 'ESA — Planck and the cosmic microwave background',
    href: 'https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_and_the_cosmic_microwave_background',
    note: 'CMB at ~2.7 K; Penzias and Wilson, 1964–65; Nobel Prize in Physics 1978.',
  },
  {
    id: 'esa-planck',
    kind: 'primary',
    title: 'ESA — Planck overview',
    href: 'https://www.esa.int/Science_Exploration/Space_Science/Planck_overview',
    note: 'Planck mapped the CMB to test the standard cosmological model.',
  },
  {
    id: 'nasa-cmb-1965',
    kind: 'primary',
    title: 'NASA GSFC Cosmic Times — Penzias and Wilson',
    href: 'https://imagine.gsfc.nasa.gov/educators/programs/cosmictimes/educators/guide/1965/murmur.html',
    note: 'Holmdel horn, Bell Labs, 1965 Astrophysical Journal letters.',
  },
  {
    id: 'ncregister-shumaker',
    kind: 'commentary',
    title: 'Bradley Shumaker, National Catholic Register',
    href: 'https://www.ncregister.com/commentaries/shumaker-big-bang-theory',
    note: 'Catholic commentary. Not a physics paper. Linked, not reprinted.',
  },
] as const
