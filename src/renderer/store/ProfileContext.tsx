import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Profile, ButtonSlot, Action, Page, createEmptyButtons, generateId, MAX_BUTTONS } from '@/types';
import { useNotification } from '@/store/NotificationContext';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProfileContext');

interface ProfileContextValue {
  profiles: Profile[];
  activeProfile: Profile;
  currentPageId: string | null;
  currentButtons: ButtonSlot[];
  navigateToPage: (pageId: string) => void;
  navigateBack: () => void;
  pageStack: string[];
  refresh: () => Promise<void>;
  createProfile: (name: string) => Promise<boolean>;
  deleteProfile: (id: string) => Promise<boolean>;
  renameProfile: (id: string, name: string) => Promise<boolean>;
  switchProfile: (id: string) => Promise<boolean>;
  assignAction: (position: number, action: Action) => Promise<boolean>;
  removeAction: (position: number) => Promise<boolean>;
  updateButton: (position: number, updates: Partial<ButtonSlot>) => Promise<boolean>;
  moveButton: (from: number, to: number) => Promise<boolean>;
  createFolder: (name: string, icon: string, position: number) => Promise<boolean>;
  deleteFolder: (pageId: string) => Promise<boolean>;
}

const ProfileCtx = createContext<ProfileContextValue | null>(null);

function ensureButtonSlots(buttons: ButtonSlot[]): ButtonSlot[] {
  if (buttons.length >= MAX_BUTTONS) return buttons;
  const extra = Array.from({ length: MAX_BUTTONS - buttons.length }, (_, i) => ({
    position: buttons.length + i,
    action: null as Action | null,
  }));
  return [...buttons, ...extra];
}

function normalize(profiles: Profile[]): Profile[] {
  return profiles.map((p: Profile) => ({
    ...p,
    pages: (p.pages || []).map((pg: Page) => ({ ...pg, buttons: ensureButtonSlots(pg.buttons || []) })),
    buttons: ensureButtonSlots(p.buttons || []),
  }));
}

