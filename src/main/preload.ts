import { contextBridge, ipcRenderer } from 'electron';

export interface SerialPortInfo {
  path: string;
  manufacturer: string;
  vendorId: string;
  productId: string;
  friendlyName: string;
}

export interface DeckForgeAPI {
  system: {
    openUrl: (url: string) => Promise<{ success: boolean }>;
    openApp: (path: string) => Promise<{ success: boolean; error?: string }>;
    volumeUp: (step?: number) => Promise<{ success: boolean }>;
    volumeDown: (step?: number) => Promise<{ success: boolean }>;
    volumeMute: () => Promise<{ success: boolean }>;
    screenshot: (options?: { savePath?: string; format?: string; captureMode?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    lockScreen: () => Promise<{ success: boolean }>;
    selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
  };
  hotkey: {
    send: (keys: string, delay?: number) => Promise<{ success: boolean; error?: string }>;
  };
  sound: {
    selectFile: () => Promise<string | null>;
  };
  nanoleaf: {
    pair: (ip: string) => Promise<{ success: boolean; token?: string; error?: string }>;
    execute: (ip: string, token: string, command: string, params?: any) => Promise<{ success: boolean; error?: string }>;
    getEffects: (ip: string, token: string) => Promise<{ success: boolean; effects?: string[]; error?: string }>;
  };
  serial: {
    listPorts: () => Promise<{ success: boolean; ports: SerialPortInfo[]; error?: string }>;
    connect: (port: string, baudRate?: number) => Promise<{ success: boolean; port?: string; error?: string }>;
    disconnect: () => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<{ connected: boolean; port: string }>;
    onButtonPress: (callback: (buttonIndex: number) => void) => () => void;
    onStatus: (callback: (status: { connected: boolean; port: string; error?: string }) => void) => () => void;
  };
  discord: {
    connect: (options?: { clientId?: string; clientSecret?: string }) => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    disconnect: () => Promise<{ success: boolean }>;
    getState: () => Promise<{ connected: boolean; mute: boolean; deaf: boolean }>;
    toggleMute: () => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    toggleDeaf: () => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    setMute: (mute: boolean) => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    setDeaf: (deaf: boolean) => Promise<{ success: boolean; state?: { mute: boolean; deaf: boolean }; error?: string }>;
    onVoiceState: (callback: (state: { mute: boolean; deaf: boolean }) => void) => () => void;
    onStatus: (callback: (status: { connected: boolean }) => void) => () => void;
  };
}

const api: DeckForgeAPI = {
  system: {
    openUrl: (url) => ipcRenderer.invoke('system:openUrl', url),
    openApp: (path) => ipcRenderer.invoke('system:openApp', path),
    volumeUp: (step) => ipcRenderer.invoke('system:volumeUp', step),
    volumeDown: (step) => ipcRenderer.invoke('system:volumeDown', step),
    volumeMute: () => ipcRenderer.invoke('system:volumeMute'),
    screenshot: (options) => ipcRenderer.invoke('system:screenshot', options),
    lockScreen: () => ipcRenderer.invoke('system:lockScreen'),
    selectFile: (filters) => ipcRenderer.invoke('dialog:selectFile', filters ? { filters } : undefined),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  },
  hotkey: {
    send: (keys, delay) => ipcRenderer.invoke('hotkey:send', keys, delay),
  },
  sound: {
    selectFile: () => ipcRenderer.invoke('sound:getFilePath'),
  },
  nanoleaf: {
    pair: (ip) => ipcRenderer.invoke('nanoleaf:pair', ip),
    execute: (ip, token, command, params) => ipcRenderer.invoke('nanoleaf:execute', ip, token, command, params),
    getEffects: (ip, token) => ipcRenderer.invoke('nanoleaf:getEffects', ip, token),
  },
  serial: {
    listPorts: () => ipcRenderer.invoke('serial:listPorts'),
    connect: (port, baudRate) => ipcRenderer.invoke('serial:connect', port, baudRate),
    disconnect: () => ipcRenderer.invoke('serial:disconnect'),
    getStatus: () => ipcRenderer.invoke('serial:getStatus'),
    onButtonPress: (callback) => {
      const handler = (_event: any, buttonIndex: number) => callback(buttonIndex);
      ipcRenderer.on('serial:buttonPress', handler);
      return () => ipcRenderer.removeListener('serial:buttonPress', handler);
    },
    onStatus: (callback) => {
      const handler = (_event: any, status: any) => callback(status);
      ipcRenderer.on('serial:status', handler);
      return () => ipcRenderer.removeListener('serial:status', handler);
    },
  },
  discord: {
    connect: (options?) => ipcRenderer.invoke('discord:connect', options),
    disconnect: () => ipcRenderer.invoke('discord:disconnect'),
    getState: () => ipcRenderer.invoke('discord:getState'),
    toggleMute: () => ipcRenderer.invoke('discord:toggleMute'),
    toggleDeaf: () => ipcRenderer.invoke('discord:toggleDeaf'),
    setMute: (mute) => ipcRenderer.invoke('discord:setMute', mute),
    setDeaf: (deaf) => ipcRenderer.invoke('discord:setDeaf', deaf),
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
};

contextBridge.exposeInMainWorld('deckforge', api);
