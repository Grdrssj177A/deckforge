import { DeckPlugin, ActionDefinition, ActionConfig, ActionContext, ActionState } from './types';
import { createLogger } from '../lib/logger';

const log = createLogger('PluginManager');

/**
 * PluginManager: registra plugins, los inicializa/destruye, y expone sus acciones.
 * Es el punto de acceso para obtener la lista de plugins/acciones disponibles.
 */
export class PluginManager {
  private plugins = new Map<string, DeckPlugin>();

  register(plugin: DeckPlugin): void {
    if (this.plugins.has(plugin.id)) {
      log.warn(`Plugin "${plugin.id}" already registered, overwriting`);
    }
    this.plugins.set(plugin.id, plugin);
    log.info(`Plugin registered: ${plugin.id} (${plugin.actions.length} actions)`);
  }

  async initializeAll(): Promise<void> {
    for (const [id, plugin] of this.plugins) {
      try {
        await plugin.initialize();
        log.info(`Plugin initialized: ${id}`);
      } catch (e) {
        log.error(`Plugin "${id}" failed to initialize:`, e);
      }
    }
  }

  async disposeAll(): Promise<void> {
    for (const [id, plugin] of this.plugins) {
      try {
        await plugin.dispose();
        log.info(`Plugin disposed: ${id}`);
      } catch (e) {
        log.error(`Plugin "${id}" failed to dispose:`, e);
      }
    }
  }

  get(id: string): DeckPlugin | undefined {
    return this.plugins.get(id);
  }

  list(): DeckPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Lista todas las acciones de todos los plugins (para el sidebar del renderer) */
  getAllActions(): ActionDefinition[] {
    const actions: ActionDefinition[] = [];
    for (const plugin of this.plugins.values()) {
      actions.push(...plugin.actions);
    }
    return actions;
  }

  /** Ejecutar una acción delegando al plugin correspondiente */
  async execute(pluginId: string, actionId: string, config: ActionConfig, context: ActionContext): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);
    await plugin.execute(actionId, config, context);
  }

  /** Obtener estado de una acción (para iconos dinámicos) */
  async getState(pluginId: string, actionId: string, config: ActionConfig): Promise<ActionState | null> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin?.getState) return null;
    return plugin.getState(actionId, config);
  }
}

export const pluginManager = new PluginManager();
