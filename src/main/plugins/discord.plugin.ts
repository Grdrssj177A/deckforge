import { DeckPlugin, ActionDefinition, ActionConfig, ActionContext, ActionState } from '../core/types';
import { createLogger } from '../lib/logger';

const log = createLogger('DiscordPlugin');

/**
 * Plugin de Discord para el Core.
 * La conexión RPC se gestiona via ipc/discord.ts (ya existente).
 * Este plugin delega la ejecución a los IPC handlers existentes.
 * 
 * Nota: El RPC client vive en ipc/discord.ts como singleton.
 * Este plugin es un wrapper que expone las acciones al PluginManager.
 */
export class DiscordPlugin implements DeckPlugin {
  readonly id = 'discord';
  readonly name = 'Discord';
  readonly icon = '💬';
  readonly description = 'Control directo de Discord via RPC local';

  // Referencia al executeDiscord que se inyecta desde ipc/discord.ts
  private executeHandler: ((action: string) => Promise<any>) | null = null;
  private getStateHandler: (() => Promise<{ mute: boolean; deaf: boolean; connected: boolean }>) | null = null;

  readonly actions: ActionDefinition[] = [
    { id: 'toggleMute', pluginId: 'discord', name: 'Toggle Mute', description: 'Activa/desactiva micrófono', defaultConfig: { command: 'toggleMute' } },
    { id: 'toggleDeafen', pluginId: 'discord', name: 'Toggle Deafen', description: 'Activa/desactiva audio', defaultConfig: { command: 'toggleDeafen' } },
  ];

  setExecuteHandler(handler: (action: string) => Promise<any>): void {
    this.executeHandler = handler;
  }

  setGetStateHandler(handler: () => Promise<{ mute: boolean; deaf: boolean; connected: boolean }>): void {
    this.getStateHandler = handler;
  }

  async initialize(): Promise<void> {
    // La conexión se maneja por ipc/discord.ts con auto-connect
  }

  async dispose(): Promise<void> {
    // Desconexión se maneja por ipc/discord.ts
  }

  async execute(actionId: string, config: ActionConfig, context: ActionContext): Promise<void> {
    if (!this.executeHandler) throw new Error('Discord no inicializado');
    const result = await this.executeHandler(actionId);
    if (result && !result.success) throw new Error(result.error || 'Error de Discord');
  }

  async getState(actionId: string, config: ActionConfig): Promise<ActionState | null> {
    if (!this.getStateHandler) return null;
    const state = await this.getStateHandler();
    if (actionId === 'toggleMute') {
      return { active: state.mute };
    }
    if (actionId === 'toggleDeafen') {
      return { active: state.deaf };
    }
    return null;
  }
}
