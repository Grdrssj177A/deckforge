import { PluginManager } from './PluginManager';
import { EventBus } from './EventBus';
import { ActionConfig, ActionContext } from './types';
import { createLogger } from '../lib/logger';

const log = createLogger('ActionManager');

const COOLDOWN_MS = 200;

/**
 * Se lanza cuando una acción se rechaza por anti-spam.
 * Antes esto era `new Error('cooldown')` y se comparaba el mensaje por igualdad
 * en cuatro sitios distintos; cualquier cambio de texto lo habría roto en silencio.
 */
export class CooldownError extends Error {
  constructor() {
    super('cooldown');
    this.name = 'CooldownError';
  }
}

export function isCooldownError(error: unknown): boolean {
  return error instanceof CooldownError;
}

/**
 * ActionManager: centraliza la ejecución de acciones.
 * - Recibe un ActionContext completo
 * - Aplica anti-spam per-button (device + perfil + página + botón)
 * - Delega al PluginManager
 * - Emite eventos de resultado
 */
export class ActionManager {
  private pluginManager: PluginManager;
  private bus: EventBus;
  /** Claves en ejecución ahora mismo. */
  private inFlight = new Set<string>();
  /** Fin del enfriamiento por clave. */
  private cooldownUntil = new Map<string, number>();

  constructor(pluginManager: PluginManager, bus: EventBus) {
    this.pluginManager = pluginManager;
    this.bus = bus;
  }

  /**
   * Clave de cooldown. Incluye deviceId, perfil, página y botón: dos botones
   * distintos nunca deben compartir enfriamiento.
   */
  private getBusyKey(context: ActionContext): string {
    const device = context.deviceId || 'virtual';
    const profile = context.profileId || 'unknown';
    const page = context.pageId || 'root';
    const button = Number.isInteger(context.buttonId) ? context.buttonId : -1;
    return `${device}:${profile}:${page}:${button}`;
  }

  isActionBusy(context: ActionContext): boolean {
    const key = this.getBusyKey(context);
    if (this.inFlight.has(key)) return true;

    const until = this.cooldownUntil.get(key);
    if (until === undefined) return false;
    if (Date.now() >= until) {
      this.cooldownUntil.delete(key);
      return false;
    }
    return true;
  }

  async execute(pluginId: string, actionId: string, config: ActionConfig, context: ActionContext): Promise<void> {
    const key = this.getBusyKey(context);

    if (this.isActionBusy(context)) {
      throw new CooldownError();
    }

    // En vuelo mientras dura la ejecución, sin depender de un timeout arbitrario.
    this.inFlight.add(key);
    this.bus.emit('action:started', { pluginId, actionId, context });

    try {
      await this.pluginManager.execute(pluginId, actionId, config, context);
      this.bus.emit('action:completed', { pluginId, actionId, context });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Action failed [${pluginId}/${actionId}]: ${msg}`);
      this.bus.emit('action:failed', { pluginId, actionId, context, error: msg });
      throw error;
    } finally {
      this.inFlight.delete(key);
      this.cooldownUntil.set(key, Date.now() + COOLDOWN_MS);
    }
  }
}
