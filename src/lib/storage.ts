import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence.
 *
 * Deliberately total: every read resolves to `null` on any failure and every
 * write swallows its error. Saved cities are a convenience, not data the user
 * authored — losing them is a nuisance, but crashing the app on a corrupt or
 * unreadable value would be far worse. Callers treat `null` as "first launch".
 */

/**
 * Version is part of the key rather than the payload, so a schema change
 * orphans the old value instead of forcing a migration path for data that is
 * cheap to rebuild. Bump this whenever the persisted shape changes
 * incompatibly.
 */
export const STORAGE_KEYS = {
  appState: 'aurora:state:v1',
} as const;

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Unreadable or malformed — behave as though nothing was stored.
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable. Nothing here is worth interrupting for.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignored for the same reason as above.
  }
}
