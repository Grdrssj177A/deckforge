import React, { createContext, useContext, useCallback, useMemo, useRef } from 'react';
import { Action, PluginState } from '@/types';
import { pluginRegistry } from '@/plugins';

/** Enfriamiento local, solo para el soundboard (se ejecuta en el renderer). */
const SOUNDBOARD_COOLDOWN_MS = 200;

/** Identifica el botón concreto que dispara la acción. */
export interface ExecuteTarget {
  position: number;
  pageId: string | null;
  profileId: string;
}

interface PluginContextValue extends PluginState {
  executeAction: (action: Action, target: ExecuteTarget) => Promise<void>;
  getDynamicIcon: (action: Action) => string | undefined;
}

const PluginCtx = createContext<PluginContextValue | null>(null);

export function PluginProvider({ children }: { children: React.ReactNode }) {
  /**
   * El anti-spam de las acciones del main vive en el ActionManager, con una
   * clave que incluye dispositivo, perfil, página y botón. Aquí solo se protege
   * el soundboard, que nunca cruza el IPC.
   */
  const soundboardBusyUntil = useRef<Map<string, number>>(new Map());
  /** Ejecuciones en curso, para que una carga lenta no admita clics repetidos. */
  const soundboardInFlight = useRef<Set<string>>(new Set());

  const isSoundboardBusy = useCallback((actionId: string): boolean => {
    if (soundboardInFlight.current.has(actionId)) return true;
    const until = soundboardBusyUntil.current.get(actionId);
    if (until === undefined) return false;
    if (Date.now() >= until) {
      soundboardBusyUntil.current.delete(actionId);
      return false;
    }
    return true;
  }, []);

  const executeAction = useCallback(async (action: Action, target: ExecuteTarget) => {
    // Soundboard se ejecuta localmente en el renderer (Web Audio API)
    if (action.pluginId === 'soundboard') {
      if (isSoundboardBusy(action.id)) return;
      const soundPlugin = pluginRegistry.find((p) => p.id === 'soundboard');
      if (!soundPlugin) return;
      soundboardInFlight.current.add(action.id);
      try {
        await soundPlugin.execute(action);
      } finally {
        soundboardInFlight.current.delete(action.id);
        soundboardBusyUntil.current.set(action.id, Date.now() + SOUNDBOARD_COOLDOWN_MS);
      }
      return;
    }

    // El resto se ejecuta en el main process via IPC
    if (!window.deckforge) return;

    const result = await window.deckforge.actions.execute({
      pluginId: action.pluginId,
      actionId: (action.config.command as string) || action.id,
      config: { ...action.config },
      context: {
        deviceId: 'virtual',
        // Sin estos valores reales, todas las pulsaciones de la UI compartían
        // la clave de cooldown "virtual::root:0" y se bloqueaban entre sí.
        pageId: target.pageId || 'root',
        buttonId: target.position,
        profileId: target.profileId,
        modifiers: { shift: false, ctrl: false, alt: false },
      },
    });

    if (!result.success && result.error && result.error !== 'cooldown') {
      throw new Error(result.error);
    }
  }, [isSoundboardBusy]);

  const getDynamicIcon = useCallback((action: Action) => {
    const plugin = pluginRegistry.find((p) => p.id === action.pluginId);
    return plugin?.getDynamicIcon?.(action);
  }, []);

  const value = useMemo<PluginContextValue>(() => ({
    plugins: pluginRegistry,
    executing: false,
    executeAction,
    getDynamicIcon,
  }), [executeAction, getDynamicIcon]);

  return <PluginCtx.Provider value={value}>{children}</PluginCtx.Provider>;
}

export function usePlugins(): PluginContextValue {
  const ctx = useContext(PluginCtx);
  if (!ctx) throw new Error('usePlugins must be used within PluginProvider');
  return ctx;
}
