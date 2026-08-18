import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Configuración global por plugin - se auto-rellena en las acciones
export interface PluginSettings {
  nanoleaf: {
    ip: string;
    token: string;
  };
  obs: {
    host: string;
    password: string;
  };
  discord: {
    clientSecret: string;
  };
  grid: {
    cols: number;
    rows: number;
  };
}

const DEFAULT_SETTINGS: PluginSettings = {
  nanoleaf: { ip: '', token: '' },
  obs: { host: 'localhost:4455', password: '' },
  discord: { clientSecret: '' },
  grid: { cols: 3, rows: 5 },
};

const STORAGE_KEY = 'deckforge_plugin_settings';

function loadSettings(): PluginSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        // Merge con defaults para manejar campos nuevos que no existían antes
        return {
          nanoleaf: { ...DEFAULT_SETTINGS.nanoleaf, ...(parsed.nanoleaf || {}) },
          obs: { ...DEFAULT_SETTINGS.obs, ...(parsed.obs || {}) },
          discord: { ...DEFAULT_SETTINGS.discord, ...(parsed.discord || {}) },
          grid: { ...DEFAULT_SETTINGS.grid, ...(parsed.grid || {}) },
        };
      }
    }
  } catch {
    // Datos corruptos: eliminar y usar defaults
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: PluginSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

interface SettingsContextValue {
  settings: PluginSettings;
  updateSettings: (plugin: keyof PluginSettings, values: Partial<PluginSettings[keyof PluginSettings]>) => void;
  getPluginDefaults: (pluginId: string) => Record<string, string>;
}

const SettingsCtx = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PluginSettings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((plugin: keyof PluginSettings, values: Partial<PluginSettings[keyof PluginSettings]>) => {
    setSettings((prev) => ({
      ...prev,
      [plugin]: { ...prev[plugin], ...values },
    }));
  }, []);

  // Devuelve los valores por defecto para un plugin dado
  // Estos se inyectan en las acciones cuando ip/token/host están vacíos
  const getPluginDefaults = useCallback((pluginId: string): Record<string, string> => {
    switch (pluginId) {
      case 'nanoleaf':
        return { ip: settings.nanoleaf.ip, token: settings.nanoleaf.token };
      case 'obs':
        return { obsHost: settings.obs.host, obsPassword: settings.obs.password };
      case 'discord':
        return { clientSecret: settings.discord.clientSecret };
      default:
        return {};
    }
  }, [settings]);

  return (
    <SettingsCtx.Provider value={{ settings, updateSettings, getPluginDefaults }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

// Global ref para que los plugins accedan a settings sin hook
let globalGetDefaults: ((pluginId: string) => Record<string, string>) | null = null;

export function setGlobalGetDefaults(fn: (pluginId: string) => Record<string, string>) {
  globalGetDefaults = fn;
}

export function getPluginDefaultsGlobal(pluginId: string): Record<string, string> {
  return globalGetDefaults ? globalGetDefaults(pluginId) : {};
}
