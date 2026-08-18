import { app, safeStorage } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createLogger } from '../lib/logger';
import { ValidationError, validateInt, validateLocalHost } from '../lib/validate';

const log = createLogger('SettingsManager');

/**
 * Marcador que sustituye a los secretos cuando se envían al renderer.
 * El renderer nunca ve el valor real, así que si nos lo devuelve en un update
 * significa "no cambiar", no "guardar estos ocho puntos".
 */
export const SECRET_MASK = '••••••••';

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

const VALID_SECTIONS = Object.keys(DEFAULT_SETTINGS) as Array<keyof PluginSettings>;

const MAX_STRING_LENGTH = 256;

function isSecretField(section: string, field: string): boolean {
  return SECRET_FIELDS.some((s) => s.section === section && s.field === field);
}

function validateText(raw: unknown, label: string): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') {
    throw new ValidationError(`${label} debe ser texto`);
  }
  const value = raw.trim();
  if (value.length > MAX_STRING_LENGTH) {
    throw new ValidationError(`${label} excede ${MAX_STRING_LENGTH} caracteres`);
  }
  return value;
}

/** Valida un único campo. Lanza ValidationError si el valor no es admisible. */
function validateField(section: keyof PluginSettings, field: string, raw: unknown): string | number {
  switch (`${section}.${field}`) {
    case 'nanoleaf.ip': {
      const ip = validateText(raw, 'IP de Nanoleaf');
      return ip === '' ? '' : validateLocalHost(ip, 'IP de Nanoleaf');
    }
    case 'grid.cols':
      return validateInt(raw, 2, 6, DEFAULT_SETTINGS.grid.cols, 'Columnas');
    case 'grid.rows':
      return validateInt(raw, 2, 6, DEFAULT_SETTINGS.grid.rows, 'Filas');
    default:
      return validateText(raw, `${section}.${field}`);
  }
}

/**
 * Filtra un objeto de valores a los campos conocidos de la sección, con el tipo
 * y el rango correctos. Descarta claves desconocidas y secretos enmascarados
 * (que significan "sin cambios").
 *
 * `tolerant` se usa al leer de disco o migrar: se omite el campo inválido en vez
 * de rechazar toda la operación. En un update del renderer conviene lo contrario,
 * para que el usuario vea el error.
 */
function sanitizeSectionValues(
  section: keyof PluginSettings,
  values: unknown,
  tolerant = false
): Record<string, string | number> {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    if (tolerant) return {};
    throw new ValidationError('Los valores de configuración deben ser un objeto');
  }
  const input = values as Record<string, unknown>;
  const out: Record<string, string | number> = {};

  for (const field of Object.keys(DEFAULT_SETTINGS[section])) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const raw = input[field];

    // Un secreto enmascarado nunca debe sobrescribir el secreto real.
    if (isSecretField(section, field) && raw === SECRET_MASK) continue;

    if (tolerant) {
      try {
        out[field] = validateField(section, field, raw);
      } catch (e) {
        log.warn(`Ignoring invalid value for ${section}.${field}:`, e instanceof Error ? e.message : e);
      }
    } else {
      out[field] = validateField(section, field, raw);
    }
  }
  return out;
}

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
        // El archivo es editable a mano: se valida campo por campo y se
        // descartan los valores fuera de rango en vez de confiar en ellos.
        for (const section of VALID_SECTIONS) {
          const clean = sanitizeSectionValues(section, parsed?.[section], true);
          this.settings[section] = { ...DEFAULT_SETTINGS[section], ...clean } as any;
        }
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
        pub[section][field] = SECRET_MASK; // Ocultar
      }
    }
    return pub;
  }

  get<K extends keyof PluginSettings>(section: K): PluginSettings[K] {
    return { ...this.settings[section] };
  }

  /**
   * Aplica un update procedente del renderer.
   * Lanza ValidationError si la sección o algún valor no son válidos; el
   * llamador debe propagar ese error al usuario en vez de fallar en silencio.
   */
  update<K extends keyof PluginSettings>(section: K, values: Partial<PluginSettings[K]>): void {
    if (typeof section !== 'string' || !VALID_SECTIONS.includes(section)) {
      throw new ValidationError(`Sección de configuración desconocida: "${String(section).slice(0, 40)}"`);
    }
    const clean = sanitizeSectionValues(section, values);
    if (Object.keys(clean).length === 0) {
      log.info(`Settings update for "${section}" contained no applicable changes`);
      return;
    }
    this.settings[section] = { ...this.settings[section], ...clean } as PluginSettings[K];
    this.save();
    log.info(`Settings updated: ${section} (${Object.keys(clean).join(', ')})`);
  }

  /** Migrar desde localStorage del renderer (primera vez) */
  migrateFromRenderer(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (!parsed || typeof parsed !== 'object') return;
      for (const section of VALID_SECTIONS) {
        if (!parsed[section]) continue;
        const clean = sanitizeSectionValues(section, parsed[section], true);
        this.settings[section] = { ...this.settings[section], ...clean } as any;
      }
      this.save();
      log.info('Settings migrated from renderer localStorage');
    } catch (e) {
      log.error('Settings migration failed:', e);
    }
  }
}

export const settingsManager = new SettingsManager();
