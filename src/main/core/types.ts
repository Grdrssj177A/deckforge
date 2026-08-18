/**
 * Tipos compartidos del Core.
 * Define el contrato de plugins, acciones y contextos.
 */

export interface ActionContext {
  deviceId?: string;
  pageId: string;
  buttonId: number;
  profileId: string;
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
}

export interface ActionState {
  active: boolean;
  icon?: string;       // Icono dinámico (data URL SVG)
  label?: string;      // Texto dinámico
}

export interface ActionConfig {
  [key: string]: string | number | boolean | undefined;
}

export interface ActionDefinition {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  icon?: string;
  defaultConfig: ActionConfig;
}

export interface DeckPlugin {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;

  /** Acciones que ofrece este plugin (template para el sidebar) */
  readonly actions: ActionDefinition[];

  /** Inicializar recursos de larga duración (sockets, conexiones, etc.) */
  initialize(): Promise<void>;

  /** Liberar recursos al cerrar/desactivar */
  dispose(): Promise<void>;

  /** Ejecutar una acción concreta */
  execute(actionId: string, config: ActionConfig, context: ActionContext): Promise<void>;

  /** Obtener estado actual de una acción (para iconos dinámicos) */
  getState?(actionId: string, config: ActionConfig): Promise<ActionState | null>;
}
