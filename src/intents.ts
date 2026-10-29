// intents.ts judges the reasons people give on the block page: it picks the
// intent model, decides, opens the site for an accepted reason, and keeps the
// recent-reasons log.
import { IntentModel } from './intent_model'
import { IntentResult } from './messages'
import { originalModel } from './nn'
import { smartModel } from './smart_model'
import { allowSite, getStorage, setStorage, withIntent } from './storage'
import { Settings } from './types'

// both load lazily, on first use after each worker start
const models: Record<Settings['intentModel'], IntentModel> = {
  original: originalModel('acc85.95'),
  smart: smartModel(),
}

export function warmUpSelectedModel(): void {
  getStorage()
    .then(({ intentModel }) => models[intentModel].warmUp())
    .catch((err) => console.warn('Model warm-up failed', err))
}

// the chosen model's confidence. The smart model falls back to the original
// if it can't load, e.g. on first use while offline
async function confidence(intent: string, choice: Settings['intentModel']): Promise<number> {
  try {
    return await models[choice].score(intent)
  } catch (err) {
    if (choice === 'original') throw err
    console.warn('Smart model unavailable, using the original model', err)
    return models.original.score(intent)
  }
}

async function classify(intent: string, settings: Settings): Promise<IntentResult> {
  if (intent.split(' ').length <= settings.minIntentLength) {
    return 'too_short'
  }
  try {
    const score: number = await confidence(intent, settings.intentModel)
    return score > settings.predictionThreshold ? 'ok' : 'invalid'
  } catch (err) {
    console.error('Intent classification failed', err)
    return 'error'
  }
}

// judge an intent given on a site's block page. An accepted intent opens the
// site before the verdict is returned, so the block page's reload sees it
export async function decideIntent(intent: string, site: string): Promise<IntentResult> {
  const result: IntentResult = await classify(intent, await getStorage())
  if (result === 'ok') {
    // re-read: classifying can take a while the first time a model loads
    const { whitelistedSites, whitelistTime } = await getStorage()
    await setStorage({
      whitelistedSites: allowSite(whitelistedSites, site, whitelistTime, new Date()),
    })
  }
  return result
}

// add an intent to the recent-reasons log. The log is one sync item with an
// 8 KB limit, so a failure here is only logged, never shown to the user
export async function recordIntent(
  intent: string,
  site: string,
  result: IntentResult
): Promise<void> {
  try {
    const { intentList, numIntentEntries } = await getStorage()
    const entry = { intent, url: site, accepted: result === 'ok' ? 'yes' : 'no' } as const
    await setStorage({ intentList: withIntent(intentList, entry, new Date(), numIntentEntries) })
  } catch (err) {
    console.warn('Could not record intent', err)
  }
}
