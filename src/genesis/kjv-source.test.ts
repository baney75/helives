import { describe, expect, it } from 'vitest'
import { KJV } from './kjv.ts'
import { NARRATION, FALL_VOICE_CUES, SCENE_VOICE_CUES } from './script.ts'

// Source text checked against the public-domain KJV at Bible Gateway:
// https://www.biblegateway.com/passage/?search=Genesis+1%3A6-13&version=KJV
// https://www.biblegateway.com/passage/?search=Genesis+1%3A24-31&version=KJV
// https://www.biblegateway.com/passage/?search=Genesis+2&version=KJV
// https://www.biblegateway.com/passage/?search=Genesis+3&version=KJV
describe('KJV source fidelity', () => {
  it('keeps the complete creation commands rather than ending verses early', () => {
    expect(KJV.gen1_11).toBe('And God said, Let the earth bring forth grass, the herb yielding seed, and the fruit tree yielding fruit after his kind, whose seed is in itself, upon the earth: and it was so.')
    expect(KJV.gen1_24).toBe('And God said, Let the earth bring forth the living creature after his kind, cattle, and creeping thing, and beast of the earth after his kind: and it was so.')
    expect(KJV.gen1_26).toBe('And God said, Let us make man in our image, after our likeness: and let them have dominion over the fish of the sea, and over the fowl of the air, and over the cattle, and over all the earth, and over every creeping thing that creepeth upon the earth.')
    expect(KJV.gen2_3).toBe('And God blessed the seventh day, and sanctified it: because that in it he had rested from all his work which God created and made.')
  })

  it('does not omit the death warning before the Fall', () => {
    const warning = 'But of the tree of the knowledge of good and evil, thou shalt not eat of it: for in the day that thou eatest thereof thou shalt surely die.'
    expect(KJV.gen2_16_17).toBe(`And the Lord God commanded the man, saying, Of every tree of the garden thou mayest freely eat: ${warning}`)
    expect(SCENE_VOICE_CUES.garden?.at(-1)?.text).toContain(warning)
    expect(NARRATION.garden).toContain(warning)
  })

  it('keeps the serpent’s punctuation and the full fruit verse', () => {
    expect(KJV.gen3_4).toBe('And the serpent said unto the woman, Ye shall not surely die:')
    expect(KJV.gen3_6).toBe('And when the woman saw that the tree was good for food, and that it was pleasant to the eyes, and a tree to be desired to make one wise, she took of the fruit thereof, and did eat, and gave also unto her husband with her; and he did eat.')
    expect(FALL_VOICE_CUES.filter(cue => ['look', 'take', 'give'].includes(cue.action ?? '')).map(cue => cue.text).join(' ')).toBe(KJV.gen3_6)
  })
})
