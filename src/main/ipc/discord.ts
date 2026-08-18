import { ipcMain, app, BrowserWindow, safeStorage } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { DiscordRPC, VoiceState } from '../discord-rpc';
import { pluginManager } from '../core/PluginManager';
import { DiscordPlugin } from '../plugins/discord.plugin';
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

  function send(channel: string, payload: unknown): void {
    const win = getWindow();
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
    try {
      win.webContents.send(channel, payload);
    } catch (e) {
      log.error(`Failed to send "${channel}":`, e);
    }
  }

  /**
   * Crea un cliente RPC con sus listeners ya enganchados.
   * Este bloque estaba copiado en tres sitios (connect, auto-connect y el
   * handler inyectado en el plugin).
   */
  function createClient(clientId: string, clientSecret: string): DiscordRPC {
    const rpc = new DiscordRPC(clientId, clientSecret);

    rpc.on('voiceStateChange', (state: VoiceState) => {
      send('discord:voiceState', state);
    });

    rpc.on('disconnected', () => {
      send('discord:status', { connected: false });
    });

    rpc.on('authenticated', () => {
      const token = rpc.getAccessToken();
      if (token) saveDiscordToken(token);
    });

    return rpc;
  }

  /** Conexión en curso, para que dos disparos simultáneos no abran dos clientes. */
  let connecting: Promise<boolean> | null = null;

  /**
   * Garantiza que hay una sesión RPC utilizable.
   * `interactive` permite el flujo completo de autorización (lo pide el usuario);
   * en el auto-connect solo se intenta con el token guardado.
   */
  async function ensureConnected(options: {
    clientId?: string;
    clientSecret?: string;
    interactive: boolean;
  }): Promise<boolean> {
    if (discordRpc?.isConnected) return true;
    if (connecting) return connecting;

    connecting = (async () => {
      const savedToken = loadDiscordToken();
      if (!savedToken && !options.interactive) return false;

      const clientId = options.clientId || DISCORD_CLIENT_ID;
      const clientSecret = options.clientSecret || '';

      const rpc = createClient(clientId, clientSecret);
      try {
        await rpc.connectAndAuth(savedToken, clientSecret);
        discordRpc = rpc;
        send('discord:status', { connected: true });
        return true;
      } catch (e) {
        // Sin esto el cliente fallido quedaba asignado y con listeners activos.
        rpc.disconnect();
        if (discordRpc === rpc) discordRpc = null;
        throw e;
      }
    })().finally(() => { connecting = null; });

    return connecting;
  }

  /**
   * Invierte mute o deafen. Antes cada uno de los cuatro call sites hacía
   * getVoiceSettings → sleep(100) → getVoiceSettings → set, tres viajes RPC y
   * 100 ms de latencia añadida por pulsación.
   */
  async function toggle(field: 'mute' | 'deaf'): Promise<{ success: boolean; state?: VoiceState; error?: string }> {
    if (!discordRpc?.isConnected) {
      return { success: false, error: 'Discord no conectado' };
    }
    try {
      const state = field === 'mute' ? await discordRpc.toggleMute() : await discordRpc.toggleDeaf();
      return { success: true, state };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async function readState(): Promise<{ connected: boolean; mute: boolean; deaf: boolean }> {
    if (!discordRpc?.isConnected) return { connected: false, mute: false, deaf: false };
    try {
      const state = await discordRpc.getVoiceSettings();
      return { connected: true, ...state };
    } catch {
      return { connected: true, ...discordRpc.currentVoiceState };
    }
  }

  // ─── Inyección en el plugin del Core ──────────────────────────────────────

  const discordPlugin = pluginManager.get('discord') as DiscordPlugin | undefined;
  if (discordPlugin) {
    discordPlugin.setExecuteHandler(async (action: string) => {
      if (!discordRpc?.isConnected) {
        // Auto-connect no interactivo: si no hay token guardado, no se abre
        // ningún diálogo de autorización a mitad de una pulsación.
        try {
          const ok = await ensureConnected({ interactive: false });
          if (!ok) return { success: false, error: 'Discord no conectado' };
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
      }

      if (action === 'toggleMute') return toggle('mute');
      if (action === 'toggleDeafen') return toggle('deaf');
      return { success: false, error: `Unknown action: ${action}` };
    });

    discordPlugin.setGetStateHandler(readState);
  } else {
    log.warn('Discord plugin not registered; RPC actions will be unavailable');
  }

  // ─── IPC ──────────────────────────────────────────────────────────────────

  ipcMain.handle('discord:connect', async (_event, options?: { clientId?: string; clientSecret?: string }) => {
    try {
      if (discordRpc?.isConnected) return { success: true, state: discordRpc.currentVoiceState };
      await ensureConnected({
        clientId: typeof options?.clientId === 'string' ? options.clientId : undefined,
        clientSecret: typeof options?.clientSecret === 'string' ? options.clientSecret : undefined,
        interactive: true,
      });
      return { success: true, state: discordRpc?.currentVoiceState };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('discord:disconnect', async () => {
    if (discordRpc) { discordRpc.disconnect(); discordRpc = null; }
    return { success: true };
  });

  ipcMain.handle('discord:getState', async () => readState());

  ipcMain.handle('discord:toggleMute', async () => toggle('mute'));
  ipcMain.handle('discord:toggleDeaf', async () => toggle('deaf'));

  ipcMain.handle('discord:setMute', async (_event, mute: boolean) => {
    if (!discordRpc?.isConnected) return { success: false, error: 'Discord no conectado' };
    try {
      await discordRpc.setMute(!!mute);
      return { success: true, state: discordRpc.currentVoiceState };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('discord:setDeaf', async (_event, deaf: boolean) => {
    if (!discordRpc?.isConnected) return { success: false, error: 'Discord no conectado' };
    try {
      await discordRpc.setDeaf(!!deaf);
      return { success: true, state: discordRpc.currentVoiceState };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Auto-connect al arrancar cuando el renderer esté listo
  ipcMain.handle('app:rendererReady', async () => {
    try {
      const ok = await ensureConnected({ interactive: false });
      if (ok) log.info('Auto-connected to Discord');
    } catch {
      log.info('Auto-connect failed (Discord not running or token expired)');
    }
    return { success: true };
  });
}
