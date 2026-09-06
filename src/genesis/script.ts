import type { SceneId } from './scenes.ts'
import { KJV } from './kjv.ts'

export type VoiceRole = 'narrator' | 'god' | 'serpent' | 'woman' | 'man'

export type VoiceCue = {
  role: VoiceRole
  action?: 'look' | 'take' | 'give' | 'depart'
  text: string
}

/**
 * Exact KJV dialogue cues for the Fall. The voice assigned to words attributed
 * to God is a reverent reader—not an impersonation or invented performance.
 */
export const FALL_VOICE_CUES: readonly VoiceCue[] = [
  { role: 'narrator', text: KJV.gen3_1_narrator },
  { role: 'serpent', text: KJV.gen3_1_serpent },
  { role: 'woman', text: KJV.gen3_2_3 },
  { role: 'serpent', text: `${KJV.gen3_4} ${KJV.gen3_5}` },
  { role: 'narrator', action: 'look', text: KJV.gen3_6.split('she took')[0]!.trim() },
  { role: 'narrator', action: 'take', text: 'she took' + KJV.gen3_6.split('she took')[1]!.split('and gave')[0]!.trimEnd() },
  { role: 'narrator', action: 'give', text: 'and gave' + KJV.gen3_6.split('and gave')[1]! },
  { role: 'narrator', text: KJV.gen3_8_9_narrator },
  { role: 'god', text: KJV.gen3_9_god },
  { role: 'man', text: KJV.gen3_10 },
  { role: 'god', text: KJV.gen3_11 },
  { role: 'man', text: KJV.gen3_12 },
  { role: 'narrator', text: KJV.gen3_13_intro },
  { role: 'god', text: KJV.gen3_13_god },
  { role: 'woman', text: KJV.gen3_13_woman },
  { role: 'narrator', action: 'depart', text: KJV.gen3_23 },
]

export const NARRATION: Record<SceneId | 'trailer', string> = {
  beginning: `${KJV.gen1_1} ${KJV.gen1_2}`,
  day1: `${KJV.gen1_3} ${KJV.gen1_4}`,
  day2: `${KJV.gen1_6} ${KJV.gen1_8} And the evening and the morning were the second day.`,
  day3: `${KJV.gen1_9} ${KJV.gen1_10} ${KJV.gen1_11} And God saw that it was good.`,
  day4: `${KJV.gen1_16} And God saw that it was good.`,
  day5: `${KJV.gen1_20} And God saw that it was good.`,
  day6: `${KJV.gen1_24} ${KJV.gen1_26} ${KJV.gen1_27} ${KJV.gen1_31}`,
  day7: `${KJV.gen2_2} And God blessed the seventh day, and sanctified it.`,
  garden: `${KJV.gen2_8} ${KJV.gen2_16_17}`,
  fall: FALL_VOICE_CUES.map((cue) => cue.text).join(' '),
  closing:
    'Follow Jesus Christ. Begin with one of the Gospels. Pray honestly. Find a faithful local church that teaches Scripture and takes your questions seriously.',
  doubt:
    'Got doubt? You do not have to pretend certainty. Ask what Genesis says and what the evidence can show. Bring both questions to Christians who will listen before they answer.',
  measure:
    'Measurements support an expanding universe about 13.8 billion years old and record the cosmic microwave background. These findings describe the physical history we can observe. They do not settle every question Genesis asks. The NASA and Planck sources are linked on the next page.',
  trailer: `${KJV.gen1_1} ${KJV.gen1_3} ${KJV.gen1_31} ${KJV.gen3_4} And she took of the fruit thereof, and did eat. Follow Jesus Christ. Begin with one of the Gospels. Got doubt? You do not have to pretend certainty.`,
}

export const SCENE_VOICE_CUES: Partial<Record<SceneId, readonly VoiceCue[]>> = {
  day1: [
    { role: 'narrator', text: 'And God said,' },
    { role: 'god', text: 'Let there be light:' },
    { role: 'narrator', text: `and there was light. ${KJV.gen1_4}` },
  ],
  day2: [
    { role: 'narrator', text: 'And God said,' },
    { role: 'god', text: 'Let there be a firmament in the midst of the waters, and let it divide the waters from the waters.' },
    { role: 'narrator', text: `${KJV.gen1_8} And the evening and the morning were the second day.` },
  ],
  day3: [
    { role: 'narrator', text: 'And God said,' },
    { role: 'god', text: 'Let the waters under the heaven be gathered together unto one place, and let the dry land appear:' },
    { role: 'narrator', text: `and it was so. ${KJV.gen1_10} And God said,` },
    { role: 'god', text: 'Let the earth bring forth grass, the herb yielding seed, and the fruit tree yielding fruit after his kind.' },
    { role: 'narrator', text: 'And God saw that it was good.' },
  ],
  day5: [
    { role: 'narrator', text: 'And God said,' },
    { role: 'god', text: 'Let the waters bring forth abundantly the moving creature that hath life, and fowl that may fly above the earth in the open firmament of heaven.' },
    { role: 'narrator', text: 'And God saw that it was good.' },
  ],
  day6: [
    { role: 'narrator', text: 'And God said,' },
    { role: 'god', text: 'Let the earth bring forth the living creature after his kind.' },
    { role: 'narrator', text: 'And God said,' },
    { role: 'god', text: 'Let us make man in our image, after our likeness.' },
    { role: 'narrator', text: `${KJV.gen1_27} ${KJV.gen1_31}` },
  ],
  garden: [
    { role: 'narrator', text: `${KJV.gen2_8} And the Lord God commanded the man, saying,` },
    { role: 'god', text: 'Of every tree of the garden thou mayest freely eat: But of the tree of the knowledge of good and evil, thou shalt not eat of it.' },
  ],
  fall: FALL_VOICE_CUES,
}
