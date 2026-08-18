// ─── Plugin System ───────────────────────────────────────────────────────────

// Los tipos de dominio (acciones, botones, páginas, perfiles) viven en
// src/shared y se reexportan aquí. Antes estaban duplicados, lo que permitía
// que el renderer y el main divergieran en silencio.
export type { PluginId } from '@shared/types/plugins';
export type { ActionConfig, ActionContext, ActionState } from '@shared/types/actions';
export type { Action, ButtonSlot, Page, Profile } from '@shared/types/profiles';

import type { PluginId } from '@shared/types/plugins';
import type { Action, ButtonSlot } from '@shared/types/profiles';
import { MAX_BUTTONS as SHARED_MAX_BUTTONS } from '@shared/types/profiles';

/**
 * Plugin del renderer: solo metadata e iconos dinámicos.
 * La ejecución real vive en el main (excepto soundboard, que usa Web Audio).
 */
export interface Plugin {
  id: PluginId;
  name: string;
  icon: string;
  description: string;
  actions: Action[];
  execute: (action: Action) => Promise<void>;
  getDynamicIcon?: (action: Action) => string | undefined;
}

// ─── Store / Context ─────────────────────────────────────────────────────────

export interface PluginState {
  plugins: Plugin[];
  executing: boolean;
}

// ─── Electron API (expuesta por preload) ─────────────────────────────────────

// El contrato vive en src/shared para que preload y renderer no puedan divergir.
export type { DeckForgeAPI } from '@shared/types/api';
export type {
  ButtonFeedbackStatus,
  DeviceButtonEvent,
  DeviceStatusEvent,
} from '@shared/types/devices';

import type { DeckForgeAPI as DeckForgeAPIContract } from '@shared/types/api';

declare global {
  interface Window {
    deckforge?: DeckForgeAPIContract;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Máximo soportado (6x6). Definido en shared para que main y renderer coincidan. */
export const MAX_BUTTONS = SHARED_MAX_BUTTONS;

export function createEmptyButtons(total?: number): ButtonSlot[] {
  const count = total || MAX_BUTTONS;
  return Array.from({ length: count }, (_, i) => ({
    position: i,
    action: null,
  }));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
