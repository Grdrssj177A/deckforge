import { app, safeStorage } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createLogger } from '../lib/logger';

const log = createLogger('SettingsManager');

export interface PluginSettings {
  nanoleaf: { ip: string; token: string };
  obs: { host: string; password: string };
  discord: { clientSecret: string };
  grid: { cols: number; rows: number };
  audio: { outputDevice: string };
}

const DEFAULT_SETTINGS: PluginSettings = {
  nanoleaf: { ip: '', token: '' },
  obs: { host: 'localhost:4455', password: '' },
  discord: { clientSecret: '' },
  grid: { cols: 3, rows: 5 },
  audio: { outputDevice: '' },
};

// Campos que contienen secretos y deben encriptarse
const SECRET_FIELDS: Array<{ section: keyof PluginSettings; field: string }> = [
  { section: 'nanoleaf', field: 'token' },
  { section: 'obs', field: 'password' },
  { section: 'discord', field: 'clientSecret' },
];

/**
 * SettingsManager: gestiona configuración global de plugins.
 * - Datos no sensibles: archivo JSON plano
 * - Secretos (tokens, passwords): encriptados con safeStorage
 */
export class SettingsManager {
  private settings: PluginSettings;
  private settingsPath: string;
  private secretsPath: string;

  constructor() {
    const dataDir = app.getPath('userData');
    this.settingsPath = join(dataDir, 'settings.json');
    this.secretsPath = join(dataDir, 'secrets.enc');
    this.settings = { ...DEFAULT_SETTINGS };
    this.load();
  }

  private load(): void {
    // Cargar settings no sensibles
    try {
      if (existsSync(this.settingsPath)) {
        const raw = readFileSync(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.settings = {
          nanoleaf: { ...DEFAULT_SETTINGS.nanoleaf, ...(parsed.nanoleaf || {}) },
          obs: { ...DEFAULT_SETTINGS.obs, ...(parsed.obs || {}) },
          discord: { ...DEFAULT_SETTINGS.discord, ...(parsed.discord || {}) },
          grid: { ...DEFAULT_SETTINGS.grid, ...(parsed.grid || {}) },
          audio: { ...DEFAULT_SETTINGS.audio, ...(parsed.audio || {}) },
        };
      }
    } catch (e) {
      log.error('Error loading settings:', e);
    }

    // Cargar secretos
    try {
      if (existsSync(this.secretsPath) && safeStorage.isEncryptionAvailable()) {
        const encrypted = readFileSync(this.secretsPath);
        const decrypted = safeStorage.decryptString(encrypted);
        const secrets = JSON.parse(decrypted);
        // Inyectar secretos en settings
        for (const { section, field } of SECRET_FIELDS) {
          if (secrets[section]?.[field]) {
            (this.settings[section] as any)[field] = secrets[section][field];
          }
        }
      }
    } catch (e) {
      log.error('Error loading secrets:', e);
    }

    log.info('Settings loaded');
  }

  private save(): void {
    // Guardar settings sin secretos
    const publicSettings = JSON.parse(JSON.stringify(this.settings));
    for (const { section, field } of SECRET_FIELDS) {
      if (publicSettings[section]) {
        publicSettings[section][field] = ''; // No guardar en plano
      }
    }
    try {
      writeFileSync(this.settingsPath, JSON.stringify(publicSettings, null, 2), 'utf-8');
    } catch (e) {
      log.error('Error saving settings:', e);
    }

    // Guardar secretos encriptados
    const secrets: any = {};
    for (const { section, field } of SECRET_FIELDS) {
      if ((this.settings[section] as any)[field]) {
        if (!secrets[section]) secrets[section] = {};
        secrets[section][field] = (this.settings[section] as any)[field];
      }
    }
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(JSON.stringify(secrets));
        writeFileSync(this.secretsPath, encrypted);
      }
    } catch (e) {
      log.error('Error saving secrets:', e);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  getAll(): PluginSettings {
    return { ...this.settings };
  }

  /** Para el renderer: devuelve settings SIN secretos visibles (solo indica si están configurados) */
  getAllPublic(): Record<string, any> {
    const pub = JSON.parse(JSON.stringify(this.settings));
    for (const { section, field } of SECRET_FIELDS) {
      if (pub[section]?.[field]) {
        pub[section][field] = '••••••••'; // Ocultar
      }
    }
    return pub;
  }

  get<K extends keyof PluginSettings>(section: K): PluginSettings[K] {
    return { ...this.settings[section] };
  }

  update<K extends keyof PluginSettings>(section: K, values: Partial<PluginSettings[K]>): void {
    this.settings[section] = { ...this.settings[section], ...values };
    this.save();
    log.info(`Settings updated: ${section}`);
  }

  /** Migrar desde localStorage del renderer (primera vez) */
  migrateFromRenderer(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.nanoleaf) this.settings.nanoleaf = { ...DEFAULT_SETTINGS.nanoleaf, ...parsed.nanoleaf };
      if (parsed.obs) this.settings.obs = { ...DEFAULT_SETTINGS.obs, ...parsed.obs };
      if (parsed.discord) this.settings.discord = { ...DEFAULT_SETTINGS.discord, ...parsed.discord };
      if (parsed.grid) this.settings.grid = { ...DEFAULT_SETTINGS.grid, ...parsed.grid };
      if (parsed.audio) this.settings.audio = { ...DEFAULT_SETTINGS.audio, ...parsed.audio };
      this.save();
      log.info('Settings migrated from renderer localStorage');
    } catch (e) {
      log.error('Settings migration failed:', e);
    }
  }
}

export const settingsManager = new SettingsManager();
