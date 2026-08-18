import React, { createContext, useContext, useCallback, useRef } from 'react';
import { Action, PluginState } from '@/types';
import { pluginRegistry } from '@/plugins';

const COOLDOWN_MS = 200;

interface PluginContextValue extends PluginState {
  executeAction: (action: Action, pageId?: string, profileId?: string) => Promise<void>;
  isActionBusy: (actionId: string) => boolean;
  getDynamicIcon: (action: Action) => string | undefined;
}

const PluginCtx = createContext<PluginContextValue | null>(null);

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const busyUntil = useRef<Map<string, number>>(new Map());

  const isActionBusy = useCallback((actionId: string): boolean => {
    const until = busyUntil.current.get(actionId);
    if (!until) return false;
    if (Date.now() >= until) { busyUntil.current.delete(actionId); return false; }
    return true;
  }, []);

  const executeAction = useCallback(async (action: Action, pageId?: string, profileId?: string) => {
    if (isActionBusy(action.id)) return;

    // Soundboard se ejecuta localmente en el renderer (Web Audio API)
    if (action.pluginId === 'soundboard') {
      const soundPlugin = pluginRegistry.find((p) => p.id === 'soundboard');
      if (soundPlugin) {
        busyUntil.current.set(action.id, Date.now() + 60000);
        try {
          await soundPlugin.execute(action);
        } finally {
          busyUntil.current.set(action.id, Date.now() + COOLDOWN_MS);
        }
      }
      return;
    }

    // El resto se ejecuta en el main process via IPC
    if (!window.deckforge) return;

    busyUntil.current.set(action.id, Date.now() + 60000);
    try {
      // Inyectar settings globales para nanoleaf
      const config = { ...action.config };

      const result = await window.deckforge.actions.execute({
        pluginId: action.pluginId,
        actionId: action.config.command as string || action.id,
        config,
        context: {
          deviceId: 'virtual',
          pageId: pageId || 'root',
          buttonId: 0,
          profileId: profileId || '',
          modifiers: { shift: false, ctrl: false, alt: false },
        },
      });

      if (!result.success && result.error && result.error !== 'cooldown') {
        throw new Error(result.error);
      }
    } finally {
      busyUntil.current.set(action.id, Date.now() + COOLDOWN_MS);
    }
  }, [isActionBusy]);

  const getDynamicIcon = useCallback((action: Action) => {
    // Soundboard: se ejecuta localmente, iconos dinámicos locales
    const plugin = pluginRegistry.find((p) => p.id === action.pluginId);
    if (plugin?.getDynamicIcon) {
      return plugin.getDynamicIcon(action);
    }
    return undefined;
  }, []);

  const state: PluginState = {
    plugins: pluginRegistry,
    executing: false,
  };

  return (
    <PluginCtx.Provider value={{ ...state, executeAction, isActionBusy, getDynamicIcon }}>
      {children}
    </PluginCtx.Provider>
  );
}

export function usePlugins(): PluginContextValue {
  const ctx = useContext(PluginCtx);
  if (!ctx) throw new Error('usePlugins must be used within PluginProvider');
  return ctx;
}
