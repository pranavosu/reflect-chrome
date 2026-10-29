export interface IntentModel {
  warmUp(): Promise<void>
  score(intent: string): Promise<number>
}

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
