import { matchingEntry, pageOf, siteOf } from './sites'
import {
  addToBlocked,
  allowanceLeft,
  getStorage,
  onSettingsChanged,
  removeFromBlocked,
  setStorage,
} from './storage'
import { Settings } from './types'
import { byId, showToggleShortcut } from './ui'

type PopupView =
  | { kind: 'unblockable' }
  | { kind: 'open'; site: string; page: string | undefined }
  | {
      kind: 'blocked'
      entry: string
      name: string
      isPage: boolean
      status: 'off' | 'blocked' | { openUntil: number }
    }

function popupView(settings: Settings, url: string | undefined, now: number): PopupView {
  const site: string = siteOf(url)
  if (site === '') {
    return { kind: 'unblockable' }
  }
  const page: string = pageOf(url)
  const entry: string | undefined = matchingEntry(url, settings.blockedSites)
  if (entry === undefined) {
    return { kind: 'open', site, page: page === site ? undefined : page }
  }

  const left: number = allowanceLeft(settings.whitelistedSites, site)
  const isPage: boolean = entry !== site
  return {
    kind: 'blocked',
    entry,
    name: isPage ? page : site,
    isPage,
    status: !settings.isEnabled ? 'off' : left > 0 ? { openUntil: now + left } : 'blocked',
  }
}

let tabUrl: string | undefined
let view: PopupView = { kind: 'unblockable' }
let countdown: number = 0

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  tabUrl = tab?.url

  const enabled = byId<HTMLInputElement>('enabled')
  enabled.addEventListener('change', () => setStorage({ isEnabled: enabled.checked }))
  byId('blockSite').addEventListener('click', () => {
    if (view.kind === 'open') addToBlocked(view.site)
    if (view.kind === 'blocked') removeFromBlocked(view.entry)
  })
  byId('blockPage').addEventListener('click', () => {
    if (view.kind === 'open' && view.page !== undefined) addToBlocked(view.page)
  })

  showToggleShortcut(byId('shortcut'))
  render(await getStorage())
  onSettingsChanged(async () => render(await getStorage()))
})

function render(settings: Settings): void {
  view = popupView(settings, tabUrl, Date.now())
  byId<HTMLInputElement>('enabled').checked = settings.isEnabled
  byId('enabledLabel').textContent = settings.isEnabled ? 'on.' : 'off.'

  const blockSite = byId<HTMLButtonElement>('blockSite')
  const blockPage = byId<HTMLButtonElement>('blockPage')
  window.clearInterval(countdown)

  switch (view.kind) {
    case 'unblockable':
      byId('siteName').textContent = 'this page.'
      setState("reflect can't block browser pages.")
      blockSite.hidden = blockPage.hidden = true
      break

    case 'open':
      byId('siteName').textContent = view.site
      setState('not blocked.')
      blockSite.hidden = false
      blockSite.textContent = `block ${view.site}.`
      blockSite.classList.add('primary')
      blockPage.hidden = view.page === undefined
      break

    case 'blocked':
      byId('siteName').textContent = view.name
      blockSite.hidden = false
      blockSite.textContent = view.isPage ? 'unblock this page.' : `unblock ${view.entry}.`
      blockSite.classList.remove('primary')
      blockPage.hidden = true
      if (view.status === 'off') setState('blocked, but reflect is off.')
      else if (view.status === 'blocked') setState('blocked.')
      else startCountdown(view.status.openUntil)
      break
  }
}

function setState(text: string): void {
  byId('siteState').textContent = text
}

function startCountdown(expiry: number): void {
  const tick = () => {
    const seconds = Math.max(0, Math.round((expiry - Date.now()) / 1000))
    const minutes = Math.floor(seconds / 60)
    const rest = String(seconds % 60).padStart(2, '0')
    setState(seconds > 0 ? `open for ${minutes}:${rest} more.` : 'blocked.')
    if (seconds === 0) window.clearInterval(countdown)
  }
  tick()
  countdown = window.setInterval(tick, 1000)
}
