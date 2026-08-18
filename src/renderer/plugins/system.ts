import { Plugin, Action, generateId } from '@/types';

const systemPlugin: Plugin = {
  id: 'system',
  name: 'Sistema',
  icon: '🖥️',
  description: 'Acciones del sistema operativo',
  actions: [
    {
      id: generateId(),
      pluginId: 'system',
      name: 'Open URL',
      icon: '🌐',
      description: 'Abre una URL en el navegador',
      config: { command: 'openUrl', url: 'https://google.com' },
    },
    {
      id: generateId(),
      pluginId: 'system',
      name: 'Open App',
      icon: '📂',
      description: 'Abre una aplicación',
      config: { command: 'openApp', path: '' },
    },
    {
      id: generateId(),
      pluginId: 'system',
      name: 'Screenshot',
      icon: '📸',
      description: 'Captura de pantalla guardada en archivo',
      config: { command: 'screenshot', savePath: '', format: 'png', captureMode: 'fullscreen' },
    },
    {
      id: generateId(),
      pluginId: 'system',
      name: 'Lock Screen',
      icon: '🔒',
      description: 'Bloquea la pantalla',
      config: { command: 'lockScreen' },
    },
    {
      id: generateId(),
      pluginId: 'system',
      name: 'Volume Up',
      icon: '🔊',
      description: 'Sube el volumen del sistema',
      config: { command: 'volumeUp', step: 10 },
    },
    {
      id: generateId(),
      pluginId: 'system',
      name: 'Volume Down',
      icon: '🔉',
      description: 'Baja el volumen del sistema',
      config: { command: 'volumeDown', step: 10 },
    },
    {
      id: generateId(),
      pluginId: 'system',
      name: 'Mute',
      icon: '🔇',
      description: 'Silencia/activa el volumen',
      config: { command: 'volumeMute' },
    },
    {
      id: generateId(),
      pluginId: 'system',
      name: 'Carpeta',
      icon: '📁',
      description: 'Crea una carpeta con sub-página de botones',
      config: { command: 'folder', folderName: '' },
    },
  ],

  async execute(action: Action): Promise<void> {
    const { command, url, path, step, savePath, format, captureMode } = action.config;

    if (!window.deckforge) {
      throw new Error('Electron API no disponible (¿ejecutando en navegador?)');
    }

    switch (command) {
      case 'openUrl': {
        if (!url) throw new Error('URL no configurada');
        await window.deckforge.system.openUrl(url as string);
        break;
      }
      case 'openApp': {
        if (!path) throw new Error('Ruta de aplicación no configurada');
        const result = await window.deckforge.system.openApp(path as string);
        if (!result.success) throw new Error(result.error || 'Error al abrir app');
        break;
      }
      case 'screenshot': {
        const res = await window.deckforge.system.screenshot({
          savePath: (savePath as string) || undefined,
          format: (format as string) || 'png',
          captureMode: (captureMode as string) || 'fullscreen',
        });
        if (!res.success) throw new Error(res.error || 'Error en captura');
        break;
      }
      case 'lockScreen': {
        await window.deckforge.system.lockScreen();
        break;
      }
      case 'volumeUp': {
        await window.deckforge.system.volumeUp((step as number) || 10);
        break;
      }
      case 'volumeDown': {
        await window.deckforge.system.volumeDown((step as number) || 10);
        break;
      }
      case 'volumeMute': {
        await window.deckforge.system.volumeMute();
        break;
      }
      case 'folder': {
        // No-op: la navegación la gestiona DeckButton directamente
        break;
      }
      default:
        throw new Error(`Comando desconocido: ${command}`);
    }
  },
};

export default systemPlugin;