function createDefaultProfile(): Profile {
  return { id: generateId(), name: 'Default', buttons: createEmptyButtons(), pages: [], createdAt: Date.now(), updatedAt: Date.now() };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { showInfo } = useNotification();
  const [profiles, setProfiles] = useState<Profile[]>([createDefaultProfile()]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [pageStack, setPageStack] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const currentPageId = pageStack.length > 0 ? pageStack[pageStack.length - 1] : null;

  /**
   * Informa de un fallo del main. El Core ya no devuelve `success: true` a
   * ciegas, así que aquí es donde el usuario se entera de que su cambio no
   * llegó a guardarse.
   */
  const report = useCallback(
    (operation: string, res: { success: boolean; error?: string }): boolean => {
      if (!res.success) {
        log.error(`${operation} failed: ${res.error ?? 'unknown error'}`);
        showInfo({
          title: 'No se pudo completar la operación',
          content: res.error || `Falló: ${operation}`,
        });
      }
      return res.success;
    },
    [showInfo]
  );

  const applyProfiles = useCallback((data: { profiles: Profile[]; activeId: string }) => {
    if (!data?.profiles?.length) return;
    const normalized = normalize(data.profiles);
    setProfiles(normalized);
    setActiveProfileId(data.activeId || normalized[0].id);
  }, []);

  // Load profiles from main on mount
  useEffect(() => {
    if (!window.deckforge) {
      // Fallback for browser dev (no Electron)
      setLoaded(true);
      return;
    }
    const api = window.deckforge;

    (async () => {
      try {
        // La migración va primero: si hay datos en localStorage, deben estar en
        // el main antes de la primera lectura, o se pisarían entre sí.
        const localData = localStorage.getItem('deckforge_profiles');
        if (localData) {
          const res = await api.profiles.migrate(localData);
          if (res.success) {
            localStorage.removeItem('deckforge_profiles');
            localStorage.removeItem('deckforge_active_profile');
          } else {
            log.error(`Profile migration failed: ${res.error ?? 'unknown error'}`);
          }
        }

        applyProfiles(await api.profiles.getAll());
      } catch (e) {
        // Sin esto, un fallo aquí dejaba `loaded` en false y la ventana en blanco.
        log.error('Could not load profiles from main:', e);
        showInfo({
          title: 'Error al cargar perfiles',
          content: 'No se pudo contactar con el proceso principal. Se usará un perfil vacío.',
        });
      } finally {
        setLoaded(true);
      }
    })();
  }, [applyProfiles, showInfo]);

  // Reset page stack on profile change
  useEffect(() => { setPageStack([]); }, [activeProfileId]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const currentButtons = useMemo(() => {
    if (!currentPageId) return activeProfile.buttons;
    const page = activeProfile.pages.find((p) => p.id === currentPageId);
    return page ? page.buttons : activeProfile.buttons;
  }, [activeProfile, currentPageId]);

  // ─── Refresh helper ───────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!window.deckforge) return;
    try {
      applyProfiles(await window.deckforge.profiles.getAll());
    } catch (e) {
      log.error('Refresh failed:', e);
    }
  }, [applyProfiles]);

  // ─── Navigation ───────────────────────────────────────────────────────────

  const navigateToPage = useCallback((pageId: string) => { setPageStack((prev) => [...prev, pageId]); }, []);
  const navigateBack = useCallback(() => { setPageStack((prev) => prev.slice(0, -1)); }, []);

  // ─── Commands (delegate to main via IPC) ──────────────────────────────────

  const createProfile = useCallback(async (name: string) => {
    if (!window.deckforge) return false;
    const ok = report('crear perfil', await window.deckforge.profiles.create(name));
    if (ok) await refresh();
    return ok;
  }, [refresh, report]);

  const deleteProfile = useCallback(async (id: string) => {
    if (!window.deckforge) return false;
    const ok = report('eliminar perfil', await window.deckforge.profiles.delete(id));
    if (ok) await refresh();
    return ok;
  }, [refresh, report]);

  const renameProfile = useCallback(async (id: string, name: string) => {
    if (!window.deckforge) return false;
    const ok = report('renombrar perfil', await window.deckforge.profiles.rename(id, name));
    if (ok) await refresh();
    return ok;
  }, [refresh, report]);

  const switchProfile = useCallback(async (id: string) => {
    if (!window.deckforge) return false;
    const ok = report('cambiar de perfil', await window.deckforge.profiles.setActive(id));
    if (ok) setActiveProfileId(id);
    return ok;
  }, [report]);

  const assignAction = useCallback(async (position: number, action: Action) => {
    if (!window.deckforge) return false;
    const ok = report(
      'asignar acción',
      await window.deckforge.profiles.assignAction(activeProfileId, currentPageId, position, action)
    );
    if (ok) await refresh();
    return ok;
  }, [activeProfileId, currentPageId, refresh, report]);

  const removeAction = useCallback(async (position: number) => {
    if (!window.deckforge) return false;
    const ok = report(
      'eliminar acción',
      await window.deckforge.profiles.removeAction(activeProfileId, currentPageId, position)
    );
    if (ok) await refresh();
    return ok;
  }, [activeProfileId, currentPageId, refresh, report]);

  const updateButton = useCallback(async (position: number, updates: Partial<ButtonSlot>) => {
    if (!updates.action) return false;
    return assignAction(position, updates.action);
  }, [assignAction]);

  const moveButton = useCallback(async (from: number, to: number) => {
    if (!window.deckforge) return false;
    const ok = report(
      'mover botón',
      await window.deckforge.profiles.moveButton(activeProfileId, currentPageId, from, to)
    );
    if (ok) await refresh();
    return ok;
  }, [activeProfileId, currentPageId, refresh, report]);

  const createFolder = useCallback(async (name: string, icon: string, position: number) => {
    if (!window.deckforge) return false;
    const ok = report(
      'crear carpeta',
      await window.deckforge.profiles.createFolder(activeProfileId, currentPageId, position, name, icon)
    );
    if (ok) await refresh();
    return ok;
  }, [activeProfileId, currentPageId, refresh, report]);

  const deleteFolder = useCallback(async (pageId: string) => {
    if (!window.deckforge) return false;
    const ok = report('eliminar carpeta', await window.deckforge.profiles.deleteFolder(activeProfileId, pageId));
    if (ok) {
      setPageStack((prev) => prev.filter((id) => id !== pageId));
      await refresh();
    }
    return ok;
  }, [activeProfileId, refresh, report]);

  // El valor se memoiza: antes se recreaba en cada render y obligaba a
  // re-renderizar a todos los consumidores (los 36 botones del grid).
  const value = useMemo<ProfileContextValue>(() => ({
    profiles, activeProfile, currentPageId, currentButtons, pageStack,
    navigateToPage, navigateBack, refresh,
    createProfile, deleteProfile, renameProfile, switchProfile,
    assignAction, removeAction, updateButton, moveButton,
    createFolder, deleteFolder,
  }), [
    profiles, activeProfile, currentPageId, currentButtons, pageStack,
    navigateToPage, navigateBack, refresh,
    createProfile, deleteProfile, renameProfile, switchProfile,
    assignAction, removeAction, updateButton, moveButton,
    createFolder, deleteFolder,
  ]);

  return (
    <ProfileCtx.Provider value={value}>
      {loaded ? children : null}
    </ProfileCtx.Provider>
  );
}

export function useProfiles(): ProfileContextValue {
  const ctx = useContext(ProfileCtx);
  if (!ctx) throw new Error('useProfiles must be used within ProfileProvider');
  return ctx;
}
