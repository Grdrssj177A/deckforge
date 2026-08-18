import { Plugin, Action, generateId } from '@/types';
import { getPluginDefaultsGlobal } from '@/store/SettingsContext';

const obsPlugin: Plugin = {
  id: 'obs',
  name: 'OBS Studio',
  icon: '🎬',
  description: 'Controla OBS Studio via WebSocket',
  actions: [
    {
      id: generateId(),
      pluginId: 'obs',
      name: 'Start Streaming',
      icon: '🔴',
      description: 'Inicia el streaming',
      config: { command: 'StartStreaming' },
    },
    {
      id: generateId(),
      pluginId: 'obs',
      name: 'Stop Streaming',
      icon: '⏹️',
      description: 'Detiene el streaming',
      config: { command: 'StopStreaming' },
    },
    {
      id: generateId(),
      pluginId: 'obs',
      name: 'Start Recording',
      icon: '⏺️',
      description: 'Inicia la grabación',
      config: { command: 'StartRecording' },
    },
    {
      id: generateId(),
      pluginId: 'obs',
      name: 'Stop Recording',
      icon: '⏏️',
      description: 'Detiene la grabación',
      config: { command: 'StopRecording' },
    },
    {
      id: generateId(),
      pluginId: 'obs',
      name: 'Switch Scene',
      icon: '🎞️',
      description: 'Cambia de escena',
      config: { command: 'SetCurrentScene', sceneName: 'Scene 1' },
    },
    {
      id: generateId(),
      pluginId: 'obs',
      name: 'Toggle Mute',
      icon: '🔈',
      description: 'Mute/Unmute una fuente de audio',
      config: { command: 'ToggleMute', source: 'Mic/Aux' },
    },
  ],

  async execute(action: Action): Promise<void> {
    const { command, sceneName, source } = action.config;
    const defaults = getPluginDefaultsGlobal('obs');
    const host = (action.config.obsHost as string) || defaults.obsHost || 'localhost:4455';
    const password = (action.config.obsPassword as string) || defaults.obsPassword || '';

    // OBS WebSocket v5 usa ws://host:port
    // Por ahora se logea - la integración completa requiere obs-websocket-js
    console.log(`[OBS] Executing: ${command} on ${host}`, { sceneName, source, password: password ? '***' : '(none)' });

    // TODO: Implementar con obs-websocket-js cuando se añada como dependencia
    // import OBSWebSocket from 'obs-websocket-js';
    // const obs = new OBSWebSocket();
    // await obs.connect(`ws://${host}`, password || undefined);
    // await obs.call(command, { sceneName, source });
    // obs.disconnect();
  },
};

export default obsPlugin;
