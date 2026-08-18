import { contextBridge, ipcRenderer } from 'electron';

export interface DeckForgeAPI {
  app: {
    rendererReady: () => Promise<{ success: boolean }>;
  };
  actions: {
    execute: (params: { pluginId: string; actionId: string; config: any; context: any }) => Promise<{ success: boolean; error?: string }>;
    getState: (params: { pluginId: string; actionId: string; config: any }) => Promise<{ success: boolean; state: any }>;
  };
  plugins: {
    list: () => Promise<{ success: boolean; plugins: any[] }>;
  };
  system: {
    selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
  };
  sound: {
    selectFile: () => Promise<string | null>;
  };
  settings: {
    getAll: () => Promise<{ success: boolean; settings: any }>;
    update: (section: string, values: any) => Promise<{ success: boolean }>;
    migrate: (data: string) => Promise<{ success: boolean }>;
  };
  devices: {
    listAvailable: () => Promise<{ success: boolean; ports: any[]; error?: string }>;
    listConnected: () => Promise<{ success: boolean; devices: any[] }>;
    connect: (port: string, baudRate?: number) => Promise<{ success: boolean; deviceId?: string; error?: string }>;
    disconnect: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
    onButtonPress: (callback: (buttonIndex: number) => void) => () => void;
    onStatus: (callback: (status: { connected: boolean; deviceId: string }) => void) => () => void;
  };
  discord: {
    getState: () => Promise<{ connected: boolean; mute: boolean; deaf: boolean }>;
    onVoiceState: (callback: (state: { mute: boolean; deaf: boolean }) => void) => () => void;
    onStatus: (callback: (status: { connected: boolean }) => void) => () => void;
  };
  profiles: {
    getAll: () => Promise<{ profiles: any[]; activeId: string }>;
    setActive: (id: string) => Promise<{ success: boolean }>;
    create: (name: string) => Promise<{ success: boolean; profile: any }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    rename: (id: string, name: string) => Promise<{ success: boolean }>;
    duplicate: (id: string) => Promise<{ success: boolean; profile: any }>;
    assignAction: (profileId: string, pageId: string | null, position: number, action: any) => Promise<{ success: boolean }>;
    removeAction: (profileId: string, pageId: string | null, position: number) => Promise<{ success: boolean }>;
    moveButton: (profileId: string, pageId: string | null, from: number, to: number) => Promise<{ success: boolean }>;
    createFolder: (profileId: string, pageId: string | null, position: number, name: string, icon: string) => Promise<{ success: boolean; folderId: string }>;
    deleteFolder: (profileId: string, folderId: string) => Promise<{ success: boolean }>;
    migrate: (data: string) => Promise<{ success: boolean }>;
    export: (data: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    import: () => Promise<{ success: boolean; data?: string; error?: string }>;
  };
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
  },
  devices: {
    listAvailable: () => ipcRenderer.invoke('devices:listAvailable'),
    listConnected: () => ipcRenderer.invoke('devices:listConnected'),
    connect: (port, baudRate) => ipcRenderer.invoke('devices:connect', port, baudRate),
    disconnect: (deviceId) => ipcRenderer.invoke('devices:disconnect', deviceId),
    onButtonPress: (callback) => {
      const handler = (_event: any, buttonIndex: number) => callback(buttonIndex);
      ipcRenderer.on('device:buttonPress', handler);
      return () => ipcRenderer.removeListener('device:buttonPress', handler);
    },
    onStatus: (callback) => {
      const handler = (_event: any, status: any) => callback(status);
      ipcRenderer.on('device:status', handler);
      return () => ipcRenderer.removeListener('device:status', handler);
    },
  },
  discord: {
    getState: () => ipcRenderer.invoke('discord:getState'),
    onVoiceState: (callback) => {
      const handler = (_event: any, state: any) => callback(state);
      ipcRenderer.on('discord:voiceState', handler);
      return () => ipcRenderer.removeListener('discord:voiceState', handler);
    },
    onStatus: (callback) => {
      const handler = (_event: any, status: any) => callback(status);
      ipcRenderer.on('discord:status', handler);
      return () => ipcRenderer.removeListener('discord:status', handler);
    },
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
  },
};

contextBridge.exposeInMainWorld('deckforge', api);
