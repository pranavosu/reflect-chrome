// sites.ts is the one place that decides what "a site" and "a page" are, and
// whether a URL is on the block list. Pure functions only: the content script
// runs this on every page.

// only web pages can be blocked
function parse(url: string | undefined): URL | undefined {
  if (url === undefined) return undefined
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : undefined
  } catch {
    return undefined
  }
}

const trimSlashes = (path: string): string => path.replace(/\/+$/, '')

// a URL's site: its host, with any port, without a leading "www."
export function siteOf(url: string | undefined): string {
  return parse(url)?.host.replace(/^www\./, '') ?? ''
}

// a URL's page: its site plus path, ignoring the query, fragment and trailing slashes
export function pageOf(url: string | undefined): string {
  const parsed = parse(url)
  return parsed === undefined ? '' : trimSlashes(siteOf(url) + parsed.pathname)
}

// turn what someone typed ("YouTube.com", "www.youtube.com/", a pasted URL)
// into a block-list entry; undefined if it isn't a site
export function entryFor(input: string): string | undefined {
  const text: string = input.trim()
  if (text === '' || /\s/.test(text)) return undefined
  const url: string = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  const page: string = pageOf(url)
  return siteOf(url).includes('.') ? page : undefined
}

// the block-list entry that blocks this URL, if any. A site entry blocks exactly
// that site (not its subdomains); a page entry blocks exactly that page.
// Trimming entries keeps old "youtube.com/" entries blocking only the homepage.
export function matchingEntry(
  url: string | undefined,
  entries: readonly string[]
): string | undefined {
  const site: string = siteOf(url)
  if (site === '') return undefined
  const page: string = pageOf(url)
  return (
    entries.find((entry) => entry === site) ?? entries.find((entry) => trimSlashes(entry) === page)
  )
}
