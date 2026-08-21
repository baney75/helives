/** Bible Gateway KJV lookup. Do not scrape or iframe. */
export function bibleGatewayHref(gatewayQuery: string): string {
  const params = new URLSearchParams({
    search: gatewayQuery,
    version: 'KJV',
  })
  return `https://www.biblegateway.com/passage/?${params.toString()}`
}
