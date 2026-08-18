import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface PluginSettings {
  nanoleaf: { ip: string; token: string };
  obs: { host: string; password: string };
  discord: { clientSecret: string };
  grid: { cols: number; rows: number };
  audio: { outputDevice: string };
}

const DEFAULT_SETTINGS: PluginSettings = {
  nanoleaf: { ip: '', token: '' },
  obs: { host: 'localhost:4455', password: '' },
  discord: { clientSecret: '' },
  grid: { cols: 3, rows: 5 },
  audio: { outputDevice: '' },
};

interface SettingsContextValue {
  settings: PluginSettings;
  updateSettings: (section: keyof PluginSettings, values: Partial<PluginSettings[keyof PluginSettings]>) => void;
  getPluginDefaults: (pluginId: string) => Record<string, string>;
}

const SettingsCtx = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS);

  // Load settings from main on mount
  useEffect(() => {
    if (!window.deckforge) return;

    window.deckforge.settings.getAll().then((res) => {
      if (res.success && res.settings) {
        setSettings({
          nanoleaf: { ...DEFAULT_SETTINGS.nanoleaf, ...(res.settings.nanoleaf || {}) },
          obs: { ...DEFAULT_SETTINGS.obs, ...(res.settings.obs || {}) },
          discord: { ...DEFAULT_SETTINGS.discord, ...(res.settings.discord || {}) },
          grid: { ...DEFAULT_SETTINGS.grid, ...(res.settings.grid || {}) },
          audio: { ...DEFAULT_SETTINGS.audio, ...(res.settings.audio || {}) },
        });
      }
    });

    // Migrar localStorage si existe (primera vez después del refactor)
    const localData = localStorage.getItem('deckforge_plugin_settings');
    if (localData) {
      window.deckforge.settings.migrate(localData).then(() => {
        localStorage.removeItem('deckforge_plugin_settings');
        // Recargar desde main
        window.deckforge!.settings.getAll().then((res) => {
          if (res.success && res.settings) {
            setSettings({
              nanoleaf: { ...DEFAULT_SETTINGS.nanoleaf, ...(res.settings.nanoleaf || {}) },
              obs: { ...DEFAULT_SETTINGS.obs, ...(res.settings.obs || {}) },
              discord: { ...DEFAULT_SETTINGS.discord, ...(res.settings.discord || {}) },
              grid: { ...DEFAULT_SETTINGS.grid, ...(res.settings.grid || {}) },
              audio: { ...DEFAULT_SETTINGS.audio, ...(res.settings.audio || {}) },
            });
          }
        });
      });
    }
  }, []);

  const updateSettings = useCallback(async (section: keyof PluginSettings, values: Partial<PluginSettings[keyof PluginSettings]>) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...values },
    }));
    if (window.deckforge) {
      await window.deckforge.settings.update(section, values);
    }
  }, []);

  const getPluginDefaults = useCallback((pluginId: string): Record<string, string> => {
    switch (pluginId) {
      case 'nanoleaf': return { ip: settings.nanoleaf.ip, token: settings.nanoleaf.token };
      case 'obs': return { obsHost: settings.obs.host, obsPassword: settings.obs.password };
      case 'discord': return { clientSecret: settings.discord.clientSecret };
      default: return {};
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

// Global ref para plugins
let globalGetDefaults: ((pluginId: string) => Record<string, string>) | null = null;
export function setGlobalGetDefaults(fn: (pluginId: string) => Record<string, string>) { globalGetDefaults = fn; }
export function getPluginDefaultsGlobal(pluginId: string): Record<string, string> { return globalGetDefaults ? globalGetDefaults(pluginId) : {}; }
