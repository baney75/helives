type BrandMarkProps = {
  size?: number
  framed?: boolean
}

/** Latin cross with a point of light at the crossing. Same geometry as /favicon.svg. */
export function BrandMark({ size = 24, framed = false }: BrandMarkProps) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      {framed ? (
        <rect x="2" y="2" width="44" height="44" rx="3" fill="#07060a" stroke="#e8b86d" strokeWidth="2.4" />
      ) : null}
      <rect x="21.4" y="8" width="5.2" height="33" rx="1.6" fill="currentColor" />
      <rect x="12" y="15.6" width="24" height="5.2" rx="1.6" fill="currentColor" />
      <rect
        x="21.35"
        y="15.55"
        width="5.3"
        height="5.3"
        rx="1"
        transform="rotate(45 24 18.2)"
        fill="#fff4d6"
      />
    </svg>
  )
}
