# He Lives source audit

Checked September 7, 2026.

## Scripture

The local `KJV` inventory was compared with [Project Gutenberg eBook 10, King James Version](https://www.gutenberg.org/ebooks/10). All 36 stored strings use KJV wording. Several are excerpts from a cited range rather than complete verses. Genesis 3:6 omits the middle clause between “good for food” and “she took”; the interface therefore labels Scripture scene text as a KJV excerpt and links the full cited range. No verse was reconstructed with an LLM.

Audit source downloaded for a temporary, normalized word-sequence comparison:

```text
https://www.gutenberg.org/cache/epub/10/pg10.txt
```

## Cosmology

The primary links in `src/genesis/sources.ts` were opened again. NASA's current cosmic-history page supports an age near 13.8 billion years and describes the cosmic microwave background as the oldest observable light. ESA's Planck page supports the CMB's approximately 2.7 K temperature, its 1964 detection by Arno Penzias and Robert Wilson, and Planck's role in mapping its fluctuations.

- [NASA Science: Cosmic History](https://science.nasa.gov/universe/overview/)
- [NASA Science: The Big Bang](https://science.nasa.gov/universe/the-big-bang/)
- [ESA: Planck and the cosmic microwave background](https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_and_the_cosmic_microwave_background)
- [NASA GSFC: Murmur of a Bang](https://imagine.gsfc.nasa.gov/educators/programs/cosmictimes/educators/guide/1965/murmur.html)

The site keeps the theological reading and measurable cosmology separate. These sources support the scientific statements; they do not decide the theological claims.
