export const CSP = [
  "default-src 'self'",
  // Cloudflare Web Analytics: the edge inserts its beacon script and it reports here. Nothing broader.
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ')

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
}

const BLOCKED_PREFIXES = [
  '/.env',
  '/.git',
  '/wp-admin',
  '/wp-login',
  '/xmlrpc.php',
  '/vendor/phpunit',
]

export function isBlockedPath(pathname: string): boolean {
  const path = pathname.toLowerCase()
  if (path.includes('..')) return true
  return BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/** SPA fallback must not impersonate missing narration files. */
export function isMissingStaticAsset(pathname: string, contentType: string | null): boolean {
  const path = pathname.toLowerCase()
  if (!path.startsWith('/audio/') || !path.endsWith('.mp3')) return false
  const type = contentType ?? ''
  return type.includes('text/html')
}

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value)
  }
  // HTML stays transformable so Cloudflare can insert its Web Analytics beacon; the CSP above
  // allows only that script host, so no other injected script can run.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
