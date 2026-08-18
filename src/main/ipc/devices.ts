import { ipcMain, BrowserWindow } from 'electron';
import { deviceManager, eventBus, sessionManager } from '../core';
import { DeviceButtonEvent, DeviceStatusEvent } from '../../shared/types/devices';
import { createLogger } from '../lib/logger';

const log = createLogger('DevicesIPC');

/**
 * Envía al renderer solo si la ventana sigue viva.
 * Los handlers de botón son asíncronos: entre la pulsación y el envío la
 * ventana puede haberse cerrado, y `send` sobre un webContents destruido lanza.
 */
function safeSend(win: BrowserWindow | null, channel: string, payload: unknown): void {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  try {
    win.webContents.send(channel, payload);
  } catch (e) {
    log.error(`Failed to send "${channel}":`, e);
  }
}

/**
 * IPC handlers genéricos para dispositivos.
 * La UI no sabe si es Serial, USB HID o Virtual.
 */
export function registerDeviceHandlers(getWindow: () => BrowserWindow | null): void {
  // Listar dispositivos disponibles (puertos/devices detectados)
  ipcMain.handle('devices:listAvailable', async () => {
    try {
      const ports = await deviceManager.listAvailable();
      return { success: true, ports };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, ports: [], error: msg };
    }
  });

  // Listar dispositivos actualmente conectados
  ipcMain.handle('devices:listConnected', async () => {
    return { success: true, devices: deviceManager.getConnectedDevices() };
  });

  // Conectar un dispositivo (por ahora solo Arduino serial)
  ipcMain.handle('devices:connect', async (_event, portPath: string, baudRate?: number) => {
    if (typeof portPath !== 'string' || !portPath.trim()) {
      return { success: false, error: 'Puerto no válido' };
    }
    const baud = baudRate === undefined ? 9600 : Number(baudRate);
    if (!Number.isFinite(baud) || baud <= 0) {
      return { success: false, error: 'Baud rate no válido' };
    }
    try {
      const id = await deviceManager.connectArduino(portPath.trim(), baud);
      return { success: true, deviceId: id };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Desconectar un dispositivo
  ipcMain.handle('devices:disconnect', async (_event, deviceId: string) => {
    if (typeof deviceId !== 'string' || !deviceId) {
      return { success: false, error: 'deviceId no válido' };
    }
    try {
      await deviceManager.disconnect(deviceId);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // ─── EventBus → SessionManager → Renderer feedback ───────────────────────

  // Cuando un dispositivo físico pulsa un botón, el Core resuelve y ejecuta.
  // El handler es async y el EventBus no espera su promesa, así que aquí se
  // captura todo: un throw se convertiría en un unhandled rejection.
  eventBus.on('button:press', (data) => {
    void (async () => {
      try {
        const status = await sessionManager.handleButtonPress(data.deviceId, data.buttonId);
        const payload: DeviceButtonEvent = {
          deviceId: data.deviceId,
          buttonId: data.buttonId,
          status,
        };
        safeSend(getWindow(), 'device:buttonFeedback', payload);
      } catch (e) {
        log.error(`Unhandled error resolving button ${data.buttonId}:`, e);
      }
    })();
  });

  // Propagar device:connected/disconnected al renderer
  eventBus.on('device:connected', (data) => {
    const payload: DeviceStatusEvent = { connected: true, deviceId: data.deviceId };
    safeSend(getWindow(), 'device:status', payload);
  });

  eventBus.on('device:disconnected', (data) => {
    const payload: DeviceStatusEvent = { connected: false, deviceId: data.deviceId };
    safeSend(getWindow(), 'device:status', payload);
  });

  eventBus.on('device:error', (data) => {
    log.error(`Device "${data.deviceId}" error: ${data.error}`);
    const payload: DeviceStatusEvent = { connected: false, deviceId: data.deviceId };
    safeSend(getWindow(), 'device:status', payload);
  });
}
