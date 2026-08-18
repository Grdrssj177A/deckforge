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

export interface SerialPortInfo {
  path: string;
  manufacturer: string;
  vendorId: string;
  productId: string;
  friendlyName: string;
}

export interface DeckForgeAPI {
  system: {
    openUrl: (url: string) => Promise<{ success: boolean }>;
    openApp: (path: string) => Promise<{ success: boolean; error?: string }>;
    volumeUp: (step?: number) => Promise<{ success: boolean }>;
    volumeDown: (step?: number) => Promise<{ success: boolean }>;
    volumeMute: () => Promise<{ success: boolean }>;
    screenshot: (options?: { savePath?: string; format?: string; captureMode?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    lockScreen: () => Promise<{ success: boolean }>;
    selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
  };
  hotkey: {
    send: (keys: string, delay?: number) => Promise<{ success: boolean; error?: string }>;
  };
  sound: {
    selectFile: () => Promise<string | null>;
  };
  nanoleaf: {
    pair: (ip: string) => Promise<{ success: boolean; token?: string; error?: string }>;
    execute: (ip: string, token: string, command: string, params?: any) => Promise<{ success: boolean; error?: string }>;
    getEffects: (ip: string, token: string) => Promise<{ success: boolean; effects?: string[]; error?: string }>;
  };
  serial: {
    listPorts: () => Promise<{ success: boolean; ports: SerialPortInfo[]; error?: string }>;
    connect: (port: string, baudRate?: number) => Promise<{ success: boolean; port?: string; error?: string }>;
    disconnect: () => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<{ connected: boolean; port: string }>;
    onButtonPress: (callback: (buttonIndex: number) => void) => () => void;
    onStatus: (callback: (status: { connected: boolean; port: string; error?: string }) => void) => () => void;
  };
  discord: {
    connect: (options?: { clientId?: string; clientSecret?: string }) => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    disconnect: () => Promise<{ success: boolean }>;
    getState: () => Promise<{ connected: boolean; mute: boolean; deaf: boolean }>;
    toggleMute: () => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    toggleDeaf: () => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    setMute: (mute: boolean) => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    setDeaf: (deaf: boolean) => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    onVoiceState: (callback: (state: { mute: boolean; deaf: boolean }) => void) => () => void;
    onStatus: (callback: (status: { connected: boolean }) => void) => () => void;
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
