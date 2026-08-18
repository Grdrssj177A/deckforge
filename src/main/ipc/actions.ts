import { ipcMain, BrowserWindow } from 'electron';
import { pluginManager } from '../plugins';
import { ActionContext, ActionConfig } from '../core/types';
import { eventBus } from '../core/EventBus';
import { createLogger } from '../lib/logger';

const log = createLogger('ActionsIPC');

// Anti-spam: per-action cooldown
const COOLDOWN_MS = 200;
const busyUntil = new Map<string, number>();

function isActionBusy(key: string): boolean {
  const until = busyUntil.get(key);
  if (!until) return false;
  if (Date.now() >= until) { busyUntil.delete(key); return false; }
  return true;
}

export function registerActionHandlers(getWindow: () => BrowserWindow | null): void {

  // Lista de plugins y sus acciones (para el sidebar del renderer)
  ipcMain.handle('plugins:list', async () => {
    const plugins = pluginManager.list().map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      description: p.description,
      actions: p.actions,
    }));
    return { success: true, plugins };
  });

  // Ejecutar una acción
  ipcMain.handle('actions:execute', async (_event, params: {
    pluginId: string;
    actionId: string;
    config: ActionConfig;
    context: ActionContext;
  }) => {
    const { pluginId, actionId, config, context } = params;
    const busyKey = `${context.profileId}-${context.pageId}-${context.buttonId}`;

    // Anti-spam per-button
    if (isActionBusy(busyKey)) {
      return { success: false, error: 'cooldown' };
    }

    // Mark busy
    busyUntil.set(busyKey, Date.now() + 60000);

    try {
      // Inyectar settings globales en el config para nanoleaf
      const enrichedConfig = await enrichConfig(pluginId, config);
      await pluginManager.execute(pluginId, actionId, enrichedConfig, context);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Action failed [${pluginId}/${actionId}]: ${msg}`);
      return { success: false, error: msg };
    } finally {
      // Set cooldown
      busyUntil.set(busyKey, Date.now() + COOLDOWN_MS);
    }
  });

  // Obtener estado de una acción (para iconos dinámicos)
  ipcMain.handle('actions:getState', async (_event, params: {
    pluginId: string;
    actionId: string;
    config: ActionConfig;
  }) => {
    try {
      const state = await pluginManager.getState(params.pluginId, params.actionId, params.config);
      return { success: true, state };
    } catch {
      return { success: true, state: null };
    }
  });
}

/**
 * Enriquece el config de una acción con settings globales cuando aplica.
 * Ej: para nanoleaf, inyecta _globalIp y _globalToken desde settings.
 */
async function enrichConfig(pluginId: string, config: ActionConfig): Promise<ActionConfig> {
  // Los settings globales se pasan desde el renderer en el config con prefijo _global
  // (el renderer los inyecta antes de enviar)
  return config;
}
