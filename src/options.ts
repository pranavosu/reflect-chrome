import { watchSmartModelStatus } from './messages'
import { entryFor } from './sites'
import {
  addToBlocked,
  getStorage,
  onSettingsChanged,
  removeFromBlocked,
  setStorage,
} from './storage'
import { Settings, SettingsUpdate } from './types'
import { byId, showToggleShortcut } from './ui'

document.addEventListener('DOMContentLoaded', async () => {
  const storage = await getStorage()
  fillControls(storage)
  renderSites(storage)
  renderHistory(storage)
  bindControls()
  bindSites()
  showShortcut()
  bindSmartModelStatus()

  onSettingsChanged(async (changes) => {
    const sitesChanged = changes.blockedSites !== undefined
    const historyChanged =
      changes.intentList !== undefined || changes.numIntentEntries !== undefined
    if (!sitesChanged && !historyChanged) return
    const latest = await getStorage()
    if (sitesChanged) renderSites(latest)
    if (historyChanged) renderHistory(latest)
  })
})

function fillControls(storage: Settings): void {
  byId<HTMLInputElement>('whitelistTime').value = String(storage.whitelistTime)
  byId<HTMLInputElement>('minIntentLength').value = String(storage.minIntentLength)
  byId<HTMLInputElement>('numIntentEntries').value = String(storage.numIntentEntries)
  byId<HTMLInputElement>('customMessage').value = storage.customMessage
  byId<HTMLInputElement>('predictionThreshold').value = String(storage.predictionThreshold)
  byId<HTMLInputElement>('useSmartModel').checked = storage.intentModel === 'smart'
  byId<HTMLInputElement>('enableBlobs').checked = storage.enableBlobs
  byId<HTMLInputElement>('enable3D').checked = storage.enable3D
  showThreshold()
}

let savedTimer = 0
function save(values: SettingsUpdate): void {
  setStorage(values).then(() => {
    const saved = byId('saved')
    saved.textContent = 'saved.'
    window.clearTimeout(savedTimer)
    savedTimer = window.setTimeout(() => (saved.textContent = ''), 1500)
  })
}

function readNumber(id: string): number | null {
  const input = byId<HTMLInputElement>(id)
  const value = Math.round(Number(input.value))
  if (input.value.trim() === '' || Number.isNaN(value)) return null
  const clamped = Math.min(Number(input.max), Math.max(Number(input.min), value))
  input.value = String(clamped)
  return clamped
}

function showThreshold(): void {
  const value = Number(byId<HTMLInputElement>('predictionThreshold').value)
  byId('thresholdValue').textContent = `${Math.round(value * 100)}%`
}

function bindControls(): void {
  for (const id of ['whitelistTime', 'minIntentLength', 'numIntentEntries'] as const) {
    byId<HTMLInputElement>(id).addEventListener('change', () => {
      const value = readNumber(id)
      if (value !== null) save({ [id]: value })
    })
  }

  let messageTimer = 0
  const message = byId<HTMLInputElement>('customMessage')
  message.addEventListener('input', () => {
    window.clearTimeout(messageTimer)
    messageTimer = window.setTimeout(() => save({ customMessage: message.value.trim() }), 400)
  })

  const threshold = byId<HTMLInputElement>('predictionThreshold')
  threshold.addEventListener('input', showThreshold)
  threshold.addEventListener('change', () => save({ predictionThreshold: Number(threshold.value) }))

  const smart = byId<HTMLInputElement>('useSmartModel')
  smart.addEventListener('change', () =>
    save({ intentModel: smart.checked ? 'smart' : 'original' })
  )
  for (const id of ['enableBlobs', 'enable3D'] as const) {
    const toggle = byId<HTMLInputElement>(id)
    toggle.addEventListener('change', () => save({ [id]: toggle.checked }))
  }
}

function bindSites(): void {
  byId<HTMLFormElement>('addSite').addEventListener('submit', async (event) => {
    event.preventDefault()
    const input = byId<HTMLInputElement>('siteInput')
    const site: string | undefined = entryFor(input.value)
    const error = byId('siteError')

    if (site === undefined) {
      error.textContent = 'enter a site like youtube.com.'
      return
    }
    if (!(await addToBlocked(site))) {
      error.textContent = `${site} is already on the list.`
      return
    }
    error.textContent = ''
    input.value = ''
    input.focus()
  })
}

function renderSites(storage: Settings): void {
  const list = byId('siteList')
  const sites: string[] = storage.blockedSites
  list.replaceChildren()

  if (sites.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'empty'
    empty.textContent = 'no sites yet. add one above, like youtube.com.'
    list.append(empty)
    return
  }

  for (const site of sites) {
    const item = document.createElement('li')
    const name = document.createElement('span')
    name.textContent = site
    const remove = document.createElement('button')
    remove.className = 'remove'
    remove.textContent = 'remove.'
    remove.setAttribute('aria-label', `remove ${site}`)
    remove.addEventListener('click', () => removeFromBlocked(site))
    item.append(name, remove)
    list.append(item)
  }
}

function formatWhen(date: Date): string {
  const sameDay = date.toDateString() === new Date().toDateString()
  const time = date
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
  if (sameDay) return `today, ${time}`
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase()
  return `${day}, ${time}`
}

function renderHistory(storage: Settings): void {
  const entries = Object.entries(storage.intentList)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, storage.numIntentEntries)

  byId('history').hidden = entries.length === 0
  byId('historyEmpty').hidden = entries.length !== 0

  const rows = entries.map(([rawDate, entry]) => {
    const row = document.createElement('tr')
    const cell = (text: string, className?: string) => {
      const td = document.createElement('td')
      td.textContent = text
      if (className) td.className = className
      return td
    }

    const outcome = document.createElement('span')
    const accepted = entry.accepted === 'yes'
    outcome.className = `outcome ${accepted ? 'yes' : 'no'}`
    outcome.textContent =
      entry.accepted === undefined ? 'unknown' : accepted ? 'let in' : 'sent back'
    const outcomeCell = cell('')
    outcomeCell.append(outcome)

    row.append(
      cell(entry.intent, 'reason'),
      cell(entry.url),
      outcomeCell,
      cell(formatWhen(new Date(rawDate)))
    )
    return row
  })
  byId('historyRows').replaceChildren(...rows)
}

function bindSmartModelStatus(): void {
  const el = byId('smartModelStatus')
  watchSmartModelStatus((status) => {
    if (status === undefined) el.textContent = ''
    else if (status.state === 'loading') el.textContent = `loading the model… ${status.progress}%`
    else if (status.state === 'ready') el.textContent = 'ready.'
    else
      el.textContent =
        "couldn't load the model, so reflect is using the original one for now. it tries again the next time a block page opens."
  })
}

function showShortcut(): void {
  showToggleShortcut(byId('shortcutText'), 'no shortcut is set for turning reflect on or off.')
  byId('shortcutLink').addEventListener('click', () =>
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
  )
}
