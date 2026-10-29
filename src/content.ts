import { askVerdict, send } from './messages'
import { matchingEntry, pageOf, siteOf } from './sites'
import { allowanceLeft, getStorage } from './storage'
import { isBlockPageShown, showBlockPage } from './block_page'
import injectOptionsToOnboarding from './onboarding_options'

const ONBOARDING_URLS: string[] = [
  'https://getreflect.app/onboarding/',
  'http://localhost:1313/onboarding/',
]

let recheckTimer: number = 0

if (ONBOARDING_URLS.includes(window.location.href)) {
  injectOptionsToOnboarding()
} else {
  checkIfBlocked()
  window.addEventListener('focus', checkIfBlocked)
}

function checkIfBlocked(): void {
  if (isBlockPageShown()) return

  getStorage().then((settings) => {
    const url: string = window.location.href
    if (
      !settings.isEnabled ||
      isLinkRedirect(url) ||
      matchingEntry(url, settings.blockedSites) === undefined
    ) {
      return
    }

    const site: string = siteOf(url)
    const left: number = allowanceLeft(settings.whitelistedSites, site)
    window.clearTimeout(recheckTimer)
    if (left > 0) {
      recheckTimer = window.setTimeout(checkIfBlocked, left)
      return
    }

    showBlockPage({
      domain: site,
      minutes: settings.whitelistTime,
      question: settings.customMessage || 'hey! what are you here for?',
      blobs: settings.enableBlobs,
      shadedBlobs: settings.enable3D,
      judge: askVerdict,
      onFirstInput: () => send({ type: 'warmUp' }),
    })
  })
}

function isLinkRedirect(url: string): boolean {
  return siteOf(url) === 'l.facebook.com' || pageOf(url).startsWith('facebook.com/flx')
}
