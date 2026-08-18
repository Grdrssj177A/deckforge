import { Plugin, generateId } from '@/types';
import { getIconById } from '@/assets/iconPack';

// Estado de Discord (actualizado via eventos push del main)
export let discordState = { connected: false, mute: false, deaf: false };

export const DISCORD_STATE_EVENT = 'deckforge:discordState';

function emitDiscordStateChange() {
  window.dispatchEvent(new CustomEvent(DISCORD_STATE_EVENT));
}

/**
 * Inicializa los listeners de estado de Discord.
 * Escucha eventos push del main (voiceState, status).
 */
export function initDiscordStateListener(): () => void {
  if (!window.deckforge) return () => {};

  const unsubVoice = window.deckforge.discord.onVoiceState((state) => {
    discordState = { ...discordState, mute: state.mute, deaf: state.deaf };
    emitDiscordStateChange();
  });
  const unsubStatus = window.deckforge.discord.onStatus((status) => {
    discordState = { ...discordState, connected: status.connected };
    emitDiscordStateChange();
  });

  // Estado inicial
  window.deckforge.discord.getState().then((state) => {
    discordState = state;
    emitDiscordStateChange();
  });

  return () => { unsubVoice(); unsubStatus(); };
}

/**
 * Discord plugin (renderer side) — metadata + iconos dinámicos.
 * Ejecución delegada al main via actions:execute.
 */
const discordPlugin: Plugin = {
  id: 'discord',
  name: 'Discord',
  icon: '💬',
  description: 'Control directo de Discord via RPC local',
  actions: [
    { id: generateId(), pluginId: 'discord', name: 'Toggle Mute', icon: '🎤', description: 'Activa/desactiva micrófono', config: { command: 'toggleMute', _iconImage: getIconById('mic')?.svg, _iconActive: getIconById('mic-mute')?.svg } },
    { id: generateId(), pluginId: 'discord', name: 'Toggle Deafen', icon: '🎧', description: 'Activa/desactiva audio', config: { command: 'toggleDeafen', _iconImage: getIconById('headphones')?.svg, _iconActive: getIconById('headphones-off')?.svg } },
  ],

  async execute(): Promise<void> {
    // Ejecución delegada al main via actions:execute IPC
  },

  getDynamicIcon(action) {
    const { command } = action.config;
    const iconActive = action.config._iconActive as string | undefined;
    const iconNormal = action.config._iconImage as string | undefined;

    if (command === 'toggleMute') {
      return discordState.mute ? (iconActive || getIconById('mic-mute')?.svg) : (iconNormal || getIconById('mic')?.svg);
    }
    if (command === 'toggleDeafen') {
      return discordState.deaf ? (iconActive || getIconById('headphones-off')?.svg) : (iconNormal || getIconById('headphones')?.svg);
    }
    return iconNormal || undefined;
  },
};

export default discordPlugin;
