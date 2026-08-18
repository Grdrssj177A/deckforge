// ─── Plugin System ───────────────────────────────────────────────────────────

export type PluginId = 'soundboard' | 'hotkey' | 'obs' | 'discord' | 'nanoleaf' | 'system';

export interface ActionConfig {
  [key: string]: string | number | boolean | undefined;
}

export interface Action {
  id: string;
  pluginId: PluginId;
  name: string;
  icon: string;
  description: string;
  config: ActionConfig;
}

export interface Plugin {
  id: PluginId;
  name: string;
  icon: string;
  description: string;
  actions: Action[];
  execute: (action: Action) => Promise<void>;
  getDynamicIcon?: (action: Action) => string | undefined;
}

// ─── Deck / Grid ─────────────────────────────────────────────────────────────

export interface ButtonSlot {
  position: number; // 0..14 (3 columnas × 5 filas = 15 slots)
  action: Action | null;
  label?: string;
  color?: string;
  folderId?: string; // Si tiene valor, este botón es una carpeta que navega a esa página
}

export interface Page {
  id: string;
  name: string;
  icon: string;
  buttons: ButtonSlot[];
}

export interface Profile {
  id: string;
  name: string;
  buttons: ButtonSlot[];       // Página root
  pages: Page[];               // Sub-páginas (folders)
  createdAt: number;
  updatedAt: number;
}

// ─── Store / Context ─────────────────────────────────────────────────────────

export interface PluginState {
  plugins: Plugin[];
  executing: boolean;
}

// ─── Electron API (expuesta por preload) ─────────────────────────────────────

export interface DeckForgeAPI {
  app: {
    rendererReady: () => Promise<{ success: boolean }>;
  };
  actions: {
    execute: (params: { pluginId: string; actionId: string; config: any; context: any }) => Promise<{ success: boolean; error?: string }>;
    getState: (params: { pluginId: string; actionId: string; config: any }) => Promise<{ success: boolean; state: any }>;
  };
  plugins: {
    list: () => Promise<{ success: boolean; plugins: any[] }>;
  };
  system: {
    selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
  };
  sound: {
    selectFile: () => Promise<string | null>;
  };
  settings: {
    getAll: () => Promise<{ success: boolean; settings: any }>;
    update: (section: string, values: any) => Promise<{ success: boolean }>;
    migrate: (data: string) => Promise<{ success: boolean }>;
  };
  devices: {
    listAvailable: () => Promise<{ success: boolean; ports: any[]; error?: string }>;
    listConnected: () => Promise<{ success: boolean; devices: any[] }>;
    connect: (port: string, baudRate?: number) => Promise<{ success: boolean; deviceId?: string; error?: string }>;
    disconnect: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
    onButtonPress: (callback: (buttonIndex: number) => void) => () => void;
    onStatus: (callback: (status: { connected: boolean; deviceId: string }) => void) => () => void;
  };
  discord: {
    getState: () => Promise<{ connected: boolean; mute: boolean; deaf: boolean }>;
    onVoiceState: (callback: (state: { mute: boolean; deaf: boolean }) => void) => () => void;
    onStatus: (callback: (status: { connected: boolean }) => void) => () => void;
  };
  profiles: {
    getAll: () => Promise<{ profiles: any[]; activeId: string }>;
    setActive: (id: string) => Promise<{ success: boolean }>;
    create: (name: string) => Promise<{ success: boolean; profile: any }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    rename: (id: string, name: string) => Promise<{ success: boolean }>;
    duplicate: (id: string) => Promise<{ success: boolean; profile: any }>;
    assignAction: (profileId: string, pageId: string | null, position: number, action: any) => Promise<{ success: boolean }>;
    removeAction: (profileId: string, pageId: string | null, position: number) => Promise<{ success: boolean }>;
    moveButton: (profileId: string, pageId: string | null, from: number, to: number) => Promise<{ success: boolean }>;
    createFolder: (profileId: string, pageId: string | null, position: number, name: string, icon: string) => Promise<{ success: boolean; folderId: string }>;
    deleteFolder: (profileId: string, folderId: string) => Promise<{ success: boolean }>;
    migrate: (data: string) => Promise<{ success: boolean }>;
    export: (data: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    import: () => Promise<{ success: boolean; data?: string; error?: string }>;
  };
}

declare global {
  interface Window {
    deckforge?: DeckForgeAPI;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const MAX_BUTTONS = 36; // Máximo soportado (6x6)

export function createEmptyButtons(total?: number): ButtonSlot[] {
  const count = total || MAX_BUTTONS;
  return Array.from({ length: count }, (_, i) => ({
    position: i,
    action: null,
  }));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
