import { Plugin, generateId } from '@/types';
import { getIconById } from '@/assets/iconPack';

/**
 * Nanoleaf plugin (renderer side) — metadata only.
 * Execution happens in main process via PluginManager.
 */
const nanoleafPlugin: Plugin = {
  id: 'nanoleaf',
  name: 'Nanoleaf',
  icon: '💡',
  description: 'Controla paneles Nanoleaf via API local',
  actions: [
    { id: generateId(), pluginId: 'nanoleaf', name: 'Toggle Power', icon: '💡', description: 'Enciende/apaga', config: { command: 'togglePower', _iconImage: getIconById('bulb')?.svg, _iconActive: getIconById('bulb-on')?.svg } },
    { id: generateId(), pluginId: 'nanoleaf', name: 'Set Color', icon: '🎨', description: 'Cambia color', config: { command: 'setColor', color: '#ff6600' } },
    { id: generateId(), pluginId: 'nanoleaf', name: 'Set Effect', icon: '✨', description: 'Aplica un efecto', config: { command: 'setEffect', effect: 'Flames' } },
    { id: generateId(), pluginId: 'nanoleaf', name: 'Brightness Up', icon: '🔆', description: 'Aumenta brillo', config: { command: 'brightnessUp', step: 20, _iconImage: getIconById('brightness-up')?.svg } },
    { id: generateId(), pluginId: 'nanoleaf', name: 'Brightness Down', icon: '🔅', description: 'Disminuye brillo', config: { command: 'brightnessDown', step: 20, _iconImage: getIconById('brightness-down')?.svg } },
  ],

  async execute(): Promise<void> {
    // Execution delegated to main process via PluginManager
  },
};

export default nanoleafPlugin;
