import type { SceneId } from './scenes.ts'
import { KJV } from './kjv.ts'

export const NARRATION: Record<SceneId | 'trailer', string> = {
  beginning: `${KJV.gen1_1} ${KJV.gen1_2}`,
  day1: `${KJV.gen1_3} ${KJV.gen1_4}`,
  day2: `${KJV.gen1_6} ${KJV.gen1_8} And the evening and the morning were the second day.`,
  day3: `${KJV.gen1_9} ${KJV.gen1_11} And God saw that it was good.`,
  day4: `${KJV.gen1_16} And God saw that it was good.`,
  day5: `${KJV.gen1_20} And God saw that it was good.`,
  day6: `${KJV.gen1_24} ${KJV.gen1_26} ${KJV.gen1_27} ${KJV.gen1_31}`,
  day7: `${KJV.gen2_2} And God blessed the seventh day, and sanctified it.`,
  garden: `${KJV.gen2_8} ${KJV.gen2_16_17}`,
  fall: `${KJV.gen3_1} ${KJV.gen3_4} ${KJV.gen3_6} ${KJV.gen3_23}`,
  closing:
    'This is a visual meditation on Genesis, not a documentary. Go to church. Hear the Word. Live for Jesus Christ.',
  doubt: 'Got doubt?',
  measure:
    'Physicists describe an expanding universe, and a faint microwave glow left from early light. That is what we can measure. It does not replace the Word. Read the NASA and Planck pages. Then go to church.',
  trailer: `${KJV.gen1_1} ${KJV.gen1_3} ${KJV.gen1_31} ${KJV.gen3_4} And she took of the fruit thereof, and did eat. Go to church. Live for Jesus Christ. Got doubt?`,
}
