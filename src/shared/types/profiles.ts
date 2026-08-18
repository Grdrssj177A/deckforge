/**
 * Tipos compartidos para perfiles, páginas y botones.
 * Importado tanto por main como por renderer.
 */

import { ActionConfig } from './actions';

/**
 * Número máximo de slots por página (6x6).
 * Main y renderer deben usar esta constante, no un literal propio.
 */
export const MAX_BUTTONS = 36;

export interface Action {
  id: string;
  pluginId: string;
  name: string;
  icon: string;
  description: string;
  config: ActionConfig;
}

export interface ButtonSlot {
  position: number;
  action: Action | null;
  label?: string;
  color?: string;
  folderId?: string;
}

export interface Page {
  id: string;
  name: string;
  icon: string;
  buttons: ButtonSlot[];
}

export interface Profile {
  id: string;
  name: string;
  buttons: ButtonSlot[];
  pages: Page[];
  createdAt: number;
  updatedAt: number;
}
