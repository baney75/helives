import { compilePassage } from './markup.ts'
import type { Motif, Passage } from './types.ts'

/** Must stay coprime with POOL.length so every row is used. */
export const POOL_STEP = 31

function row(ref: string, motif: Motif, source: string): Passage {
  return compilePassage(ref, motif, source)
}

/**
 * 1769 KJV from farskipper/kjv (public domain). Italics follow that source’s
 * `[supplied]` marks. Words of Christ are marked here; neither farskipper nor
 * aruljohn/Bible-kjv encodes a speaker.
 */
export const POOL: readonly Passage[] = [
  row('Genesis 1:3', 'light', 'And God said, Let there be {light}: and there was {light}.'),
  row(
    'John 8:12',
    'light',
    'Then spake Jesus again unto them, saying, «{I am} the {light} of the world: he that followeth me shall not walk in darkness, but shall have the {light} of {life}.»',
  ),
  row(
    'Psalm 27:1',
    'light',
    'The LORD [is] my {light} and my salvation; whom shall I fear? the LORD [is] the strength of my {life}; of whom shall I be afraid?',
  ),
  row(
    'Isaiah 60:1',
    'light',
    'Arise, shine; for thy {light} is come, and the glory of the LORD is risen upon thee.',
  ),
  row(
    '2 Corinthians 4:6',
    'light',
    'For God, who commanded the {light} to shine out of darkness, hath shined in our hearts, to [give] the {light} of the knowledge of the glory of God in the face of Jesus Christ.',
  ),
  row(
    'Matthew 5:16',
    'light',
    '«Let your {light} so shine before men, that they may see your good works, and glorify your Father which is in heaven.»',
  ),
  row(
    'John 1:4-5',
    'light',
    'In him was {life}; and the {life} was the {light} of men. And the {light} shineth in darkness; and the darkness comprehended it not.',
  ),
  row(
    '1 John 1:5',
    'light',
    'This then is the message which we have heard of him, and declare unto you, that God is {light}, and in him is no darkness at all.',
  ),
  row(
    'Isaiah 9:2',
    'light',
    'The people that walked in darkness have seen a great {light}: they that dwell in the land of the shadow of death, upon them hath the {light} shined.',
  ),
  row(
    'Psalm 36:9',
    'light',
    'For with thee [is] the fountain of {life}: in thy {light} shall we see {light}.',
  ),
  row(
    'Psalm 23:2',
    'water',
    'He maketh me to lie down in green pastures: he leadeth me beside the still {waters}.',
  ),
  row(
    'Isaiah 55:1',
    'water',
    'Ho, every one that thirsteth, come ye to the {waters}, and he that hath no money; come ye, buy, and eat; yea, come, buy wine and milk without money and without price.',
  ),
  row(
    'John 4:14',
    'water',
    '«But whosoever drinketh of the water that I shall give him shall never thirst; but the water that I shall give him shall be in him a well of water springing up into everlasting {life}.»',
  ),
  row(
    'John 7:38',
    'water',
    '«He that believeth on me, as the scripture hath said, out of his belly shall flow rivers of {living water}.»',
  ),
  row(
    'Revelation 22:1',
    'water',
    'And he shewed me a pure river of water of {life}, clear as crystal, proceeding out of the throne of God and of the Lamb.',
  ),
  row(
    'Isaiah 43:2',
    'water',
    'When thou passest through the {waters}, I [will be] with thee; and through the rivers, they shall not overflow thee: when thou walkest through the fire, thou shalt not be burned; neither shall the flame kindle upon thee.',
  ),
  row(
    'Psalm 42:1',
    'water',
    'As the hart panteth after the {water brooks}, so panteth my soul after thee, O God.',
  ),
  row(
    'Isaiah 12:3',
    'water',
    'Therefore with joy shall ye draw {water} out of the wells of salvation.',
  ),
  row(
    'Psalm 1:3',
    'water',
    'And he shall be like a tree planted by the rivers of {water}, that bringeth forth his fruit in his season; his leaf also shall not wither; and whatsoever he doeth shall prosper.',
  ),
  row(
    'Jeremiah 17:8',
    'water',
    'For he shall be as a tree planted by the {waters}, and [that] spreadeth out her roots by the river, and shall not see when heat cometh, but her leaf shall be green; and shall not be careful in the year of drought, neither shall cease from yielding fruit.',
  ),
  row(
    'Psalm 119:105',
    'lamp',
    'Thy word [is] a {lamp} unto my feet, and a {light} unto my path.',
  ),
  row(
    'Proverbs 6:23',
    'lamp',
    'For the commandment [is] a {lamp}; and the law [is] {light}; and reproofs of instruction [are] the way of {life}:',
  ),
  row(
    'Matthew 5:15',
    'lamp',
    '«Neither do men light a candle, and put it under a bushel, but on a candlestick; and it giveth {light} unto all that are in the house.»',
  ),
  row(
    'Psalm 18:28',
    'lamp',
    'For thou wilt light my {candle}: the LORD my God will enlighten my darkness.',
  ),
  row(
    '2 Samuel 22:29',
    'lamp',
    'For thou [art] my {lamp}, O LORD: and the LORD will lighten my darkness.',
  ),
  row(
    'Job 29:3',
    'lamp',
    'When his {candle} shined upon my head, [and when] by his {light} I walked [through] darkness;',
  ),
  row(
    'John 15:5',
    'vine',
    '«{I am} the {vine}, ye [are] the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.»',
  ),
  row('John 15:1', 'vine', '«{I am} the true {vine}, and my Father is the husbandman.»'),
  row(
    'John 15:4',
    'vine',
    '«Abide in me, and I in you. As the branch cannot bear fruit of itself, except it abide in the {vine}; no more can ye, except ye abide in me.»',
  ),
  row(
    'Psalm 80:8',
    'vine',
    'Thou hast brought a {vine} out of Egypt: thou hast cast out the heathen, and planted it.',
  ),
  row(
    'Hosea 14:7',
    'vine',
    'They that dwell under his shadow shall return; they shall revive [as] the corn, and grow as the {vine}: the scent thereof [shall be] as the wine of Lebanon.',
  ),
  row(
    'John 14:19',
    'life',
    '«Yet a little while, and the world seeth me no more; but ye see me: because I {live}, ye shall {live} also.»',
  ),
  row(
    'John 11:25',
    'life',
    'Jesus said unto her, «{I am} the {resurrection}, and the {life}: he that believeth in me, though he were dead, yet shall he {live}:»',
  ),
  row(
    'John 14:6',
    'life',
    'Jesus saith unto him, «{I am} the {way}, the {truth}, and the {life}: no man cometh unto the Father, but by me.»',
  ),
  row(
    'John 3:16',
    'life',
    '«For God so {loved} the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting {life}.»',
  ),
  row(
    'Romans 6:4',
    'life',
    'Therefore we are buried with him by baptism into death: that like as Christ was raised up from the dead by the glory of the Father, even so we also should walk in newness of {life}.',
  ),
  row(
    'Galatians 2:20',
    'life',
    'I am crucified with Christ: nevertheless I {live}; yet not I, but Christ liveth in me: and the {life} which I now live in the flesh I live by the faith of the Son of God, who {loved} me, and gave himself for me.',
  ),
  row(
    '1 Corinthians 15:3-4',
    'life',
    'For I delivered unto you first of all that which I also received, how that Christ died for our sins according to the scriptures; And that he was buried, and that he {rose again} the third day according to the scriptures:',
  ),
  row(
    'John 10:10',
    'life',
    '«The thief cometh not, but for to steal, and to kill, and to destroy: I am come that they might have {life}, and that they might have [it] more abundantly.»',
  ),
  row(
    'Colossians 3:1',
    'life',
    'If ye then be {risen} with Christ, seek those things which are above, where Christ sitteth on the right hand of God.',
  ),
  row(
    'Revelation 1:18',
    'life',
    '«I [am] he that {liveth}, and was dead; and, behold, I am {alive} for evermore, Amen; and have the keys of hell and of death.»',
  ),
  row(
    '1 John 5:11',
    'life',
    'And this is the record, that God hath given to us eternal {life}, and this {life} is in his Son.',
  ),
  row(
    'Romans 8:11',
    'life',
    'But if the Spirit of him that {raised up} Jesus from the dead dwell in you, he that raised up Christ from the dead shall also quicken your mortal bodies by his Spirit that dwelleth in you.',
  ),
  row(
    'John 6:35',
    'life',
    'And Jesus said unto them, «{I am} the bread of {life}: he that cometh to me shall never hunger; and he that believeth on me shall never thirst.»',
  ),
  row(
    'Luke 24:6',
    'life',
    'He is not here, but is {risen}: remember how he spake unto you when he was yet in Galilee,',
  ),
  row(
    'Psalm 16:11',
    'life',
    'Thou wilt shew me the path of {life}: in thy presence [is] fulness of joy; at thy right hand [there are] pleasures for evermore.',
  ),
  row(
    'Isaiah 55:10-11',
    'water',
    'For as the rain cometh down, and the snow from heaven, and returneth not thither, but watereth the earth, and maketh it bring forth and bud, that it may give seed to the sower, and bread to the eater: So shall my {word} be that goeth forth out of my mouth: it shall not return unto me void, but it shall accomplish that which I please, and it shall prosper [in the thing] whereto I sent it.',
  ),
  row(
    'John 1:9',
    'light',
    '[That] was the true {Light}, which lighteth every man that cometh into the world.',
  ),
]
