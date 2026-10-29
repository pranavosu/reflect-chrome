// content.ts runs on every page. If the page is on the block list and not
// currently open after a good reason, it swaps the page for reflect's block page.
import { askVerdict, send } from './messages'
import { matchingEntry, pageOf, siteOf } from './sites'
import { allowanceLeft, getStorage } from './storage'
import { isBlockPageShown, showBlockPage } from './block_page'
import injectOptionsToOnboarding from './onboarding_options'

const ONBOARDING_URLS: string[] = [
  'https://getreflect.app/onboarding/',
  'http://localhost:1313/onboarding/',
]

// while a site is open after a good reason, checks again once the time runs out
let recheckTimer: number = 0

if (ONBOARDING_URLS.includes(window.location.href)) {
  injectOptionsToOnboarding()
} else {
  checkIfBlocked()
  // re-check whenever the page gets focus again
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
      // let the background start loading the intent model while the user types
      onFirstInput: () => send({ type: 'warmUp' }),
    })
  })
}

// facebook routes outbound links through these pages; let them pass through
function isLinkRedirect(url: string): boolean {
  return siteOf(url) === 'l.facebook.com' || pageOf(url).startsWith('facebook.com/flx')
}
