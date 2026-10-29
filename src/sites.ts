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

export function siteOf(url: string | undefined): string {
  return parse(url)?.host.replace(/^www\./, '') ?? ''
}

export function pageOf(url: string | undefined): string {
  const parsed = parse(url)
  return parsed === undefined ? '' : trimSlashes(siteOf(url) + parsed.pathname)
}

export function entryFor(input: string): string | undefined {
  const text: string = input.trim()
  if (text === '' || /\s/.test(text)) return undefined
  const url: string = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  const page: string = pageOf(url)
  return siteOf(url).includes('.') ? page : undefined
}

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
