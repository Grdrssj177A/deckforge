import { ipcMain } from 'electron';
import * as http from 'http';
import { settingsManager } from '../core';
import { createLogger } from '../lib/logger';
import { ValidationError, validateLocalHost } from '../lib/validate';

const log = createLogger('SettingsIPC');

/** Convierte un error en un mensaje presentable, sin filtrar internals. */
function toErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * IPC handlers for global settings.
 * The renderer can read/update settings but never sees raw secrets.
 */
export function registerSettingsHandlers(): void {
  // Get all settings (public version — secrets masked)
  ipcMain.handle('settings:getAll', async () => {
    return { success: true, settings: settingsManager.getAllPublic() };
  });

  // Update a section. La validación vive en SettingsManager; aquí solo se
  // traduce el fallo a una respuesta que el renderer pueda mostrar.
  ipcMain.handle('settings:update', async (_event, section: string, values: any) => {
    try {
      settingsManager.update(section as any, values);
      return { success: true };
    } catch (error) {
      log.warn(`settings:update rejected for "${section}": ${toErrorMessage(error)}`);
      return { success: false, error: toErrorMessage(error) };
    }
  });

  // Migrate from renderer localStorage (first time)
  ipcMain.handle('settings:migrate', async (_event, data: string) => {
    try {
      settingsManager.migrateFromRenderer(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  });

  // Nanoleaf: emparejar (obtener token)
  ipcMain.handle('nanoleaf:pair', async (_event, ip: string) => {
    let host: string;
    try {
      host = validateLocalHost(ip, 'IP de Nanoleaf');
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }

    log.info(`Pairing Nanoleaf at ${host}...`);
    return new Promise((resolve) => {
      const req = http.request({ hostname: host, port: 16021, path: '/api/v1/new', method: 'POST', timeout: 5000 }, (res) => {
        let data = '';
        let tooLarge = false;
        res.on('data', (chunk) => {
          if (tooLarge) return;
          data += chunk;
          if (data.length > 64 * 1024) {
            tooLarge = true;
            req.destroy();
            resolve({ success: false, error: 'Respuesta demasiado grande del panel' });
          }
        });
        res.on('end', () => {
          if (tooLarge) return;
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode === 200 && typeof parsed.auth_token === 'string' && parsed.auth_token) {
              log.info(`Nanoleaf paired, token: ${parsed.auth_token.slice(0, 8)}...`);
              resolve({ success: true, token: parsed.auth_token });
            } else {
              log.warn(`Nanoleaf pair failed: status ${res.statusCode}`);
              resolve({ success: false, error: `Status ${res.statusCode}: ¿Mantuviste el botón pulsado 5-7 segundos?` });
            }
          } catch {
            resolve({ success: false, error: 'Respuesta inválida del panel' });
          }
        });
      });
      req.on('error', (e) => {
        log.error(`Nanoleaf pair connection error: ${e.message}`);
        resolve({ success: false, error: `No se pudo conectar a ${host}:16021. ¿Está en la misma red?` });
      });
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
      req.end();
    });
  });
}
