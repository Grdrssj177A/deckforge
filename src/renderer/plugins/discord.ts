import { Plugin, Action, generateId } from '@/types';
import { getPluginDefaultsGlobal } from '@/store/SettingsContext';
import { getIconById } from '@/assets/iconPack';

// Estado de Discord compartido entre acciones para iconos dinámicos
export let discordState = { connected: false, mute: false, deaf: false };

// Evento para notificar que el estado de Discord cambió (para refrescar iconos)
export const DISCORD_STATE_EVENT = 'deckforge:discordState';

function emitDiscordStateChange() {
  window.dispatchEvent(new CustomEvent(DISCORD_STATE_EVENT));
}

// Listener global para actualizar el estado
export function initDiscordStateListener(): () => void {
  if (!window.deckforge) return () => {};

  const unsubVoice = window.deckforge.discord.onVoiceState((state) => {
    discordState = { ...discordState, mute: state.mute, deaf: state.deaf };
    emitDiscordStateChange();
  });
  const unsubStatus = window.deckforge.discord.onStatus((status) => {
    discordState = { ...discordState, connected: status.connected };
    emitDiscordStateChange();
    if (status.connected) startPolling();
    else stopPolling();
  });

  // Obtener estado inicial
  window.deckforge.discord.getState().then((state) => {
    discordState = state;
    emitDiscordStateChange();
  });

  // Polling solo cuando Discord está conectado Y la ventana es visible
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const startPolling = () => {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
      if (!discordState.connected || document.hidden) return;
      try {
        const state = await window.deckforge!.discord.getState();
        if (state.mute !== discordState.mute || state.deaf !== discordState.deaf) {
          discordState = { ...discordState, mute: state.mute, deaf: state.deaf };
          emitDiscordStateChange();
        }
      } catch { /* ignore */ }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  };

  // Iniciar/parar según visibilidad
  const handleVisibility = () => {
    if (document.hidden) stopPolling();
    else if (discordState.connected) startPolling();
  };
  document.addEventListener('visibilitychange', handleVisibility);

  // Iniciar si ya estamos conectados
  if (discordState.connected) startPolling();

  return () => {
    unsubVoice();
    unsubStatus();
    stopPolling();
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

const discordPlugin: Plugin = {
  id: 'discord',
  name: 'Discord',
  icon: '💬',
  description: 'Control directo de Discord via RPC local',
  actions: [
    {
      id: generateId(),
      pluginId: 'discord',
      name: 'Toggle Mute',
      icon: '🎤',
      description: 'Activa/desactiva el micrófono',
      config: { command: 'toggleMute', _iconImage: getIconById('mic')?.svg, _iconActive: getIconById('mic-mute')?.svg },
    },
    {
      id: generateId(),
      pluginId: 'discord',
      name: 'Toggle Deafen',
      icon: '🎧',
      description: 'Activa/desactiva el audio',
      config: { command: 'toggleDeafen', _iconImage: getIconById('headphones')?.svg, _iconActive: getIconById('volume-mute')?.svg },
    },
  ],

  async execute(action: Action): Promise<void> {
    const { command } = action.config;

    if (!window.deckforge) {
      throw new Error('Electron API no disponible');
    }

    switch (command) {
      case 'toggleMute': {
        if (!discordState.connected) {
          const defaults = getPluginDefaultsGlobal('discord');
          const conn = await window.deckforge.discord.connect({ clientSecret: defaults.clientSecret || '' });
          if (!conn.success) throw new Error(conn.error || 'Discord no conectado');
          discordState.connected = true;
        }
        const res = await window.deckforge.discord.toggleMute();
        if (!res.success) throw new Error(res.error || 'Error al togglear mute');
        if (res.state) {
          discordState = { ...discordState, ...res.state };
        }
        emitDiscordStateChange();
        break;
      }

      case 'toggleDeafen': {
        if (!discordState.connected) {
          const defaults = getPluginDefaultsGlobal('discord');
          const conn = await window.deckforge.discord.connect({ clientSecret: defaults.clientSecret || '' });
          if (!conn.success) throw new Error(conn.error || 'Discord no conectado');
          discordState.connected = true;
        }
        const res = await window.deckforge.discord.toggleDeaf();
        if (!res.success) throw new Error(res.error || 'Error al togglear deafen');
        if (res.state) {
          discordState = { ...discordState, ...res.state };
        }
        emitDiscordStateChange();
        break;
      }

      default:
        throw new Error(`Comando Discord desconocido: ${command}`);
    }
  },

  // Icono dinámico: usa _iconActive (estado activo) y _iconImage (estado normal)
  getDynamicIcon(action: Action): string | undefined {
    const { command } = action.config;
    const iconActive = action.config._iconActive as string | undefined;
    const iconNormal = action.config._iconImage as string | undefined;

    if (command === 'toggleMute') {
      return discordState.mute ? (iconActive || getIconById('mic-mute')?.svg) : (iconNormal || getIconById('mic')?.svg);
    }
    if (command === 'toggleDeafen') {
      return discordState.deaf ? (iconActive || getIconById('volume-mute')?.svg) : (iconNormal || getIconById('headphones')?.svg);
    }
    if (command === 'connect') {
      return discordState.connected ? (iconActive || getIconById('discord')?.svg) : (iconNormal || undefined);
    }
    return iconNormal || undefined;
  },
};

export default discordPlugin;
