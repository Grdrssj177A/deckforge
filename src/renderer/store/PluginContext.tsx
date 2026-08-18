import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Plugin, Action, PluginState } from '@/types';
import { pluginRegistry } from '@/plugins';
import { createLogger } from '@/lib/logger';

const log = createLogger('Plugins');

const COOLDOWN_MS = 200; // Cooldown per button to prevent spam

interface PluginContextValue extends PluginState {
  executeAction: (action: Action) => Promise<void>;
  isActionBusy: (actionId: string) => boolean;
  getPlugin: (id: string) => Plugin | undefined;
  getDynamicIcon: (action: Action) => string | undefined;
}

const PluginCtx = createContext<PluginContextValue | null>(null);

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const [state] = useState<PluginState>({
    plugins: pluginRegistry,
    executing: false, // Kept for interface compat but no longer blocks globally
  });

  // Per-action busy tracking: actionId → timestamp when it becomes free
  const busyUntil = useRef<Map<string, number>>(new Map());

  const isActionBusy = useCallback((actionId: string): boolean => {
    const until = busyUntil.current.get(actionId);
    if (!until) return false;
    if (Date.now() >= until) {
      busyUntil.current.delete(actionId);
      return false;
    }
    return true;
  }, []);

  const executeAction = useCallback(async (action: Action) => {
    // Anti-spam: check if this specific action is in cooldown
    if (isActionBusy(action.id)) {
      log.debug(`Action "${action.name}" still in cooldown, skipping`);
      return;
    }

    const plugin = pluginRegistry.find((p) => p.id === action.pluginId);
    if (!plugin) {
      log.warn(`Plugin not found: ${action.pluginId}`);
      return;
    }

    // Mark as busy immediately
    busyUntil.current.set(action.id, Date.now() + 60000); // Block until done + cooldown

    try {
      await plugin.execute(action);
    } catch (error) {
      log.error(`Error executing "${action.name}":`, error);
      throw error; // Re-throw so DeckButton can show error feedback
    } finally {
      // Set cooldown from now
      busyUntil.current.set(action.id, Date.now() + COOLDOWN_MS);
    }
  }, [isActionBusy]);

  const getPlugin = useCallback(
    (id: string) => state.plugins.find((p) => p.id === id),
    [state.plugins]
  );

  const getDynamicIcon = useCallback((action: Action) => {
    const plugin = pluginRegistry.find((p) => p.id === action.pluginId);
    return plugin?.getDynamicIcon?.(action);
  }, []);

  return (
    <PluginCtx.Provider value={{ ...state, executeAction, isActionBusy, getPlugin, getDynamicIcon }}>
      {children}
    </PluginCtx.Provider>
  );
}

export function usePlugins(): PluginContextValue {
  const ctx = useContext(PluginCtx);
  if (!ctx) throw new Error('usePlugins must be used within PluginProvider');
  return ctx;
}
