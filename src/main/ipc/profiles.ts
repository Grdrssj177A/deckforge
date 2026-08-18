import { ipcMain, dialog, BrowserWindow } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { profileManager, MutationResult } from '../core/ProfileManager';
import { sessionManager } from '../core';
import { createLogger } from '../lib/logger';

const log = createLogger('Profiles');

/** Tamaño máximo de un archivo de perfiles importado. */
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

/**
 * Traduce el resultado de una mutación a la respuesta IPC.
 * Antes todos estos handlers devolvían `{ success: true }` a ciegas, así que un
 * perfil inexistente o un fallo de escritura eran indistinguibles del éxito.
 */
function toResponse(result: MutationResult): { success: boolean; error?: string } {
  if (result.ok) return { success: true };
  log.warn(`Operation rejected: ${result.error}`);
  return { success: false, error: result.error };
}

export function registerProfileHandlers(getWindow: () => BrowserWindow | null): void {

  // ─── Profile CRUD ─────────────────────────────────────────────────────────

  ipcMain.handle('profiles:getAll', async () => {
    return { profiles: profileManager.getAll(), activeId: profileManager.getActiveId() };
  });

  ipcMain.handle('profiles:setActive', async (_event, id: string) => {
    const result = profileManager.setActive(id);
    // Las sesiones de dispositivo cachean el perfil: sin esto, un botón físico
    // seguiría ejecutando el perfil anterior tras cambiar de perfil en la UI.
    if (result.ok) sessionManager.syncProfile(id);
    return toResponse(result);
  });

  ipcMain.handle('profiles:create', async (_event, name: string) => {
    const { result, profile } = profileManager.create(name);
    return { ...toResponse(result), profile: profile ?? undefined };
  });

  ipcMain.handle('profiles:delete', async (_event, id: string) => {
    const result = profileManager.delete(id);
    if (result.ok) sessionManager.syncProfile(profileManager.getActiveId());
    return toResponse(result);
  });

  ipcMain.handle('profiles:rename', async (_event, id: string, name: string) => {
    return toResponse(profileManager.rename(id, name));
  });

  ipcMain.handle('profiles:duplicate', async (_event, id: string) => {
    const { result, profile } = profileManager.duplicate(id);
    return { ...toResponse(result), profile: profile ?? undefined };
  });

  // ─── Button operations ────────────────────────────────────────────────────

  ipcMain.handle('profiles:assignAction', async (_event, profileId: string, pageId: string | null, position: number, action: unknown) => {
    return toResponse(profileManager.assignAction(profileId, pageId, position, action));
  });

  ipcMain.handle('profiles:removeAction', async (_event, profileId: string, pageId: string | null, position: number) => {
    return toResponse(profileManager.removeAction(profileId, pageId, position));
  });

  ipcMain.handle('profiles:moveButton', async (_event, profileId: string, pageId: string | null, from: number, to: number) => {
    return toResponse(profileManager.moveButton(profileId, pageId, from, to));
  });

  // ─── Folders ──────────────────────────────────────────────────────────────

  ipcMain.handle('profiles:createFolder', async (_event, profileId: string, pageId: string | null, position: number, name: string, icon: string) => {
    const { result, folderId } = profileManager.createFolder(profileId, pageId, position, name, icon);
    return { ...toResponse(result), folderId: folderId ?? undefined };
  });

  ipcMain.handle('profiles:deleteFolder', async (_event, profileId: string, folderId: string) => {
    return toResponse(profileManager.deleteFolder(profileId, folderId));
  });

  // ─── Migration from localStorage (called once by renderer on first load) ──

  ipcMain.handle('profiles:migrate', async (_event, data: string) => {
    if (typeof data !== 'string' || data.length > MAX_IMPORT_BYTES) {
      return { success: false, error: 'Datos de migración inválidos' };
    }
    const result = profileManager.migrateFromLocalStorage(data);
    if (result.ok) sessionManager.syncProfile(profileManager.getActiveId());
    return toResponse(result);
  });

  // ─── Export/Import ────────────────────────────────────────────────────────

  ipcMain.handle('profiles:export', async (_event, data: string) => {
    const win = getWindow();
    if (!win) return { success: false, error: 'No window' };
    if (typeof data !== 'string' || data.length > MAX_IMPORT_BYTES) {
      return { success: false, error: 'Datos de exportación inválidos' };
    }
    try {
      const result = await dialog.showSaveDialog(win, {
        title: 'Exportar perfiles',
        defaultPath: 'deckforge-profiles.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return { success: false, error: 'Cancelado' };
      await writeFile(result.filePath, data, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Export failed: ${msg}`);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('profiles:import', async () => {
    const win = getWindow();
    if (!win) return { success: false, error: 'No window' };
    try {
      const result = await dialog.showOpenDialog(win, {
        title: 'Importar perfiles',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelado' };
      const content = await readFile(result.filePaths[0], 'utf-8');
      if (content.length > MAX_IMPORT_BYTES) {
        return { success: false, error: 'El archivo es demasiado grande' };
      }
      const parsed = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null) {
        return { success: false, error: 'Formato inválido' };
      }
      return { success: true, data: content };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  /**
   * Import en bloque: valida y persiste en una sola escritura.
   * El renderer ya no reconstruye los perfiles botón a botón.
   */
  ipcMain.handle('profiles:importProfiles', async (_event, data: string) => {
    if (typeof data !== 'string' || data.length > MAX_IMPORT_BYTES) {
      return { success: false, error: 'Datos de importación inválidos' };
    }
    const { result, imported } = profileManager.importProfiles(data);
    if (!result.ok) return toResponse(result);
    log.info(`Imported ${imported.length} profile(s)`);
    return { success: true, imported: imported.length };
  });
}
