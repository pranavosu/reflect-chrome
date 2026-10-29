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

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: ONBOARDING_URL, active: true })
    await setStorage({ ...structuredClone(DEFAULTS), blockedSites: [...DEFAULT_BLOCKED_SITES] })
  } else if (reason === 'update') {
    await setStorage({ isEnabled: true })
  }
  setIcon((await getStorage()).isEnabled)
  chrome.contextMenus.removeAll(createContextMenus)
})

chrome.runtime.onStartup.addListener(async () => {
  setIcon((await getStorage()).isEnabled)
})

function setIcon(enabled: boolean): void {
  const path: string = enabled ? '/res/on.png' : '/res/off.png'
  chrome.action.setIcon({ path }).catch((err) => console.warn('Could not set icon', err))
}

onSettingsChanged(async (changes) => {
  if (changes.isEnabled) {
    setIcon(changes.isEnabled.newValue ?? DEFAULTS.isEnabled)
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
    warmUpSelectedModel()
  }
})

async function reloadActiveTabIfMatching(entries: readonly string[]): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id !== undefined && matchingEntry(tab.url, entries) !== undefined) {
    chrome.tabs.reload(tab.id)
  }
}

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

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  switch (message.type) {
    case 'warmUp':
      warmUpSelectedModel()
      return false
    case 'intent': {
      const site: string = siteOf(sender.tab?.url)
      decideIntent(message.intent, site).then((result) => {
        sendResponse(result)
        return recordIntent(message.intent, site, result)
      })
      return true
    }
  }
})

listenForBadgeTriggers()
