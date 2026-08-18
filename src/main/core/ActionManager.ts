import { PluginManager } from './PluginManager';
import { EventBus } from './EventBus';
import { ActionConfig, ActionContext } from './types';
import { createLogger } from '../lib/logger';

const log = createLogger('ActionManager');

const COOLDOWN_MS = 200;

/**
 * ActionManager: centraliza la ejecución de acciones.
 * - Recibe un ActionContext completo
 * - Aplica anti-spam per-button (con deviceId)
 * - Delega al PluginManager
 * - Emite eventos de resultado
 */
export class ActionManager {
  private pluginManager: PluginManager;
  private bus: EventBus;
  private busyUntil = new Map<string, number>();

  constructor(pluginManager: PluginManager, bus: EventBus) {
    this.pluginManager = pluginManager;
    this.bus = bus;
  }

  /**
   * Genera la clave de cooldown incluyendo deviceId para que
   * dos dispositivos con la misma posición no compartan cooldown.
   */
  private getBusyKey(context: ActionContext): string {
    return `${context.deviceId || 'virtual'}:${context.profileId}:${context.pageId}:${context.buttonId}`;
  }

  isActionBusy(context: ActionContext): boolean {
    const key = this.getBusyKey(context);
    const until = this.busyUntil.get(key);
    if (!until) return false;
    if (Date.now() >= until) { this.busyUntil.delete(key); return false; }
    return true;
  }

  async execute(pluginId: string, actionId: string, config: ActionConfig, context: ActionContext): Promise<void> {
    const key = this.getBusyKey(context);

    if (this.isActionBusy(context)) {
      throw new Error('cooldown');
    }

    // Mark busy during execution
    this.busyUntil.set(key, Date.now() + 60000);

    try {
      await this.pluginManager.execute(pluginId, actionId, config, context);
    } catch (error) {
      log.error(`Action failed [${pluginId}/${actionId}]: ${error instanceof Error ? error.message : error}`);
      throw error;
    } finally {
      // Set cooldown after execution
      this.busyUntil.set(key, Date.now() + COOLDOWN_MS);
    }
  }
}
