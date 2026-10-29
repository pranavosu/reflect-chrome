// types.ts defines what reflect keeps in chrome storage.
// you shouldn't need to touch this unless you need to save something completely new to chrome storage!

export interface Intent {
  intent: string
  url: string
  accepted?: 'yes' | 'no'
}

// everything reflect stores. getStorage() always returns a complete Settings,
// filling anything missing from DEFAULTS in storage.ts
export interface Settings {
  // feature toggles
  isEnabled: boolean
  enableBlobs: boolean
  enable3D: boolean

  // lists
  blockedSites: string[]
  intentList: { [date: string]: Intent }
  customMessage: string
  whitelistedSites: { [site: string]: string }

  // misc config
  numIntentEntries: number
  whitelistTime: number
  predictionThreshold: number
  intentModel: 'original' | 'smart'
  minIntentLength: number
}

// a partial update, as passed to setStorage()
export type SettingsUpdate = Partial<Settings>
