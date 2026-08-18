import { ipcMain, BrowserWindow } from 'electron';
import { actionManager } from '../core';
import { isCooldownError } from '../core/ActionManager';
import { pluginManager } from '../plugins';
import { ActionContext } from '../core/types';
import { createLogger } from '../lib/logger';
import { MAX_BUTTONS } from '../../shared/types/profiles';
import { ValidationError, sanitizeActionConfig } from '../lib/validate';

const log = createLogger('ActionsIPC');

interface ExecuteParams {
  pluginId?: unknown;
  actionId?: unknown;
  config?: unknown;
  context?: unknown;
}

function requireId(raw: unknown, label: string): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128) {
    throw new ValidationError(`${label} inválido`);
  }
  return raw;
}

/**
 * Normaliza el contexto que envía el renderer. Es la clave del anti-spam, así
 * que un contexto mal formado tiene que producir un error, no una clave basura
 * que agrupe botones distintos en el mismo cooldown.
 */
function toContext(raw: unknown): ActionContext {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const buttonId = typeof c.buttonId === 'number' ? c.buttonId : Number(c.buttonId);
  if (!Number.isInteger(buttonId) || buttonId < 0 || buttonId >= MAX_BUTTONS) {
    throw new ValidationError(`buttonId fuera de rango: ${String(c.buttonId)}`);
  }

  const modifiers = (c.modifiers && typeof c.modifiers === 'object' ? c.modifiers : {}) as Record<string, unknown>;

  return {
    deviceId: typeof c.deviceId === 'string' && c.deviceId ? c.deviceId.slice(0, 128) : 'virtual',
    pageId: typeof c.pageId === 'string' && c.pageId ? c.pageId.slice(0, 128) : 'root',
    buttonId,
    profileId: typeof c.profileId === 'string' ? c.profileId.slice(0, 128) : '',
    modifiers: {
      shift: !!modifiers.shift,
      ctrl: !!modifiers.ctrl,
      alt: !!modifiers.alt,
    },
  };
}

/**
 * IPC handlers for action execution.
 * Thin layer: valida la entrada y delega en el ActionManager.
 */
export function registerActionHandlers(_getWindow: () => BrowserWindow | null): void {

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
  ipcMain.handle('actions:execute', async (_event, params: ExecuteParams) => {
    try {
      const pluginId = requireId(params?.pluginId, 'pluginId');
      const actionId = requireId(params?.actionId, 'actionId');
      const config = sanitizeActionConfig(params?.config);
      const context = toContext(params?.context);

      await actionManager.execute(pluginId, actionId, config, context);
      return { success: true };
    } catch (error) {
      if (isCooldownError(error)) return { success: false, error: 'cooldown' };
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Obtener estado de una acción (para iconos dinámicos)
  ipcMain.handle('actions:getState', async (_event, params: ExecuteParams) => {
    try {
      const pluginId = requireId(params?.pluginId, 'pluginId');
      const actionId = requireId(params?.actionId, 'actionId');
      const config = sanitizeActionConfig(params?.config);
      const state = await pluginManager.getState(pluginId, actionId, config);
      return { success: true, state };
    } catch (error) {
      log.debug(`getState failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: true, state: null };
    }
  });
}
