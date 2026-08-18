import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Profile, ButtonSlot, Action, Page, createEmptyButtons, generateId, MAX_BUTTONS } from '@/types';

interface ProfileContextValue {
  profiles: Profile[];
  activeProfile: Profile;
  currentPageId: string | null;
  currentButtons: ButtonSlot[];
  navigateToPage: (pageId: string) => void;
  navigateBack: () => void;
  pageStack: string[];
  createProfile: (name: string) => void;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  switchProfile: (id: string) => void;
  assignAction: (position: number, action: Action) => void;
  removeAction: (position: number) => void;
  updateButton: (position: number, updates: Partial<ButtonSlot>) => void;
  moveButton: (from: number, to: number) => void;
  createFolder: (name: string, icon: string, position: number) => void;
  deleteFolder: (pageId: string) => void;
  renameFolder: (pageId: string, name: string, icon: string) => void;
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

function createDefaultProfile(): Profile {
  return { id: generateId(), name: 'Default', buttons: createEmptyButtons(), pages: [], createdAt: Date.now(), updatedAt: Date.now() };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([createDefaultProfile()]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [pageStack, setPageStack] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const currentPageId = pageStack.length > 0 ? pageStack[pageStack.length - 1] : null;

  // Load profiles from main on mount
  useEffect(() => {
    if (!window.deckforge) {
      // Fallback for browser dev (no Electron)
      setLoaded(true);
      return;
    }

    window.deckforge.profiles.getAll().then((data) => {
      if (data.profiles && data.profiles.length > 0) {
        const migrated = data.profiles.map((p: Profile) => ({
          ...p,
          pages: (p.pages || []).map((pg: Page) => ({ ...pg, buttons: ensureButtonSlots(pg.buttons || []) })),
          buttons: ensureButtonSlots(p.buttons || []),
        }));
        setProfiles(migrated);
        setActiveProfileId(data.activeId || migrated[0].id);
      }
      setLoaded(true);
    });

    // Migrar localStorage si existe (primera vez después del refactor)
    const localData = localStorage.getItem('deckforge_profiles');
    if (localData) {
      window.deckforge.profiles.migrate(localData).then(() => {
        localStorage.removeItem('deckforge_profiles');
        localStorage.removeItem('deckforge_active_profile');
        // Recargar desde main
        window.deckforge!.profiles.getAll().then((data) => {
          if (data.profiles.length > 0) {
            const migrated = data.profiles.map((p: Profile) => ({
              ...p,
              pages: (p.pages || []).map((pg: Page) => ({ ...pg, buttons: ensureButtonSlots(pg.buttons || []) })),
              buttons: ensureButtonSlots(p.buttons || []),
            }));
            setProfiles(migrated);
            setActiveProfileId(data.activeId || migrated[0].id);
          }
        });
      });
    }
  }, []);

  // Reset page stack on profile change
  useEffect(() => { setPageStack([]); }, [activeProfileId]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const currentButtons = (() => {
    if (!currentPageId) return activeProfile.buttons;
    const page = activeProfile.pages.find((p) => p.id === currentPageId);
    return page ? page.buttons : activeProfile.buttons;
  })();

  // ─── Refresh helper ───────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!window.deckforge) return;
    const data = await window.deckforge.profiles.getAll();
    if (data.profiles.length > 0) {
      setProfiles(data.profiles.map((p: Profile) => ({
        ...p,
        pages: (p.pages || []).map((pg: Page) => ({ ...pg, buttons: ensureButtonSlots(pg.buttons || []) })),
        buttons: ensureButtonSlots(p.buttons || []),
      })));
      setActiveProfileId(data.activeId);
    }
  }, []);

  // ─── Navigation ───────────────────────────────────────────────────────────

  const navigateToPage = useCallback((pageId: string) => { setPageStack((prev) => [...prev, pageId]); }, []);
  const navigateBack = useCallback(() => { setPageStack((prev) => prev.slice(0, -1)); }, []);

  // ─── Commands (delegate to main via IPC) ──────────────────────────────────

  const createProfile = useCallback(async (name: string) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.create(name);
    await refresh();
  }, [refresh]);

  const deleteProfile = useCallback(async (id: string) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.delete(id);
    await refresh();
  }, [refresh]);

  const renameProfile = useCallback(async (id: string, name: string) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.rename(id, name);
    await refresh();
  }, [refresh]);

  const switchProfile = useCallback(async (id: string) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.setActive(id);
    setActiveProfileId(id);
  }, []);

  const assignAction = useCallback(async (position: number, action: Action) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.assignAction(activeProfileId, currentPageId, position, action);
    await refresh();
  }, [activeProfileId, currentPageId, refresh]);

  const removeAction = useCallback(async (position: number) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.removeAction(activeProfileId, currentPageId, position);
    await refresh();
  }, [activeProfileId, currentPageId, refresh]);

  const updateButton = useCallback(async (position: number, updates: Partial<ButtonSlot>) => {
    // For now, updateButton uses assignAction if there's a new action
    if (updates.action) {
      await assignAction(position, updates.action);
    }
  }, [assignAction]);

  const moveButton = useCallback(async (from: number, to: number) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.moveButton(activeProfileId, currentPageId, from, to);
    await refresh();
  }, [activeProfileId, currentPageId, refresh]);

  const createFolder = useCallback(async (name: string, icon: string, position: number) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.createFolder(activeProfileId, currentPageId, position, name, icon);
    await refresh();
  }, [activeProfileId, currentPageId, refresh]);

  const deleteFolder = useCallback(async (pageId: string) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.deleteFolder(activeProfileId, pageId);
    if (currentPageId === pageId) setPageStack((prev) => prev.filter((id) => id !== pageId));
    await refresh();
  }, [activeProfileId, currentPageId, refresh]);

  const renameFolder = useCallback(async (_pageId: string, _name: string, _icon: string) => {
    // Renaming folder = rename the page (not implemented in ProfileManager yet, but we can add later)
    // For now just refresh
    await refresh();
  }, [refresh]);

  return (
    <ProfileCtx.Provider value={{
      profiles, activeProfile, currentPageId, currentButtons, navigateToPage, navigateBack, pageStack,
      createProfile, deleteProfile, renameProfile, switchProfile,
      assignAction, removeAction, updateButton, moveButton,
      createFolder, deleteFolder, renameFolder,
    }}>
      {loaded ? children : null}
    </ProfileCtx.Provider>
  );
}

export function useProfiles(): ProfileContextValue {
  const ctx = useContext(ProfileCtx);
  if (!ctx) throw new Error('useProfiles must be used within ProfileProvider');
  return ctx;
}
