// Supabase names its BroadcastChannel after storageKey. sessionStorage alone
// does not isolate those broadcasts. A document-specific SDK key prevents other
// tabs from receiving tokens; the adapter keeps this tab's session across reloads.
export function createTabAuthStorage() {
  const storageKey = `pnw-auth-${crypto.randomUUID()}`
  const persistedKey = 'pnw-pilot-auth'
  const keyFor = (key: string) =>
    key.startsWith(storageKey) ? persistedKey + key.slice(storageKey.length) : key
  return {
    storageKey,
    storage: {
      getItem: (key: string) => sessionStorage.getItem(keyFor(key)),
      setItem: (key: string, value: string) => sessionStorage.setItem(keyFor(key), value),
      removeItem: (key: string) => sessionStorage.removeItem(keyFor(key)),
    },
  }
}
