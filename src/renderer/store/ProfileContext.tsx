import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Profile, ButtonSlot, Action, Page, createEmptyButtons, generateId, MAX_BUTTONS } from '@/types';
import { saveProfiles, loadProfiles, saveActiveProfileId, loadActiveProfileId } from './persistence';

// Asegurar que un array de botones tenga al menos MAX_BUTTONS slots
function ensureButtonSlots(buttons: ButtonSlot[]): ButtonSlot[] {
  if (buttons.length >= MAX_BUTTONS) return buttons;
  const extra = Array.from({ length: MAX_BUTTONS - buttons.length }, (_, i) => ({
    position: buttons.length + i,
    action: null as Action | null,
  }));
  return [...buttons, ...extra];
}

interface ProfileContextValue {
  profiles: Profile[];
  activeProfile: Profile;
  // Navegación de páginas
  currentPageId: string | null; // null = root
  currentButtons: ButtonSlot[];
  navigateToPage: (pageId: string) => void;
  navigateBack: () => void;
  pageStack: string[]; // para breadcrumb / nested folders
  // CRUD profiles
  createProfile: (name: string) => void;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  switchProfile: (id: string) => void;
  // Botones (opera sobre la página actual)
  assignAction: (position: number, action: Action) => void;
  removeAction: (position: number) => void;
  updateButton: (position: number, updates: Partial<ButtonSlot>) => void;
  moveButton: (from: number, to: number) => void;
  // Folders
  createFolder: (name: string, icon: string, position: number) => void;
  deleteFolder: (pageId: string) => void;
  renameFolder: (pageId: string, name: string, icon: string) => void;
}

const ProfileCtx = createContext<ProfileContextValue | null>(null);

