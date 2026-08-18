import { Plugin, Action, generateId } from '@/types';
import { getPluginDefaultsGlobal } from '@/store/SettingsContext';
import { getIconById } from '@/assets/iconPack';

const nanoleafPlugin: Plugin = {
  id: 'nanoleaf',
  name: 'Nanoleaf',
  icon: '💡',
  description: 'Controla paneles Nanoleaf via API local',
  actions: [
    {
      id: generateId(),
      pluginId: 'nanoleaf',
      name: 'Toggle Power',
      icon: '💡',
      description: 'Enciende/apaga los paneles',
      config: { command: 'togglePower', _iconImage: getIconById('bulb')?.svg, _iconActive: getIconById('bulb-on')?.svg },
    },
    {
      id: generateId(),
      pluginId: 'nanoleaf',
      name: 'Set Color',
      icon: '🎨',
      description: 'Cambia el color de los paneles',
      config: { command: 'setColor', color: '#ff6600' },
    },
    {
      id: generateId(),
      pluginId: 'nanoleaf',
      name: 'Set Effect',
      icon: '✨',
      description: 'Aplica un efecto predefinido',
      config: { command: 'setEffect', effect: 'Flames' },
    },
    {
      id: generateId(),
      pluginId: 'nanoleaf',
      name: 'Brightness Up',
      icon: '🔆',
      description: 'Aumenta el brillo',
      config: { command: 'brightnessUp', step: 20, _iconImage: getIconById('brightness-up')?.svg },
    },
    {
      id: generateId(),
      pluginId: 'nanoleaf',
      name: 'Brightness Down',
      icon: '🔅',
      description: 'Disminuye el brillo',
      config: { command: 'brightnessDown', step: 20, _iconImage: getIconById('brightness-down')?.svg },
    },
  ],

  async execute(action: Action): Promise<void> {
    const { command, color, effect, step } = action.config;
    const defaults = getPluginDefaultsGlobal('nanoleaf');
    const ip = defaults.ip;
    const token = defaults.token;

    if (!window.deckforge) {
      throw new Error('Electron API no disponible');
    }

    if (!ip || !token) {
      throw new Error('IP y Token no configurados. Ve a ⚙️ Configuración global > Nanoleaf.');
    }

    const result = await window.deckforge.nanoleaf.execute(
      ip, token, command as string,
      { color: color as string, effect: effect as string, step: step as number }
    );

    if (!result.success) {
      throw new Error(result.error || `Error ejecutando ${command}`);
    }
  },
};

export default nanoleafPlugin;
