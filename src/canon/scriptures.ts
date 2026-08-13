export type CanonStatus = 'live' | 'forthcoming'

export type CanonBook = {
  id: string
  title: string
  status: CanonStatus
  href: string | null
  note?: string
}

export type CanonDivision = {
  id: string
  testament: 'old' | 'new'
  label: string
  books: readonly CanonBook[]
}

function live(id: string, title: string, href: string, note?: string): CanonBook {
  return note ? { id, title, status: 'live', href, note } : { id, title, status: 'live', href }
}

function soon(id: string, title: string, note?: string): CanonBook {
  return note
    ? { id, title, status: 'forthcoming', href: null, note }
    : { id, title, status: 'forthcoming', href: null }
}

/** Protestant 66. Display only. Do not turn these ids into routes. */
export const CANON: readonly CanonDivision[] = [
  {
    id: 'law',
    testament: 'old',
    label: 'The Law',
    books: [
      live('genesis', 'Genesis', '/genesis', 'Creation through the Fall. Live now.'),
      soon('exodus', 'Exodus'),
      soon('leviticus', 'Leviticus', 'Holiness and the law.'),
      soon('numbers', 'Numbers', 'Census and the wilderness.'),
      soon('deuteronomy', 'Deuteronomy'),
    ],
  },
  {
    id: 'history',
    testament: 'old',
    label: 'History',
    books: [
      soon('joshua', 'Joshua'),
      soon('judges', 'Judges'),
      soon('ruth', 'Ruth'),
      soon('1-samuel', '1 Samuel'),
      soon('2-samuel', '2 Samuel'),
      soon('1-kings', '1 Kings'),
      soon('2-kings', '2 Kings'),
      soon('1-chronicles', '1 Chronicles', 'Genealogies and the temple.'),
      soon('2-chronicles', '2 Chronicles', 'Kings and the house of the Lord.'),
      soon('ezra', 'Ezra'),
      soon('nehemiah', 'Nehemiah'),
      soon('esther', 'Esther'),
    ],
  },
  {
    id: 'wisdom',
    testament: 'old',
    label: 'Wisdom',
    books: [
      soon('job', 'Job'),
      soon('psalms', 'Psalms'),
      soon('proverbs', 'Proverbs'),
      soon('ecclesiastes', 'Ecclesiastes'),
      soon('song-of-solomon', 'Song of Solomon'),
    ],
  },
  {
    id: 'major-prophets',
    testament: 'old',
    label: 'Major Prophets',
    books: [
      soon('isaiah', 'Isaiah'),
      soon('jeremiah', 'Jeremiah'),
      soon('lamentations', 'Lamentations'),
      soon('ezekiel', 'Ezekiel'),
      soon('daniel', 'Daniel'),
    ],
  },
  {
    id: 'minor-prophets',
    testament: 'old',
    label: 'Minor Prophets',
    books: [
      soon('hosea', 'Hosea'),
      soon('joel', 'Joel'),
      soon('amos', 'Amos'),
      soon('obadiah', 'Obadiah'),
      soon('jonah', 'Jonah'),
      soon('micah', 'Micah'),
      soon('nahum', 'Nahum'),
      soon('habakkuk', 'Habakkuk'),
      soon('zephaniah', 'Zephaniah'),
      soon('haggai', 'Haggai'),
      soon('zechariah', 'Zechariah'),
      soon('malachi', 'Malachi'),
    ],
  },
  {
    id: 'gospels',
    testament: 'new',
    label: 'Gospels',
    books: [
      soon('matthew', 'Matthew'),
      soon('mark', 'Mark'),
      soon('luke', 'Luke'),
      soon('john', 'John'),
    ],
  },
  {
    id: 'acts',
    testament: 'new',
    label: 'History',
    books: [soon('acts', 'Acts')],
  },
  {
    id: 'paul',
    testament: 'new',
    label: 'Letters of Paul',
    books: [
      soon('romans', 'Romans'),
      soon('1-corinthians', '1 Corinthians'),
      soon('2-corinthians', '2 Corinthians'),
      soon('galatians', 'Galatians'),
      soon('ephesians', 'Ephesians'),
      soon('philippians', 'Philippians'),
      soon('colossians', 'Colossians'),
      soon('1-thessalonians', '1 Thessalonians'),
      soon('2-thessalonians', '2 Thessalonians'),
      soon('1-timothy', '1 Timothy'),
      soon('2-timothy', '2 Timothy'),
      soon('titus', 'Titus'),
      soon('philemon', 'Philemon'),
    ],
  },
  {
    id: 'general',
    testament: 'new',
    label: 'General Letters',
    books: [
      soon('hebrews', 'Hebrews'),
      soon('james', 'James'),
      soon('1-peter', '1 Peter'),
      soon('2-peter', '2 Peter'),
      soon('1-john', '1 John'),
      soon('2-john', '2 John'),
      soon('3-john', '3 John'),
      soon('jude', 'Jude'),
    ],
  },
  {
    id: 'revelation',
    testament: 'new',
    label: 'The Revelation',
    books: [soon('revelation', 'Revelation')],
  },
]

export const CANON_BOOKS: readonly CanonBook[] = CANON.flatMap((division) => division.books)

export const OLD_TESTAMENT = CANON.filter((division) => division.testament === 'old')
export const NEW_TESTAMENT = CANON.filter((division) => division.testament === 'new')
