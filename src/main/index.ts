import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { registerDialogHandlers } from './ipc/dialogs';
import { registerDeviceHandlers } from './ipc/devices';
import { registerDiscordHandlers } from './ipc/discord';
import { registerProfileHandlers } from './ipc/profiles';
import { registerActionHandlers } from './ipc/actions';
import { registerAllPlugins, pluginManager } from './plugins';

let mainWindow: BrowserWindow | null = null;

function getWindow(): BrowserWindow | null {
  return mainWindow;
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
    },
  });

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  createWindow();

  // Register and initialize plugins
  registerAllPlugins();
  await pluginManager.initializeAll();

  // Register all IPC handlers
  registerDialogHandlers(getWindow);
  registerDeviceHandlers(getWindow);
  registerDiscordHandlers(getWindow);
  registerProfileHandlers(getWindow);
  registerActionHandlers(getWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
