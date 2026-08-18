/**
 * Tipos compartidos para el sistema de plugins.
 * Importado tanto por main como por renderer.
 */

import { ActionDefinition, ActionConfig, ActionContext, ActionState } from './actions';

export interface DeckPlugin {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly actions: ActionDefinition[];

  initialize(): Promise<void>;
  dispose(): Promise<void>;
  execute(actionId: string, config: ActionConfig, context: ActionContext): Promise<void>;
  getState?(actionId: string, config: ActionConfig): Promise<ActionState | null>;
}

export type PluginId = 'soundboard' | 'hotkey' | 'obs' | 'discord' | 'nanoleaf' | 'system';
