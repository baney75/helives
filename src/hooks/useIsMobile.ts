import { useEffect, useState } from 'react'

const QUERY = '(max-width: 800px)'

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false,
  )

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const onChange = () => {
      setMobile(media.matches)
    }
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return mobile
}
