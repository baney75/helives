export const MOTIFS = ['light', 'water', 'lamp', 'vine', 'life'] as const

export type Motif = (typeof MOTIFS)[number]

export type Voice = 'narrator' | 'jesus'

export type VerseSpan = {
  readonly text: string
  readonly voice: Voice
  readonly italic?: true
  readonly lit?: true
}

export type Passage = {
  readonly ref: string
  readonly text: string
  readonly spans: readonly VerseSpan[]
  readonly motif: Motif
  readonly gatewayQuery: string
}

export function hasWordsOfChrist(passage: Passage): boolean {
  return passage.spans.some((span) => span.voice === 'jesus')
}
