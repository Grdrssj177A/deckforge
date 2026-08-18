import { ipcMain, dialog, BrowserWindow } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { profileManager } from '../core/ProfileManager';
import { createLogger } from '../lib/logger';

const log = createLogger('Profiles');

export function registerProfileHandlers(getWindow: () => BrowserWindow | null): void {

  // ─── Profile CRUD ─────────────────────────────────────────────────────────

  ipcMain.handle('profiles:getAll', async () => {
    return { profiles: profileManager.getAll(), activeId: profileManager.getActiveId() };
  });

  ipcMain.handle('profiles:setActive', async (_event, id: string) => {
    profileManager.setActive(id);
    return { success: true };
  });

  ipcMain.handle('profiles:create', async (_event, name: string) => {
    const profile = profileManager.create(name);
    return { success: true, profile };
  });

  ipcMain.handle('profiles:delete', async (_event, id: string) => {
    profileManager.delete(id);
    return { success: true };
  });

  ipcMain.handle('profiles:rename', async (_event, id: string, name: string) => {
    profileManager.rename(id, name);
    return { success: true };
  });

  ipcMain.handle('profiles:duplicate', async (_event, id: string) => {
    const dup = profileManager.duplicate(id);
    return { success: !!dup, profile: dup };
  });

  // ─── Button operations ────────────────────────────────────────────────────

  ipcMain.handle('profiles:assignAction', async (_event, profileId: string, pageId: string | null, position: number, action: any) => {
    profileManager.assignAction(profileId, pageId, position, action);
    return { success: true };
  });

  ipcMain.handle('profiles:removeAction', async (_event, profileId: string, pageId: string | null, position: number) => {
    profileManager.removeAction(profileId, pageId, position);
    return { success: true };
  });

  ipcMain.handle('profiles:moveButton', async (_event, profileId: string, pageId: string | null, from: number, to: number) => {
    profileManager.moveButton(profileId, pageId, from, to);
    return { success: true };
  });

  // ─── Folders ──────────────────────────────────────────────────────────────

  ipcMain.handle('profiles:createFolder', async (_event, profileId: string, pageId: string | null, position: number, name: string, icon: string) => {
    const folderId = profileManager.createFolder(profileId, pageId, position, name, icon);
    return { success: true, folderId };
  });

  ipcMain.handle('profiles:deleteFolder', async (_event, profileId: string, folderId: string) => {
    profileManager.deleteFolder(profileId, folderId);
    return { success: true };
  });

  // ─── Migration from localStorage (called once by renderer on first load) ──

  ipcMain.handle('profiles:migrate', async (_event, data: string) => {
    profileManager.migrateFromLocalStorage(data);
    return { success: true };
  });

  // ─── Export/Import ────────────────────────────────────────────────────────

  ipcMain.handle('profiles:export', async (_event, data: string) => {
    const win = getWindow();
    if (!win) return { success: false, error: 'No window' };
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
      return { success: false, error: String(error) };
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
      const parsed = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null) {
        return { success: false, error: 'Formato inválido' };
      }
      return { success: true, data: content };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

