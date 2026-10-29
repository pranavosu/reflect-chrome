// intent_model.ts is the shape both intent models share, and the lazy loading
// they both need: the service worker can restart at any time, so a model loads
// on first use and again only if loading failed.

export interface IntentModel {
  warmUp(): Promise<void>
  // the model's confidence, from 0 to 1, that the intent is a genuine reason
  score(intent: string): Promise<number>
}

// build a model from a loader and a scoring function over what it loaded
export function lazyModel<T>(
  load: () => Promise<T>,
  score: (loaded: T, intent: string) => number | Promise<number>
): IntentModel {
  let loading: Promise<T> | undefined
  const ready = (): Promise<T> => {
    loading ??= load().catch((err) => {
      loading = undefined
      throw err
    })
    return loading
  }
  return {
    warmUp: async () => {
      await ready()
    },
    score: async (intent) => score(await ready(), intent),
  }
}
