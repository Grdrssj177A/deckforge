import { ipcMain } from 'electron';
import { settingsManager } from '../core';

/**
 * IPC handlers for global settings.
 * The renderer can read/update settings but never sees raw secrets.
 */
export function registerSettingsHandlers(): void {
  // Get all settings (public version — secrets masked)
  ipcMain.handle('settings:getAll', async () => {
    return { success: true, settings: settingsManager.getAllPublic() };
  });

  // Get all settings (with secrets — only for internal plugin use via actions)
  ipcMain.handle('settings:getAllFull', async () => {
    return { success: true, settings: settingsManager.getAll() };
  });

  // Update a section
  ipcMain.handle('settings:update', async (_event, section: string, values: any) => {
    settingsManager.update(section as any, values);
    return { success: true };
  });

  // Migrate from renderer localStorage (first time)
  ipcMain.handle('settings:migrate', async (_event, data: string) => {
    settingsManager.migrateFromRenderer(data);
    return { success: true };
  });
}
