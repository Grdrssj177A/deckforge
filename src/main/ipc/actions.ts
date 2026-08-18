import { ipcMain, BrowserWindow } from 'electron';
import { actionManager } from '../core';
import { pluginManager } from '../plugins';
import { ActionContext, ActionConfig } from '../core/types';
import { createLogger } from '../lib/logger';

const log = createLogger('ActionsIPC');

/**
 * IPC handlers for action execution.
 * Thin layer: receives IPC, delegates to ActionManager.
 */
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
    try {
      await actionManager.execute(params.pluginId, params.actionId, params.config, params.context);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'cooldown') return { success: false, error: 'cooldown' };
      return { success: false, error: msg };
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
