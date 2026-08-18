import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { registerDialogHandlers } from './ipc/dialogs';
import { registerSystemHandlers } from './ipc/system';
import { registerHotkeyHandlers } from './ipc/hotkey';
import { registerNanoleafHandlers } from './ipc/nanoleaf';
import { registerSerialHandlers } from './ipc/serial';
import { registerDiscordHandlers } from './ipc/discord';

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

app.whenReady().then(() => {
  createWindow();

  // Register all IPC handlers
  registerDialogHandlers(getWindow);
  registerSystemHandlers();
  registerHotkeyHandlers();
  registerNanoleafHandlers();
  registerSerialHandlers(getWindow);
  registerDiscordHandlers(getWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
