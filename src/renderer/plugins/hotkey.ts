import { Plugin, generateId } from '@/types';

/**
 * Hotkey plugin (renderer side) — metadata only.
 * Execution happens in main process via PluginManager.
 */
const hotkeyPlugin: Plugin = {
  id: 'hotkey',
  name: 'Hotkeys',
  icon: '⌨️',
  description: 'Simula atajos de teclado a nivel del sistema',
  actions: [
    { id: generateId(), pluginId: 'hotkey', name: 'Custom Hotkey', icon: '⌨️', description: 'Ejecuta un atajo personalizado', config: { keys: '', delay: 0 } },
    { id: generateId(), pluginId: 'hotkey', name: 'Copy', icon: '📋', description: 'Ctrl+C', config: { keys: 'Ctrl+C', delay: 0 } },
    { id: generateId(), pluginId: 'hotkey', name: 'Paste', icon: '📌', description: 'Ctrl+V', config: { keys: 'Ctrl+V', delay: 0 } },
    { id: generateId(), pluginId: 'hotkey', name: 'Undo', icon: '↩️', description: 'Ctrl+Z', config: { keys: 'Ctrl+Z', delay: 0 } },
    { id: generateId(), pluginId: 'hotkey', name: 'Save', icon: '💾', description: 'Ctrl+S', config: { keys: 'Ctrl+S', delay: 0 } },
    { id: generateId(), pluginId: 'hotkey', name: 'Select All', icon: '📑', description: 'Ctrl+A', config: { keys: 'Ctrl+A', delay: 0 } },
  ],

  async execute(): Promise<void> {
    // Execution delegated to main process via actions:execute IPC
  },
};

export default hotkeyPlugin;
