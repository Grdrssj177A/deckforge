import { Profile } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('Persistence');

const STORAGE_KEY = 'deckforge_profiles';
const ACTIVE_PROFILE_KEY = 'deckforge_active_profile';

/**
 * Valida que un objeto tenga la estructura mínima de un Profile.
 * No valida en profundidad cada campo, pero detecta datos corruptos.
 */
function isValidProfile(obj: any): obj is Profile {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.buttons)
  );
}

export function saveProfiles(profiles: Profile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (error) {
    log.error('Error saving profiles', error);
  }
}

export function loadProfiles(): Profile[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      log.warn('Profiles data is not an array, resetting');
      return null;
    }

    // Filtrar profiles inválidos en vez de crashear
    const valid = parsed.filter(isValidProfile);
    if (valid.length < parsed.length) {
      log.warn(`Filtered ${parsed.length - valid.length} invalid profiles`);
    }

    return valid.length > 0 ? valid : null;
  } catch (error) {
    log.error('Error loading profiles (corrupt data?), resetting', error);
    // Eliminar datos corruptos para que no siga fallando
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    return null;
  }
}

export function saveActiveProfileId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  } catch (error) {
    log.error('Error saving active profile ID', error);
  }
}

export function loadActiveProfileId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY);
  } catch (error) {
    log.error('Error loading active profile ID', error);
    return null;
  }
}
