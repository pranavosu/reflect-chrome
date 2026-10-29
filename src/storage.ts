// storage.ts wraps chrome.storage.sync: defaults, typed reads and writes, and
// pure helpers for updating the lists reflect keeps.
import { Intent, Settings, SettingsUpdate } from './types'

// sites blocked on a fresh install
export const DEFAULT_BLOCKED_SITES: string[] = [
  'facebook.com',
  'x.com',
  'instagram.com',
  'youtube.com',
]

// values used for anything missing from storage
export const DEFAULTS: Settings = {
  isEnabled: true,
  enableBlobs: true,
  enable3D: true,
  blockedSites: [],
  intentList: {},
  customMessage: '',
  whitelistedSites: {},
  numIntentEntries: 20,
  whitelistTime: 5,
  predictionThreshold: 0.5,
  intentModel: 'original',
  minIntentLength: 3,
}

// numeric settings that older versions of reflect saved as strings
const NUMBER_KEYS = [
  'numIntentEntries',
  'whitelistTime',
  'predictionThreshold',
  'minIntentLength',
] as const

// everything reflect stores, with defaults for anything missing
export async function getStorage(): Promise<Settings> {
  const stored: SettingsUpdate = await chrome.storage.sync.get<SettingsUpdate>(null)
  // clone so callers that edit lists in place never touch DEFAULTS
  const settings: Settings = { ...structuredClone(DEFAULTS), ...stored }
  for (const key of NUMBER_KEYS) {
    settings[key] = Number(settings[key])
  }
  return settings
}

export function setStorage(update: SettingsUpdate): Promise<void> {
  return chrome.storage.sync.set(update)
}

export type SettingsChanges = {
  [K in keyof Settings]?: { oldValue?: Settings[K]; newValue?: Settings[K] }
}

// call listener whenever settings change, from any page, the worker, or another synced device
export function onSettingsChanged(listener: (changes: SettingsChanges) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    // chrome types change values as unknown; storage.sync only ever holds Settings
    if (area === 'sync') listener(changes as SettingsChanges)
  })
}

// ---- block list ----

// add an entry to the block list; resolves false if it was empty or already there
export async function addToBlocked(entry: string): Promise<boolean> {
  const { blockedSites } = await getStorage()
  if (entry === '' || blockedSites.includes(entry)) {
    return false
  }
  await setStorage({ blockedSites: [...blockedSites, entry] })
  return true
}

export async function removeFromBlocked(entry: string): Promise<void> {
  const { blockedSites } = await getStorage()
  await setStorage({ blockedSites: blockedSites.filter((e) => e !== entry) })
}

// ---- allowances: time a site stays open after a good reason ----

type Allowances = Settings['whitelistedSites']

// milliseconds left on a site's allowance, or 0 if it has none
export function allowanceLeft(allowances: Allowances, site: string): number {
  const expiry: string | undefined = allowances[site]
  return expiry === undefined ? 0 : Math.max(0, new Date(expiry).getTime() - Date.now())
}

// allowances with this site open for `minutes` more, dropping any that have expired
export function allowSite(
  allowances: Allowances,
  site: string,
  minutes: number,
  now: Date
): Allowances {
  const live = Object.entries(allowances).filter(([, expiry]) => new Date(expiry) > now)
  const expiry: string = new Date(now.getTime() + minutes * 60_000).toJSON()
  return { ...Object.fromEntries(live), [site]: expiry }
}

// ---- intent log ----

// the log with this entry added, keeping only the newest `max` entries.
// keys are ISO dates, so they sort by time
export function withIntent(
  log: Settings['intentList'],
  entry: Intent,
  now: Date,
  max: number
): Settings['intentList'] {
  const entries = [...Object.entries(log), [now.toJSON(), entry] as const].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )
  return Object.fromEntries(entries.slice(Math.max(0, entries.length - max)))
}
