import { Plugin, Action, generateId } from '@/types';

const hotkeyPlugin: Plugin = {
  id: 'hotkey',
  name: 'Hotkeys',
  icon: '⌨️',
  description: 'Simula atajos de teclado a nivel del sistema',
  actions: [
    {
      id: generateId(),
      pluginId: 'hotkey',
      name: 'Custom Hotkey',
      icon: '⌨️',
      description: 'Ejecuta un atajo de teclado personalizado',
      config: { keys: '', delay: 0 },
    },
    {
      id: generateId(),
      pluginId: 'hotkey',
      name: 'Copy',
      icon: '📋',
      description: 'Ctrl+C',
      config: { keys: 'Ctrl+C', delay: 0 },
    },
    {
      id: generateId(),
      pluginId: 'hotkey',
      name: 'Paste',
      icon: '📌',
      description: 'Ctrl+V',
      config: { keys: 'Ctrl+V', delay: 0 },
    },
    {
      id: generateId(),
      pluginId: 'hotkey',
      name: 'Undo',
      icon: '↩️',
      description: 'Ctrl+Z',
      config: { keys: 'Ctrl+Z', delay: 0 },
    },
    {
      id: generateId(),
      pluginId: 'hotkey',
      name: 'Save',
      icon: '💾',
      description: 'Ctrl+S',
      config: { keys: 'Ctrl+S', delay: 0 },
    },
    {
      id: generateId(),
      pluginId: 'hotkey',
      name: 'Select All',
      icon: '📑',
      description: 'Ctrl+A',
      config: { keys: 'Ctrl+A', delay: 0 },
    },
  ],

  async execute(action: Action): Promise<void> {
    const { keys, delay } = action.config;

    if (!keys) {
      throw new Error('No hay atajo configurado. Click derecho > Configurar para definir las teclas.');
    }

    if (!window.deckforge) {
      throw new Error('Electron API no disponible');
    }

    const result = await window.deckforge.hotkey.send(keys as string, (delay as number) || 0);
    if (!result.success) {
      throw new Error(result.error || `Error al enviar hotkey: ${keys}`);
    }
  },
};

export default hotkeyPlugin;
