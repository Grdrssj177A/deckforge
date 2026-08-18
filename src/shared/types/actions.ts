/**
 * Tipos compartidos para acciones.
 * Importado tanto por main como por renderer.
 */

export interface ActionConfig {
  [key: string]: string | number | boolean | undefined;
}

export interface ActionContext {
  deviceId?: string;
  pageId: string;
  buttonId: number;
  profileId: string;
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
}

export interface ActionState {
  active: boolean;
  icon?: string;
  label?: string;
}

export interface ActionDefinition {
  id: string;
  pluginId: string;
  name: string;
  description?: string;
  icon?: string;
  defaultConfig: ActionConfig;
}
