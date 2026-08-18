import { ipcMain, BrowserWindow } from 'electron';
import { deviceManager } from '../core';
import { eventBus } from '../core';
import { createLogger } from '../lib/logger';

const log = createLogger('DevicesIPC');

/**
 * IPC handlers genéricos para dispositivos.
 * La UI no sabe si es Serial, USB HID o Virtual.
 * Reemplaza al antiguo ipc/serial.ts
 */
export function registerDeviceHandlers(getWindow: () => BrowserWindow | null): void {
  // Listar dispositivos disponibles (puertos/devices detectados)
  ipcMain.handle('devices:listAvailable', async () => {
    try {
      const ports = await deviceManager.listAvailable();
      return { success: true, ports };
    } catch (error) {
      return { success: false, ports: [], error: String(error) };
    }
  });

  // Listar dispositivos actualmente conectados
  ipcMain.handle('devices:listConnected', async () => {
    return { success: true, devices: deviceManager.getConnectedDevices() };
  });

  // Conectar un dispositivo (por ahora solo Arduino serial)
  ipcMain.handle('devices:connect', async (_event, portPath: string, baudRate?: number) => {
    try {
      const id = await deviceManager.connectArduino(portPath, baudRate);
      return { success: true, deviceId: id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Desconectar un dispositivo
  ipcMain.handle('devices:disconnect', async (_event, deviceId: string) => {
    try {
      await deviceManager.disconnect(deviceId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ─── EventBus → Renderer (push events) ───────────────────────────────────

  // Propagar button:press al renderer
  eventBus.on('button:press', (data) => {
    const win = getWindow();
    if (win) win.webContents.send('device:buttonPress', data.buttonId);
  });

  // Propagar device:connected/disconnected al renderer
  eventBus.on('device:connected', (data) => {
    const win = getWindow();
    if (win) win.webContents.send('device:status', { connected: true, deviceId: data.deviceId });
  });

  eventBus.on('device:disconnected', (data) => {
    const win = getWindow();
    if (win) win.webContents.send('device:status', { connected: false, deviceId: data.deviceId });
  });
}
