import { Plugin, Action, generateId } from '@/types';
import { getIconById } from '@/assets/iconPack';

/**
 * Pool de audios activos, mapeado por action ID para poder
 * parar instancias específicas (modo toggle).
 */
const activeAudios: Map<string, Set<HTMLAudioElement>> = new Map();

// Evento para notificar que un audio cambió de estado (para refrescar iconos)
export const SOUND_STATE_EVENT = 'deckforge:soundState';

function emitSoundStateChange() {
  window.dispatchEvent(new CustomEvent(SOUND_STATE_EVENT));
}

// Obtener dispositivos de audio disponibles
export async function getAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audiooutput');
  } catch {
    return [];
  }
}

const soundboardPlugin: Plugin = {
  id: 'soundboard',
  name: 'Soundboard',
  icon: '🔊',
  description: 'Reproduce archivos de audio',
  actions: [
    {
      id: generateId(),
      pluginId: 'soundboard',
      name: 'Play Sound',
      icon: '🔊',
      description: 'Reproduce un archivo de sonido',
      config: {
        filePath: '',
        volume: 100,
        mode: 'overlap',     // 'overlap' | 'toggle'
        startTime: 0,        // segundos
        endTime: 0,          // 0 = hasta el final
        outputDevice: '',    // deviceId, vacío = default
        _iconImage: getIconById('play')?.svg,
        _iconActive: getIconById('stop')?.svg,
      },
    },
    {
      id: generateId(),
      pluginId: 'soundboard',
      name: 'Stop All',
      icon: '🔇',
      description: 'Detiene todos los sonidos',
      config: { command: 'stopAll', _iconImage: getIconById('volume-mute')?.svg },
    },
  ],

  async execute(action: Action): Promise<void> {
    const { filePath, volume, command, mode, startTime, endTime, outputDevice } = action.config;

    if (command === 'stopAll') {
      activeAudios.forEach((set) => {
        set.forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
        });
        set.clear();
      });
      activeAudios.clear();
      emitSoundStateChange();
      return;
    }

    if (!filePath) {
      throw new Error('No hay archivo de audio configurado. Click derecho > Configurar para seleccionar un archivo.');
    }

    const actionId = action.id;
    const playMode = (mode as string) || 'overlap';

    // Modo toggle: si ya hay audio de este botón sonando, pararlo
    if (playMode === 'toggle') {
      const existing = activeAudios.get(actionId);
      if (existing && existing.size > 0) {
        existing.forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
        });
        existing.clear();
        activeAudios.delete(actionId);
        emitSoundStateChange();
        return;
      }
    }

    // Crear URL válida para archivos locales
    const fileUrl = (filePath as string).startsWith('file://')
      ? filePath as string
      : `file:///${(filePath as string).replace(/\\/g, '/')}`;

    const audio = new Audio(fileUrl);
    audio.volume = Math.max(0, Math.min(1, ((volume as number) || 100) / 100));

    // Seleccionar dispositivo de salida si se configuró
    const deviceId = outputDevice as string;
    if (deviceId && 'setSinkId' in audio) {
      try {
        await (audio as any).setSinkId(deviceId);
      } catch (e) {
        console.warn('[Soundboard] Could not set output device:', e);
      }
    }

    // Aplicar start time
    const start = Number(startTime) || 0;
    if (start > 0) {
      audio.currentTime = start;
    }

    // Registrar en el pool
    if (!activeAudios.has(actionId)) {
      activeAudios.set(actionId, new Set());
    }
    activeAudios.get(actionId)!.add(audio);

    // Manejar end time (parar cuando llegue al punto configurado)
    const end = Number(endTime) || 0;
    let timeUpdateHandler: (() => void) | null = null;

    if (end > 0 && end > start) {
      timeUpdateHandler = () => {
        if (audio.currentTime >= end) {
          audio.pause();
          audio.currentTime = 0;
          cleanup();
        }
      };
      audio.addEventListener('timeupdate', timeUpdateHandler);
    }

    const cleanup = () => {
      const set = activeAudios.get(actionId);
      if (set) {
        set.delete(audio);
        if (set.size === 0) activeAudios.delete(actionId);
      }
      if (timeUpdateHandler) {
        audio.removeEventListener('timeupdate', timeUpdateHandler);
      }
      emitSoundStateChange();
    };

    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);

    await audio.play();
    emitSoundStateChange();
  },

  // Icono dinámico: mostrar ⏹ si el audio está sonando (modo toggle)
  getDynamicIcon(action: Action): string | undefined {
    if (action.config.command === 'stopAll') return undefined;
    if ((action.config.mode as string) === 'toggle') {
      const playing = activeAudios.get(action.id);
      if (playing && playing.size > 0) {
        return (action.config._iconActive as string) || getIconById('stop')?.svg;
      }
    }
    return undefined; // usa _iconImage normal
  },
};

export default soundboardPlugin;
