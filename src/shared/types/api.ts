/**
 * Contrato del puente preload ↔ renderer.
 *
 * Fuente única de verdad: la implementación (preload.ts) y el consumidor
 * (renderer) importan este mismo tipo, para que no puedan divergir.
 */

import { ActionConfig, ActionContext, ActionState } from './actions';
import { DeviceButtonEvent, DeviceInfo, DeviceStatusEvent } from './devices';
import { Profile } from './profiles';

/** Respuesta estándar de una operación que puede fallar. */
export interface Result {
  success: boolean;
  error?: string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface PluginSummary {
  id: string;
  name: string;
  icon: string;
  description: string;
  actions: unknown[];
}

export interface PortSummary {
  path: string;
  type: string;
  manufacturer?: string;
  friendlyName?: string;
}

export interface DeckForgeAPI {
  app: {
    rendererReady: () => Promise<Result>;
  };
  actions: {
    execute: (params: {
      pluginId: string;
      actionId: string;
      config: ActionConfig;
      context: ActionContext;
    }) => Promise<Result>;
    getState: (params: {
      pluginId: string;
      actionId: string;
      config: ActionConfig;
    }) => Promise<Result & { state: ActionState | null }>;
  };
  plugins: {
    list: () => Promise<Result & { plugins: PluginSummary[] }>;
  };
  system: {
    selectFile: (filters?: FileFilter[]) => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
  };
  sound: {
    selectFile: () => Promise<string | null>;
  };
  settings: {
    getAll: () => Promise<Result & { settings: Record<string, any> }>;
    update: (section: string, values: Record<string, unknown>) => Promise<Result>;
    migrate: (data: string) => Promise<Result>;
    nanoleafPair: (ip: string) => Promise<Result & { token?: string }>;
    discordConnect: (clientSecret?: string) => Promise<Result>;
  };
  devices: {
    listAvailable: () => Promise<Result & { ports: PortSummary[] }>;
    listConnected: () => Promise<Result & { devices: DeviceInfo[] }>;
    connect: (port: string, baudRate?: number) => Promise<Result & { deviceId?: string }>;
    disconnect: (deviceId: string) => Promise<Result>;
    /** Recibe el evento completo, incluido el resultado de la ejecución. */
    onButtonPress: (callback: (event: DeviceButtonEvent) => void) => () => void;
    onStatus: (callback: (status: DeviceStatusEvent) => void) => () => void;
  };
  discord: {
    getState: () => Promise<{ connected: boolean; mute: boolean; deaf: boolean }>;
    onVoiceState: (callback: (state: { mute: boolean; deaf: boolean }) => void) => () => void;
    onStatus: (callback: (status: { connected: boolean }) => void) => () => void;
  };
  profiles: {
    getAll: () => Promise<{ profiles: Profile[]; activeId: string }>;
    setActive: (id: string) => Promise<Result>;
    create: (name: string) => Promise<Result & { profile?: Profile }>;
    delete: (id: string) => Promise<Result>;
    rename: (id: string, name: string) => Promise<Result>;
    duplicate: (id: string) => Promise<Result & { profile?: Profile }>;
    assignAction: (
      profileId: string,
      pageId: string | null,
      position: number,
      action: unknown
    ) => Promise<Result>;
    removeAction: (profileId: string, pageId: string | null, position: number) => Promise<Result>;
    moveButton: (
      profileId: string,
      pageId: string | null,
      from: number,
      to: number
    ) => Promise<Result>;
    createFolder: (
      profileId: string,
      pageId: string | null,
      position: number,
      name: string,
      icon: string
    ) => Promise<Result & { folderId?: string }>;
    deleteFolder: (profileId: string, folderId: string) => Promise<Result>;
    migrate: (data: string) => Promise<Result>;
    export: (data: string) => Promise<Result & { filePath?: string }>;
    import: () => Promise<Result & { data?: string }>;
    /**
     * Importa uno o varios perfiles en una sola operación.
     * Sustituye al bucle de assignAction por botón, que provocaba una
     * reescritura completa del archivo de perfiles por cada botón.
     */
    importProfiles: (data: string) => Promise<Result & { imported?: number }>;
  };
}
