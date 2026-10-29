// badge.ts shows how much allowed time is left on the active tab's site.
//
// While the active tab is an allowed site, the worker ticks once a second. The
// tabs.query in each tick also keeps Chrome from stopping the worker mid-countdown.
// Otherwise the ticker stops, and tab, window and storage events restart it.
import { siteOf } from './sites'
import { allowanceLeft, getStorage, onSettingsChanged } from './storage'
import { Settings } from './types'

const BADGE_COLOUR: string = '#576ca8'

type BadgeSettings = Pick<Settings, 'isEnabled' | 'whitelistedSites'>

let ticker: ReturnType<typeof setInterval> | undefined
// read once per worker lifetime and again whenever the relevant settings change
let settings: Promise<BadgeSettings> | undefined
let shownText: string | undefined

export function listenForBadgeTriggers(): void {
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOUR })

  chrome.tabs.onActivated.addListener(startTicker)
  chrome.windows.onFocusChanged.addListener(startTicker)
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url !== undefined || changeInfo.status === 'complete') {
      startTicker()
    }
  })
  onSettingsChanged((changes) => {
    if (changes.whitelistedSites || changes.isEnabled) {
      settings = undefined
      startTicker()
    }
  })

  startTicker()
}

function loadSettings(): Promise<BadgeSettings> {
  settings ??= getStorage().then(({ isEnabled, whitelistedSites }) => ({
    isEnabled,
    whitelistedSites,
  }))
  return settings
}

function startTicker(): void {
  if (ticker === undefined) {
    ticker = setInterval(updateBadge, 1000)
  }
  updateBadge()
}

function stopTicker(): void {
  clearInterval(ticker)
  ticker = undefined
}

async function updateBadge(): Promise<void> {
  const { isEnabled, whitelistedSites } = await loadSettings()
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  const left: number = isEnabled ? allowanceLeft(whitelistedSites, siteOf(tab?.url)) : 0

  setBadgeText(badgeText(left))
  if (left === 0) {
    stopTicker()
  }
}

function badgeText(ms: number): string {
  const seconds: number = Math.round(ms / 1000)
  if (seconds > 60) {
    return `${Math.round(seconds / 60)}m`
  }
  return seconds > 0 ? `${seconds}s` : ''
}

function setBadgeText(text: string): void {
  if (text !== shownText) {
    shownText = text
    chrome.action.setBadgeText({ text })
  }
}
