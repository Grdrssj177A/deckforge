import { ProfileManager } from './ProfileManager';
import { ActionManager, isCooldownError } from './ActionManager';
import { ActionConfig, ActionContext } from './types';
import { createLogger } from '../lib/logger';

const log = createLogger('SessionManager');

interface DeviceSession {
  deviceId: string;
  profileId: string;
  pageStack: string[]; // Navigation stack (folder IDs)
}

/**
 * SessionManager: sabe qué perfil y página está activa para cada dispositivo.
 * Resuelve qué acción ejecutar dado un deviceId + buttonId.
 * Esto permite que el hardware funcione sin depender de React.
 */
export class SessionManager {
  private profileManager: ProfileManager;
  private actionManager: ActionManager;
  private sessions = new Map<string, DeviceSession>();

  constructor(profileManager: ProfileManager, actionManager: ActionManager) {
    this.profileManager = profileManager;
    this.actionManager = actionManager;
  }

  /**
   * Obtiene o crea la sesión para un dispositivo.
   * Por defecto usa el perfil activo y la página root.
   */
  private getSession(deviceId: string): DeviceSession {
    if (!this.sessions.has(deviceId)) {
      this.sessions.set(deviceId, {
        deviceId,
        profileId: this.profileManager.getActiveId(),
        pageStack: [],
      });
    }
    return this.sessions.get(deviceId)!;
  }

  getCurrentPageId(deviceId: string): string | null {
    const session = this.getSession(deviceId);
    return session.pageStack.length > 0 ? session.pageStack[session.pageStack.length - 1] : null;
  }

  navigate(deviceId: string, pageId: string): void {
    const session = this.getSession(deviceId);
    session.pageStack.push(pageId);
  }

  navigateBack(deviceId: string): boolean {
    const session = this.getSession(deviceId);
    if (session.pageStack.length > 0) {
      session.pageStack.pop();
      return true;
    }
    return false;
  }

  /** Sync session when profile changes from UI */
  syncProfile(profileId: string): void {
    for (const session of this.sessions.values()) {
      session.profileId = profileId;
      session.pageStack = []; // Reset navigation on profile change
    }
  }

  /**
   * Resuelve y ejecuta la acción para un botón físico.
   * Este es el flujo completo: device → session → profile → button → action.
   * NO depende de React.
   */
  async handleButtonPress(deviceId: string, buttonId: number): Promise<'success' | 'error' | 'empty' | 'navigate' | 'back'> {
    const session = this.getSession(deviceId);
    const profile = this.profileManager.getById(session.profileId) || this.profileManager.getActive();
    let pageId = this.getCurrentPageId(deviceId);

    // Si la página ya no existe (carpeta borrada, perfil cambiado), se descarta
    // la navegación en vez de indexar los botones de la raíz con el offset de
    // carpeta, que ejecutaría la acción equivocada.
    if (pageId && !profile.pages.some((p) => p.id === pageId)) {
      log.warn(`Stale page "${pageId}" for device "${deviceId}", resetting navigation`);
      session.pageStack = [];
      pageId = null;
    }

    const buttons = pageId
      ? profile.pages.find((p) => p.id === pageId)!.buttons
      : profile.buttons;

    // En folder: botón 0 = volver
    const isInFolder = !!pageId;
    if (isInFolder && buttonId === 0) {
      this.navigateBack(deviceId);
      return 'back';
    }

    // Ajustar índice (en folder, botón 0 = back, botones 1+ = slots 0+)
    const slotIndex = isInFolder ? buttonId - 1 : buttonId;

    if (slotIndex < 0 || slotIndex >= buttons.length) {
      return 'empty';
    }

    const slot = buttons[slotIndex];

    // Folder navigation
    if (slot.folderId) {
      this.navigate(deviceId, slot.folderId);
      return 'navigate';
    }

    // No action
    if (!slot.action) {
      return 'empty';
    }

    // Execute action
    const context: ActionContext = {
      deviceId,
      pageId: pageId || 'root',
      buttonId: slotIndex,
      profileId: session.profileId,
      modifiers: { shift: false, ctrl: false, alt: false },
    };

    try {
      // Las credenciales de Nanoleaf ya no se inyectan en la config: el plugin
      // las lee directamente del SettingsManager, para que no puedan llegar
      // desde una config manipulada.
      const config = { ...slot.action.config } as ActionConfig;

      const actionId = (slot.action.config.command as string) || slot.action.id;
      await this.actionManager.execute(slot.action.pluginId, actionId, config, context);
      return 'success';
    } catch (error) {
      if (isCooldownError(error)) return 'empty'; // Silently ignore cooldown
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Button ${buttonId} execution failed: ${msg}`);
      return 'error';
    }
  }
}
