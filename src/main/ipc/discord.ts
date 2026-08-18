import { ipcMain, app, BrowserWindow } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { DiscordRPC, VoiceState } from '../discord-rpc';

const DISCORD_CLIENT_ID = '1534670332009517136';

let discordRpc: DiscordRPC | null = null;

function loadDiscordToken(): string | null {
  try {
    const p = join(app.getPath('userData'), 'discord_token.txt');
    return existsSync(p) ? readFileSync(p, 'utf-8').trim() : null;
  } catch { return null; }
}

function saveDiscordToken(token: string): void {
  try { writeFileSync(join(app.getPath('userData'), 'discord_token.txt'), token, 'utf-8'); } catch { /* */ }
}

export function registerDiscordHandlers(getWindow: () => BrowserWindow | null): void {
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
}
