// background.ts is the extension's MV3 service worker. Chrome may stop it
// whenever it is idle, so every listener is registered synchronously at the top
// level and state lives in storage, not in memory.
//
// Settings change from many places (popup, options, shortcut, context menus,
// another synced device), so the worker reacts to storage changes instead of
// being told about them.
import { decideIntent, recordIntent, warmUpSelectedModel } from './intents'
import { Message } from './messages'
import { matchingEntry, pageOf, siteOf } from './sites'
import {
  DEFAULT_BLOCKED_SITES,
  DEFAULTS,
  addToBlocked,
  getStorage,
  onSettingsChanged,
  setStorage,
} from './storage'
import createContextMenus, { MENU_BLOCK_PAGE, MENU_BLOCK_SITE } from './context_menus'
import { listenForBadgeTriggers } from './badge'

const ONBOARDING_URL: string = 'https://getreflect.app/onboarding/'

// ---- lifecycle ----

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: ONBOARDING_URL, active: true })
    await setStorage({ ...structuredClone(DEFAULTS), blockedSites: [...DEFAULT_BLOCKED_SITES] })
  } else if (reason === 'update') {
    await setStorage({ isEnabled: true })
  }
  // set explicitly: the icon resets on install and update, and storage.onChanged
  // doesn't fire for writes that change nothing
  setIcon((await getStorage()).isEnabled)
  chrome.contextMenus.removeAll(createContextMenus)
})

chrome.runtime.onStartup.addListener(async () => {
  setIcon((await getStorage()).isEnabled)
})

// icon paths must be root-relative: the service worker lives in src/, and
// Chrome resolves relative paths against the worker's own location
function setIcon(enabled: boolean): void {
  const path: string = enabled ? '/res/on.png' : '/res/off.png'
  chrome.action.setIcon({ path }).catch((err) => console.warn('Could not set icon', err))
}

// ---- reactions to setting changes ----

onSettingsChanged(async (changes) => {
  if (changes.isEnabled) {
    setIcon(changes.isEnabled.newValue ?? DEFAULTS.isEnabled)
    // the active tab may have just become blocked or unblocked
    reloadActiveTabIfMatching((await getStorage()).blockedSites)
  }
  if (changes.blockedSites) {
    const before = changes.blockedSites.oldValue ?? []
    const after = changes.blockedSites.newValue ?? []
    const added = after.filter((entry) => !before.includes(entry))
    const removed = before.filter((entry) => !after.includes(entry))
    reloadActiveTabIfMatching([...added, ...removed])
  }
  if (changes.intentModel?.newValue === 'smart') {
    // start loading (and downloading, the first time) as soon as it's picked
    warmUpSelectedModel()
  }
})

async function reloadActiveTabIfMatching(entries: readonly string[]): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id !== undefined && matchingEntry(tab.url, entries) !== undefined) {
    chrome.tabs.reload(tab.id)
  }
}

// ---- user actions that write settings ----

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url: string | undefined = tab?.url ?? info.pageUrl
  if (info.menuItemId === MENU_BLOCK_PAGE) {
    addToBlocked(pageOf(url))
  } else if (info.menuItemId === MENU_BLOCK_SITE) {
    addToBlocked(siteOf(url))
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-blocker') {
    const { isEnabled } = await getStorage()
    await setStorage({ isEnabled: !isEnabled })
  }
})

// ---- block pages ----

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  switch (message.type) {
    case 'warmUp':
      // sent when you start typing, so the model is usually ready by the time you submit
      warmUpSelectedModel()
      return false
    case 'intent': {
      const site: string = siteOf(sender.tab?.url)
      decideIntent(message.intent, site).then((result) => {
        sendResponse(result)
        return recordIntent(message.intent, site, result)
      })
      return true // reply asynchronously
    }
  }
})

listenForBadgeTriggers()