function createDefaultProfile(): Profile {
  return {
    id: generateId(),
    name: 'Default',
    buttons: createEmptyButtons(),
    pages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    const saved = loadProfiles();
    if (saved && saved.length > 0) {
      // Migrar perfiles: asegurar que tengan 'pages' y suficientes slots
      return saved.map((p) => ({
        ...p,
        pages: (p.pages || []).map((pg) => ({ ...pg, buttons: ensureButtonSlots(pg.buttons) })),
        buttons: ensureButtonSlots(p.buttons),
      }));
    }
    return [createDefaultProfile()];
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    const savedId = loadActiveProfileId();
    if (savedId && profiles.some((p) => p.id === savedId)) return savedId;
    return profiles[0].id;
  });

  // Stack de navegación de páginas (para nested folders)
  const [pageStack, setPageStack] = useState<string[]>([]);
  const currentPageId = pageStack.length > 0 ? pageStack[pageStack.length - 1] : null;

  // Reset page stack cuando se cambia de perfil
  useEffect(() => {
    setPageStack([]);
  }, [activeProfileId]);

  // Persistir
  useEffect(() => { saveProfiles(profiles); }, [profiles]);
  useEffect(() => { saveActiveProfileId(activeProfileId); }, [activeProfileId]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  // Obtener los botones de la página actual
  const currentButtons = (() => {
    if (!currentPageId) return activeProfile.buttons;
    const page = activeProfile.pages.find((p) => p.id === currentPageId);
    return page ? page.buttons : activeProfile.buttons;
  })();

  // ─── Navegación ─────────────────────────────────────────────────────────

  const navigateToPage = useCallback((pageId: string) => {
    setPageStack((prev) => [...prev, pageId]);
  }, []);

  const navigateBack = useCallback(() => {
    setPageStack((prev) => prev.slice(0, -1));
  }, []);

  // ─── CRUD Profiles ──────────────────────────────────────────────────────

  const createProfile = useCallback((name: string) => {
    const newProfile = createDefaultProfile();
    newProfile.name = name;
    setProfiles((prev) => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
  }, []);

  const deleteProfile = useCallback(
    (id: string) => {
      setProfiles((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (next.length === 0) next.push(createDefaultProfile());
        if (activeProfileId === id) setActiveProfileId(next[0].id);
        return next;
      });
    },
    [activeProfileId]
  );

  const renameProfile = useCallback((id: string, name: string) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p))
    );
  }, []);

  const switchProfile = useCallback((id: string) => {
    setActiveProfileId(id);
  }, []);

  // ─── Helper: actualizar botones de la página actual ─────────────────────

  const updateCurrentPageButtons = useCallback(
    (updater: (buttons: ButtonSlot[]) => ButtonSlot[]) => {
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id !== activeProfileId) return p;

          if (!currentPageId) {
            // Root
            return { ...p, buttons: updater(p.buttons), updatedAt: Date.now() };
          } else {
            // Sub-página
            const pages = p.pages.map((page) => {
              if (page.id !== currentPageId) return page;
              return { ...page, buttons: updater(page.buttons) };
            });
            return { ...p, pages, updatedAt: Date.now() };
          }
        })
      );
    },
    [activeProfileId, currentPageId]
  );

  // ─── Botones ────────────────────────────────────────────────────────────

  const assignAction = useCallback(
    (position: number, action: Action) => {
      updateCurrentPageButtons((buttons) =>
        buttons.map((btn) =>
          btn.position === position ? { ...btn, action, label: action.name, folderId: undefined } : btn
        )
      );
    },
    [updateCurrentPageButtons]
  );

  const removeAction = useCallback(
    (position: number) => {
      updateCurrentPageButtons((buttons) =>
        buttons.map((btn) =>
          btn.position === position ? { ...btn, action: null, label: undefined, folderId: undefined } : btn
        )
      );
    },
    [updateCurrentPageButtons]
  );

  const updateButton = useCallback(
    (position: number, updates: Partial<ButtonSlot>) => {
      updateCurrentPageButtons((buttons) =>
        buttons.map((btn) => (btn.position === position ? { ...btn, ...updates } : btn))
      );
    },
    [updateCurrentPageButtons]
  );

  const moveButton = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      updateCurrentPageButtons((buttons) => {
        const fromBtn = buttons.find((b) => b.position === from);
        const toBtn = buttons.find((b) => b.position === to);
        if (!fromBtn || !toBtn) return buttons;
        return buttons.map((btn) => {
          if (btn.position === from) {
            return { ...btn, action: toBtn.action, label: toBtn.label, color: toBtn.color, folderId: toBtn.folderId };
          }
          if (btn.position === to) {
            return { ...btn, action: fromBtn.action, label: fromBtn.label, color: fromBtn.color, folderId: fromBtn.folderId };
          }
          return btn;
        });
      });
    },
    [updateCurrentPageButtons]
  );

  // ─── Folders ────────────────────────────────────────────────────────────

  const createFolder = useCallback(
    (name: string, icon: string, position: number) => {
      const pageId = generateId();
      const newPage: Page = {
        id: pageId,
        name,
        icon,
        buttons: createEmptyButtons(),
      };

      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id !== activeProfileId) return p;

          // Añadir la página
          const pages = [...p.pages, newPage];

          // Marcar el botón en la página actual como folder
          const updateButtons = (buttons: ButtonSlot[]) =>
            buttons.map((btn) =>
              btn.position === position
                ? { ...btn, action: null, label: name, folderId: pageId, color: undefined }
                : btn
            );

          if (!currentPageId) {
            return { ...p, pages, buttons: updateButtons(p.buttons), updatedAt: Date.now() };
          } else {
            const updatedPages = pages.map((page) => {
              if (page.id !== currentPageId) return page;
              return { ...page, buttons: updateButtons(page.buttons) };
            });
            return { ...p, pages: updatedPages, updatedAt: Date.now() };
          }
        })
      );
    },
    [activeProfileId, currentPageId]
  );

  const deleteFolder = useCallback(
    (pageId: string) => {
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id !== activeProfileId) return p;

          // Quitar la página
          const pages = p.pages.filter((pg) => pg.id !== pageId);

          // Limpiar cualquier botón que apunte a esta carpeta
          const cleanButtons = (buttons: ButtonSlot[]) =>
            buttons.map((btn) =>
              btn.folderId === pageId ? { ...btn, folderId: undefined, label: undefined } : btn
            );

          return {
            ...p,
            pages,
            buttons: cleanButtons(p.buttons),
            updatedAt: Date.now(),
          };
        })
      );
      // Si estamos dentro de esa carpeta, volver atrás
      if (currentPageId === pageId) {
        setPageStack((prev) => prev.filter((id) => id !== pageId));
      }
    },
    [activeProfileId, currentPageId]
  );

  const renameFolder = useCallback(
    (pageId: string, name: string, icon: string) => {
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id !== activeProfileId) return p;
          const pages = p.pages.map((pg) =>
            pg.id === pageId ? { ...pg, name, icon } : pg
          );

          // Actualizar label del botón que apunta a esta carpeta
          const updateLabel = (buttons: ButtonSlot[]) =>
            buttons.map((btn) =>
              btn.folderId === pageId ? { ...btn, label: name } : btn
            );

          return {
            ...p,
            pages,
            buttons: updateLabel(p.buttons),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [activeProfileId]
  );

  return (
    <ProfileCtx.Provider
      value={{
        profiles,
        activeProfile,
        currentPageId,
        currentButtons,
        navigateToPage,
        navigateBack,
        pageStack,
        createProfile,
        deleteProfile,
        renameProfile,
        switchProfile,
        assignAction,
        removeAction,
        updateButton,
        moveButton,
        createFolder,
        deleteFolder,
        renameFolder,
      }}
    >
      {children}
    </ProfileCtx.Provider>
  );
}

export function useProfiles(): ProfileContextValue {
  const ctx = useContext(ProfileCtx);
  if (!ctx) throw new Error('useProfiles must be used within ProfileProvider');
  return ctx;
}
