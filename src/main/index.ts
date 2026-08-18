import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { registerDialogHandlers } from './ipc/dialogs';
import { registerDeviceHandlers } from './ipc/devices';
import { registerDiscordHandlers } from './ipc/discord';
import { registerProfileHandlers } from './ipc/profiles';
import { registerActionHandlers } from './ipc/actions';
import { registerSettingsHandlers } from './ipc/settings';
import { registerAllPlugins, pluginManager } from './plugins';
import { deviceManager } from './core';
import { createLogger } from './lib/logger';

const log = createLogger('Main');

let mainWindow: BrowserWindow | null = null;

/** URL del dev server, si estamos en desarrollo. */
const devServerUrl =
  process.env.VITE_DEV_SERVER_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null);

const rendererEntry = join(__dirname, '../../dist/index.html');

function getWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * ¿Puede el renderer navegar a este destino?
 * El renderer tiene acceso a IPC que ejecuta programas, así que una navegación
 * a contenido remoto sería una escalada directa. Solo se permite el propio origen.
 */
function isAllowedNavigation(target: string): boolean {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (devServerUrl) {
    try {
      return url.origin === new URL(devServerUrl).origin;
    } catch {
      return false;
    }
  }
  if (url.protocol !== 'file:') return false;
  // Solo el bundle propio, no cualquier archivo del disco.
  const requested = decodeURIComponent(url.pathname).replace(/^\//, '');
  return join(requested) === join(rendererEntry);
}

function hardenWebContents(win: BrowserWindow): void {
  // Nada de ventanas nuevas desde el renderer. Los enlaces http/https se
  // delegan al navegador del sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol === 'http:' || protocol === 'https:') {
        void shell.openExternal(url);
      } else {
        log.warn(`Blocked window.open with protocol "${protocol}"`);
      }
    } catch {
      log.warn('Blocked window.open with malformed URL');
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      log.warn(`Blocked navigation to: ${url}`);
    }
  });

  // Un webview embebido heredaría el acceso a IPC: se prohíbe.
  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
    log.warn('Blocked webview attachment');
  });

  // El selector de dispositivos de audio necesita 'media'. Todo lo demás
  // (geolocalización, notificaciones, etc.) no tiene por qué concederse.
  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = permission === 'media';
    if (!allowed) log.warn(`Denied permission request: ${permission}`);
    callback(allowed);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: 'DeckForge',
    frame: true,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  hardenWebContents(mainWindow);

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(rendererEntry);
  }

  // DevTools solo en builds sin empaquetar, nunca en la app distribuida.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Orden importante:
  // 1) plugins registrados — registerDiscordHandlers necesita el plugin 'discord'
  // 2) handlers IPC registrados — el renderer invoca en cuanto carga, y un
  //    invoke sin handler se rechaza y deja la UI en blanco
  // 3) ventana creada
  // 4) initialize() de los plugins, que puede tardar y ya no bloquea a nadie
  registerAllPlugins();

  registerDialogHandlers(getWindow);
  registerDeviceHandlers(getWindow);
  registerDiscordHandlers(getWindow);
  registerProfileHandlers(getWindow);
  registerActionHandlers(getWindow);
  registerSettingsHandlers();

  createWindow();

  await pluginManager.initializeAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ─── Shutdown ───────────────────────────────────────────────────────────────

let cleanupDone = false;

/**
 * Libera recursos externos (puertos serie, socket de Discord) antes de salir.
 * Sin esto, el cierre dependía del teardown del proceso.
 */
app.on('before-quit', (event) => {
  if (cleanupDone) return;
  event.preventDefault();

  void (async () => {
    try {
      await deviceManager.disconnectAll();
      await pluginManager.disposeAll();
      log.info('Cleanup complete');
    } catch (e) {
      log.error('Error during shutdown cleanup:', e);
    } finally {
      cleanupDone = true;
      app.quit();
    }
  })();
});
