import { contextBridge, ipcRenderer } from 'electron';
import { DeckForgeAPI } from '../shared/types/api';
import { DeviceButtonEvent, DeviceStatusEvent } from '../shared/types/devices';

export type { DeckForgeAPI };

/**
 * Suscribe un listener de ipcRenderer y devuelve su función de baja.
 * Centralizado para que ningún canal se quede sin limpiar.
 */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: DeckForgeAPI = {
  app: {
    rendererReady: () => ipcRenderer.invoke('app:rendererReady'),
  },
  actions: {
    execute: (params) => ipcRenderer.invoke('actions:execute', params),
    getState: (params) => ipcRenderer.invoke('actions:getState', params),
  },
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
  },
  system: {
    selectFile: (filters) => ipcRenderer.invoke('dialog:selectFile', filters ? { filters } : undefined),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  },
  sound: {
    selectFile: () => ipcRenderer.invoke('sound:getFilePath'),
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    update: (section, values) => ipcRenderer.invoke('settings:update', section, values),
    migrate: (data) => ipcRenderer.invoke('settings:migrate', data),
    nanoleafPair: (ip) => ipcRenderer.invoke('nanoleaf:pair', ip),
    discordConnect: (clientSecret) => ipcRenderer.invoke('discord:connect', { clientSecret }),
  },
  devices: {
    listAvailable: () => ipcRenderer.invoke('devices:listAvailable'),
    listConnected: () => ipcRenderer.invoke('devices:listConnected'),
    connect: (port, baudRate) => ipcRenderer.invoke('devices:connect', port, baudRate),
    disconnect: (deviceId) => ipcRenderer.invoke('devices:disconnect', deviceId),
    // Se reenvía el evento completo: el `status` que calcula el Core es lo que
    // permite al grid distinguir éxito, error, hueco vacío o navegación.
    onButtonPress: (callback) => subscribe<DeviceButtonEvent>('device:buttonFeedback', callback),
    onStatus: (callback) => subscribe<DeviceStatusEvent>('device:status', callback),
  },
  discord: {
    getState: () => ipcRenderer.invoke('discord:getState'),
    onVoiceState: (callback) => subscribe<{ mute: boolean; deaf: boolean }>('discord:voiceState', callback),
    onStatus: (callback) => subscribe<{ connected: boolean }>('discord:status', callback),
  },
  profiles: {
    getAll: () => ipcRenderer.invoke('profiles:getAll'),
    setActive: (id) => ipcRenderer.invoke('profiles:setActive', id),
    create: (name) => ipcRenderer.invoke('profiles:create', name),
    delete: (id) => ipcRenderer.invoke('profiles:delete', id),
    rename: (id, name) => ipcRenderer.invoke('profiles:rename', id, name),
    duplicate: (id) => ipcRenderer.invoke('profiles:duplicate', id),
    assignAction: (profileId, pageId, position, action) => ipcRenderer.invoke('profiles:assignAction', profileId, pageId, position, action),
    removeAction: (profileId, pageId, position) => ipcRenderer.invoke('profiles:removeAction', profileId, pageId, position),
    moveButton: (profileId, pageId, from, to) => ipcRenderer.invoke('profiles:moveButton', profileId, pageId, from, to),
    createFolder: (profileId, pageId, position, name, icon) => ipcRenderer.invoke('profiles:createFolder', profileId, pageId, position, name, icon),
    deleteFolder: (profileId, folderId) => ipcRenderer.invoke('profiles:deleteFolder', profileId, folderId),
    migrate: (data) => ipcRenderer.invoke('profiles:migrate', data),
    export: (data) => ipcRenderer.invoke('profiles:export', data),
    import: () => ipcRenderer.invoke('profiles:import'),
    importProfiles: (data) => ipcRenderer.invoke('profiles:importProfiles', data),
  },
};

contextBridge.exposeInMainWorld('deckforge', api);
