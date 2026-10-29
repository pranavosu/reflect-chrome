export type Message = { type: 'warmUp' } | { type: 'intent'; intent: string }

export type IntentResult = 'ok' | 'too_short' | 'invalid' | 'error'

export type SmartModelStatus =
  { state: 'loading'; progress: number } | { state: 'ready' } | { state: 'error'; message: string }

export function send(message: Message): void {
  chrome.runtime.sendMessage(message).catch(() => {})
}

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

export function watchSmartModelStatus(
  onChange: (status: SmartModelStatus | undefined) => void
): void {
  chrome.storage.session
    .get<{ [STATUS_KEY]?: SmartModelStatus }>(STATUS_KEY)
    .then((items) => onChange(items[STATUS_KEY]))
  chrome.storage.session.onChanged.addListener((changes) => {
    if (changes[STATUS_KEY]) onChange(changes[STATUS_KEY].newValue as SmartModelStatus | undefined)
  })
}
