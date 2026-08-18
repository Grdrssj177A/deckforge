import { ipcMain, dialog, BrowserWindow } from 'electron';
import { trustStore } from '../core/TrustStore';

/**
 * Una ruta elegida por el usuario en el diálogo nativo es, por definición,
 * autorizada por el usuario: se marca como confiable para que las acciones
 * configuradas desde la UI no pidan confirmación después.
 */
export function registerDialogHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('dialog:selectFile', async (_event, options?: { filters?: Electron.FileFilter[] }) => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    trustStore.trust(result.filePaths[0]);
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle('sound:getFilePath', async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'webm'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    trustStore.trust(result.filePaths[0]);
    return result.filePaths[0];
  });
}
