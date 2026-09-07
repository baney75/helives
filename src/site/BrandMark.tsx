import { BRAND } from './brand.ts'

type BrandMarkProps = {
  size?: number
  framed?: boolean
}

/** A slender, flared Latin cross with an engraved edge of light. */
export function BrandMark({ size = 24, framed = false }: BrandMarkProps) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox={BRAND.viewBox}
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      {framed ? (
        <rect x="0.5" y="0.5" width="63" height="63" fill={BRAND.void} stroke={BRAND.gold} strokeWidth="1" />
      ) : null}
      <path d={BRAND.cross} fill="currentColor" />
      <path d={BRAND.light} fill={BRAND.dawn} />
    </svg>
  )
}
