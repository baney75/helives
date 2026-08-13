type BrandMarkProps = {
  size?: number
  framed?: boolean
}

/** Latin cross with a point of light. Same geometry as /favicon.svg. */
export function BrandMark({ size = 24, framed = false }: BrandMarkProps) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      {framed ? (
        <rect x="0.5" y="0.5" width="15" height="15" fill="#07060a" stroke="#e8b86d" strokeWidth="1" />
      ) : null}
      <rect x="7" y="2" width="2" height="12" fill="currentColor" />
      <rect x="3" y="5" width="10" height="2" fill="currentColor" />
      <rect x="7" y="5" width="2" height="2" fill="#fff4d6" />
    </svg>
  )
}
