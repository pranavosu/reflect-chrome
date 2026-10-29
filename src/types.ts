export interface Intent {
  intent: string
  url: string
  accepted?: 'yes' | 'no'
}

export interface Settings {
  isEnabled: boolean
  enableBlobs: boolean
  enable3D: boolean

  blockedSites: string[]
  intentList: { [date: string]: Intent }
  customMessage: string
  whitelistedSites: { [site: string]: string }

  numIntentEntries: number
  whitelistTime: number
  predictionThreshold: number
  intentModel: 'original' | 'smart'
  minIntentLength: number
}

export type SettingsUpdate = Partial<Settings>
