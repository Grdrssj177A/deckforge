import { DeckPlugin, ActionDefinition, ActionConfig, ActionContext } from '../core/types';
import { createLogger } from '../lib/logger';

const log = createLogger('HotkeyPlugin');

export class HotkeyPlugin implements DeckPlugin {
  readonly id = 'hotkey';
  readonly name = 'Hotkeys';
  readonly icon = '⌨️';
  readonly description = 'Simula atajos de teclado a nivel del sistema';

  readonly actions: ActionDefinition[] = [
    { id: 'custom', pluginId: 'hotkey', name: 'Custom Hotkey', description: 'Ejecuta un atajo personalizado', defaultConfig: { keys: '', delay: 0 } },
    { id: 'copy', pluginId: 'hotkey', name: 'Copy', description: 'Ctrl+C', defaultConfig: { keys: 'Ctrl+C', delay: 0 } },
    { id: 'paste', pluginId: 'hotkey', name: 'Paste', description: 'Ctrl+V', defaultConfig: { keys: 'Ctrl+V', delay: 0 } },
    { id: 'undo', pluginId: 'hotkey', name: 'Undo', description: 'Ctrl+Z', defaultConfig: { keys: 'Ctrl+Z', delay: 0 } },
    { id: 'save', pluginId: 'hotkey', name: 'Save', description: 'Ctrl+S', defaultConfig: { keys: 'Ctrl+S', delay: 0 } },
    { id: 'selectAll', pluginId: 'hotkey', name: 'Select All', description: 'Ctrl+A', defaultConfig: { keys: 'Ctrl+A', delay: 0 } },
  ];

  async initialize(): Promise<void> {
    // No requiere inicialización
  }

  async dispose(): Promise<void> {
    // No tiene recursos que liberar
  }

  async execute(actionId: string, config: ActionConfig, context: ActionContext): Promise<void> {
    const keys = config.keys as string;
    const delay = (config.delay as number) || 0;

    if (!keys) throw new Error('No hay atajo configurado');

    if (delay > 0) await new Promise((r) => setTimeout(r, delay));

    const robot = require('@hurdlegroup/robotjs');
    const { modifiers, key } = this.parseCombo(keys);

    if (!key) throw new Error(`No se pudo parsear: ${keys}`);

    robot.keyTap(key, modifiers);
  }

  private parseCombo(combo: string): { modifiers: string[]; key: string | null } {
    const KEY_MAP: Record<string, string> = {
      ...Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => [c, c.toLowerCase()])),
      ...Object.fromEntries('0123456789'.split('').map((c) => [c, c])),
      'F1': 'f1', 'F2': 'f2', 'F3': 'f3', 'F4': 'f4', 'F5': 'f5', 'F6': 'f6',
      'F7': 'f7', 'F8': 'f8', 'F9': 'f9', 'F10': 'f10', 'F11': 'f11', 'F12': 'f12',
      'Enter': 'enter', 'Tab': 'tab', 'Space': 'space', 'Escape': 'escape', 'Esc': 'escape',
      'Backspace': 'backspace', 'Delete': 'delete', 'Insert': 'insert',
      'Home': 'home', 'End': 'end', 'PageUp': 'pageup', 'PageDown': 'pagedown',
      'Up': 'up', 'Down': 'down', 'Left': 'left', 'Right': 'right',
      'PrintScreen': 'printscreen', 'Pause': 'pause',
      'VolumeMute': 'audio_mute', 'VolumeDown': 'audio_vol_down', 'VolumeUp': 'audio_vol_up',
      'MediaNext': 'audio_next', 'MediaPrev': 'audio_prev', 'MediaStop': 'audio_stop', 'MediaPlay': 'audio_play',
    };
    const MOD_MAP: Record<string, string> = {
      'Ctrl': 'control', 'Control': 'control', 'Shift': 'shift', 'Alt': 'alt', 'Win': 'command',
    };

    const parts = combo.split('+').map((p) => p.trim());
    const modifiers: string[] = [];
    let key: string | null = null;

    for (const part of parts) {
      const mod = MOD_MAP[part] || MOD_MAP[part.charAt(0).toUpperCase() + part.slice(1)];
      if (mod) {
        modifiers.push(mod);
      } else {
        key = KEY_MAP[part] || KEY_MAP[part.toUpperCase()] || part.toLowerCase();
      }
    }

    return { modifiers, key };
  }
}
