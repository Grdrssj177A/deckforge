import { Plugin, generateId } from '@/types';

/**
 * OBS plugin (renderer side) — metadata only.
 * Execution happens in main process via PluginManager.
 */
const obsPlugin: Plugin = {
  id: 'obs',
  name: 'OBS Studio',
  icon: '🎬',
  description: 'Controla OBS Studio via WebSocket',
  actions: [
    { id: generateId(), pluginId: 'obs', name: 'Start Streaming', icon: '🔴', description: 'Inicia el streaming', config: { command: 'StartStreaming' } },
    { id: generateId(), pluginId: 'obs', name: 'Stop Streaming', icon: '⏹️', description: 'Detiene el streaming', config: { command: 'StopStreaming' } },
    { id: generateId(), pluginId: 'obs', name: 'Start Recording', icon: '⏺️', description: 'Inicia la grabación', config: { command: 'StartRecording' } },
    { id: generateId(), pluginId: 'obs', name: 'Stop Recording', icon: '⏏️', description: 'Detiene la grabación', config: { command: 'StopRecording' } },
    { id: generateId(), pluginId: 'obs', name: 'Switch Scene', icon: '🎞️', description: 'Cambia de escena', config: { command: 'SetCurrentScene', sceneName: '' } },
    { id: generateId(), pluginId: 'obs', name: 'Toggle Mute', icon: '🔈', description: 'Mute/Unmute fuente', config: { command: 'ToggleMute', source: 'Mic/Aux' } },
  ],

  async execute(): Promise<void> {
    // Execution delegated to main process via PluginManager
  },
};

export default obsPlugin;
