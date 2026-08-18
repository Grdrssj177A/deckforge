import { Plugin, generateId } from '@/types';

/**
 * System plugin (renderer side) — metadata only.
 * Execution happens in main process via PluginManager.
 */
const systemPlugin: Plugin = {
  id: 'system',
  name: 'Sistema',
  icon: '🖥️',
  description: 'Acciones del sistema operativo',
  actions: [
    { id: generateId(), pluginId: 'system', name: 'Open URL', icon: '🌐', description: 'Abre una URL en el navegador', config: { command: 'openUrl', url: '' } },
    { id: generateId(), pluginId: 'system', name: 'Open App', icon: '📂', description: 'Abre una aplicación', config: { command: 'openApp', path: '' } },
    { id: generateId(), pluginId: 'system', name: 'Screenshot', icon: '📸', description: 'Captura de pantalla', config: { command: 'screenshot', savePath: '', format: 'png', captureMode: 'fullscreen' } },
    { id: generateId(), pluginId: 'system', name: 'Lock Screen', icon: '🔒', description: 'Bloquea la pantalla', config: { command: 'lockScreen' } },
    { id: generateId(), pluginId: 'system', name: 'Volume Up', icon: '🔊', description: 'Sube el volumen', config: { command: 'volumeUp', step: 10 } },
    { id: generateId(), pluginId: 'system', name: 'Volume Down', icon: '🔉', description: 'Baja el volumen', config: { command: 'volumeDown', step: 10 } },
    { id: generateId(), pluginId: 'system', name: 'Mute', icon: '🔇', description: 'Silencia/activa el volumen', config: { command: 'volumeMute' } },
    { id: generateId(), pluginId: 'system', name: 'Carpeta', icon: '📁', description: 'Crea una carpeta con sub-página', config: { command: 'folder', folderName: '' } },
  ],

  async execute(): Promise<void> {
    // Execution delegated to main process via actions:execute IPC
  },
};

export default systemPlugin;
