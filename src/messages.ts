// messages.ts is the contract between reflect's contexts: what block pages
// send the background worker, and the smart model's progress, which the
// worker shares with the options page through session storage.

export type Message = { type: 'warmUp' } | { type: 'intent'; intent: string }

// the background's verdict on a submitted intent
export type IntentResult = 'ok' | 'too_short' | 'invalid' | 'error'

export type SmartModelStatus =
  { state: 'loading'; progress: number } | { state: 'ready' } | { state: 'error'; message: string }

// fire-and-forget message to the background worker
export function send(message: Message): void {
  chrome.runtime.sendMessage(message).catch(() => {})
}

// ask the background worker to judge an intent
export async function askVerdict(intent: string): Promise<IntentResult> {
  const message: Message = { type: 'intent', intent }
  try {
    return await chrome.runtime.sendMessage(message)
  } catch {
    return 'error'
  }
}

const STATUS_KEY = 'smartModelStatus'

export function reportSmartModelStatus(status: SmartModelStatus): void {
  chrome.storage.session.set({ [STATUS_KEY]: status }).catch(() => {})
}

// call onChange with the current status now and whenever it changes
export function watchSmartModelStatus(
  onChange: (status: SmartModelStatus | undefined) => void
): void {
  chrome.storage.session
    .get<{ [STATUS_KEY]?: SmartModelStatus }>(STATUS_KEY)
    .then((items) => onChange(items[STATUS_KEY]))
  chrome.storage.session.onChanged.addListener((changes) => {
    // chrome types change values as unknown; only reportSmartModelStatus writes this key
    if (changes[STATUS_KEY]) onChange(changes[STATUS_KEY].newValue as SmartModelStatus | undefined)
  })
}
