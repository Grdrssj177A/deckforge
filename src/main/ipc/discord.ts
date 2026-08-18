import { ipcMain, app, BrowserWindow, safeStorage } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { DiscordRPC, VoiceState } from '../discord-rpc';
import { createLogger } from '../lib/logger';

const log = createLogger('Discord');
const DISCORD_CLIENT_ID = '1534670332009517136';
const TOKEN_PATH_ENCRYPTED = 'discord_token.enc';
const TOKEN_PATH_LEGACY = 'discord_token.txt';

let discordRpc: DiscordRPC | null = null;

function loadDiscordToken(): string | null {
  try {
    const encPath = join(app.getPath('userData'), TOKEN_PATH_ENCRYPTED);
    const legacyPath = join(app.getPath('userData'), TOKEN_PATH_LEGACY);

    // Intentar cargar token encriptado
    if (existsSync(encPath) && safeStorage.isEncryptionAvailable()) {
      const encrypted = readFileSync(encPath);
      return safeStorage.decryptString(encrypted);
    }

    // Migrar token legacy (.txt) a encriptado
    if (existsSync(legacyPath)) {
      const token = readFileSync(legacyPath, 'utf-8').trim();
      if (token) {
        saveDiscordToken(token); // Guarda encriptado
        unlinkSync(legacyPath); // Elimina el .txt
        log.info('Token migrado de .txt a safeStorage');
        return token;
      }
    }
  } catch (e) {
    log.error('Error loading token:', e);
  }
  return null;
}

function saveDiscordToken(token: string): void {
  try {
    const encPath = join(app.getPath('userData'), TOKEN_PATH_ENCRYPTED);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      writeFileSync(encPath, encrypted);
    } else {
      // Fallback si safeStorage no está disponible (raro en Windows/Mac)
      writeFileSync(encPath, token, 'utf-8');
    }
  } catch (e) {
    log.error('Error saving token:', e);
  }
}

export function registerDiscordHandlers(getWindow: () => BrowserWindow | null): void {
  // Inyectar handlers al DiscordPlugin del Core
  const { pluginManager } = require('../plugins');
  const discordPlugin = pluginManager.get('discord');
  if (discordPlugin) {
    discordPlugin.setExecuteHandler(async (action: string) => {
      if (!discordRpc?.isConnected) {
        // Auto-connect
        const savedToken = loadDiscordToken();
        if (savedToken) {
          discordRpc = new DiscordRPC(DISCORD_CLIENT_ID, '');
          discordRpc.on('voiceStateChange', (state: VoiceState) => {
            const win = getWindow();
            if (win) win.webContents.send('discord:voiceState', state);
          });
          discordRpc.on('disconnected', () => {
            const win = getWindow();
            if (win) win.webContents.send('discord:status', { connected: false });
          });
          await discordRpc.connectAndAuth(savedToken, '');
        }
        if (!discordRpc?.isConnected) return { success: false, error: 'Discord no conectado' };
      }

      if (action === 'toggleMute') {
        await discordRpc.getVoiceSettings();
        await new Promise((r) => setTimeout(r, 100));
        const fresh = await discordRpc.getVoiceSettings();
        await discordRpc.setMute(!fresh.mute);
        return { success: true, state: discordRpc.currentVoiceState };
      }
      if (action === 'toggleDeafen') {
        await discordRpc.getVoiceSettings();
        await new Promise((r) => setTimeout(r, 100));
        const fresh = await discordRpc.getVoiceSettings();
        await discordRpc.setDeaf(!fresh.deaf);
        return { success: true, state: discordRpc.currentVoiceState };
      }
      return { success: false, error: `Unknown action: ${action}` };
    });

    discordPlugin.setGetStateHandler(async () => {
      if (!discordRpc?.isConnected) return { connected: false, mute: false, deaf: false };
      try {
        const state = await discordRpc.getVoiceSettings();
        return { connected: true, ...state };
      } catch {
        return { connected: true, ...discordRpc.currentVoiceState };
      }
    });
  }

  ipcMain.handle('discord:connect', async (_event, options?: { clientId?: string; clientSecret?: string }) => {
    try {
      if (discordRpc?.isConnected) return { success: true, state: discordRpc.currentVoiceState };

      const clientId = options?.clientId || DISCORD_CLIENT_ID;
      const clientSecret = options?.clientSecret || '';
      discordRpc = new DiscordRPC(clientId, clientSecret);

      discordRpc.on('voiceStateChange', (state: VoiceState) => {
        const win = getWindow();
        if (win) win.webContents.send('discord:voiceState', state);
      });

      discordRpc.on('disconnected', () => {
        const win = getWindow();
        if (win) win.webContents.send('discord:status', { connected: false });
      });

      discordRpc.on('authenticated', () => {
        const token = discordRpc?.getAccessToken();
        if (token) saveDiscordToken(token);
      });

      await discordRpc.connectAndAuth(loadDiscordToken(), clientSecret);

      const win = getWindow();
      if (win) win.webContents.send('discord:status', { connected: true });
      return { success: true, state: discordRpc.currentVoiceState };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('discord:disconnect', async () => {
    if (discordRpc) { discordRpc.disconnect(); discordRpc = null; }
    return { success: true };
  });

  ipcMain.handle('discord:getState', async () => {
    if (!discordRpc?.isConnected) return { connected: false, mute: false, deaf: false };
    try {
      const state = await discordRpc.getVoiceSettings();
      return { connected: true, ...state };
    } catch { return { connected: true, ...discordRpc.currentVoiceState }; }
  });

  ipcMain.handle('discord:toggleMute', async () => {
    if (!discordRpc?.isConnected) return { success: false, error: 'Discord no conectado' };
    try {
      await discordRpc.getVoiceSettings();
      await new Promise((r) => setTimeout(r, 100));
      const fresh = await discordRpc.getVoiceSettings();
      await discordRpc.setMute(!fresh.mute);
      return { success: true, state: discordRpc.currentVoiceState };
    } catch (error) { return { success: false, error: String(error) }; }
  });

  ipcMain.handle('discord:toggleDeaf', async () => {
    if (!discordRpc?.isConnected) return { success: false, error: 'Discord no conectado' };
    try {
      await discordRpc.getVoiceSettings();
      await new Promise((r) => setTimeout(r, 100));
      const fresh = await discordRpc.getVoiceSettings();
      await discordRpc.setDeaf(!fresh.deaf);
      return { success: true, state: discordRpc.currentVoiceState };
    } catch (error) { return { success: false, error: String(error) }; }
  });

  ipcMain.handle('discord:setMute', async (_event, mute: boolean) => {
    if (!discordRpc?.isConnected) return { success: false, error: 'Discord no conectado' };
    try { await discordRpc.setMute(mute); return { success: true, state: discordRpc.currentVoiceState }; }
    catch (error) { return { success: false, error: String(error) }; }
  });

  ipcMain.handle('discord:setDeaf', async (_event, deaf: boolean) => {
    if (!discordRpc?.isConnected) return { success: false, error: 'Discord no conectado' };
    try { await discordRpc.setDeaf(deaf); return { success: true, state: discordRpc.currentVoiceState }; }
    catch (error) { return { success: false, error: String(error) }; }
  });

  // Auto-connect al arrancar cuando el renderer esté listo
  ipcMain.handle('app:rendererReady', async () => {
    // Auto-connect Discord si hay token guardado
    const savedToken = loadDiscordToken();
    if (savedToken && !discordRpc?.isConnected) {
      try {
        discordRpc = new DiscordRPC(DISCORD_CLIENT_ID, '');

        discordRpc.on('voiceStateChange', (state: VoiceState) => {
          const win = getWindow();
          if (win) win.webContents.send('discord:voiceState', state);
        });

        discordRpc.on('disconnected', () => {
          const win = getWindow();
          if (win) win.webContents.send('discord:status', { connected: false });
        });

        discordRpc.on('authenticated', () => {
          const token = discordRpc?.getAccessToken();
          if (token) saveDiscordToken(token);
        });

        await discordRpc.connectAndAuth(savedToken, '');

        const win = getWindow();
        if (win) win.webContents.send('discord:status', { connected: true });
        log.info('Auto-connected to Discord');
      } catch {
        log.info('Auto-connect failed (Discord not running or token expired)');
        discordRpc = null;
      }
    }
    return { success: true };
  });
}
