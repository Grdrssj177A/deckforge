import { app, dialog, BrowserWindow } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createLogger } from '../lib/logger';

const log = createLogger('TrustStore');

const MAX_TRUSTED_PATHS = 500;

/**
 * TrustStore: allowlist persistida de rutas que el usuario ha autorizado a
 * ejecutarse (acción "Open App").
 *
 * Por qué existe: un perfil importado es JSON de terceros y puede contener
 * una acción `openApp` apuntando a cualquier ejecutable. Sin este paso, pulsar
 * un botón de un perfil compartido equivale a ejecutar un binario arbitrario.
 *
 * Modelo: trust-on-first-use. Las rutas elegidas por el usuario en el diálogo
 * nativo se marcan como confiables automáticamente. Cualquier otra requiere
 * una confirmación explícita, una sola vez, mostrando la ruta completa.
 */
export class TrustStore {
  private trusted = new Set<string>();
  private filePath: string;
  /** Confirmaciones en vuelo, para no abrir dos diálogos para la misma ruta. */
  private pending = new Map<string, Promise<boolean>>();

  constructor() {
    this.filePath = join(app.getPath('userData'), 'trusted-paths.json');
    this.load();
  }

  private normalize(path: string): string {
    return path.trim().toLowerCase();
  }

  private load(): void {
    try {
      if (!existsSync(this.filePath)) return;
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8'));
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === 'string' && entry.length < 4096) {
            this.trusted.add(this.normalize(entry));
          }
        }
      }
      log.info(`Loaded ${this.trusted.size} trusted paths`);
    } catch (e) {
      log.error('Error loading trusted paths:', e);
    }
  }

  private save(): void {
    try {
      const entries = Array.from(this.trusted).slice(-MAX_TRUSTED_PATHS);
      writeFileSync(this.filePath, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (e) {
      log.error('Error saving trusted paths:', e);
    }
  }

  isTrusted(path: string): boolean {
    return this.trusted.has(this.normalize(path));
  }

  /** Marca una ruta como confiable (el usuario la eligió en el diálogo nativo). */
  trust(path: string): void {
    const key = this.normalize(path);
    if (this.trusted.has(key)) return;
    this.trusted.add(key);
    this.save();
    log.info(`Path trusted: ${path}`);
  }

  /**
   * Garantiza que la ruta esté autorizada, pidiendo confirmación si hace falta.
   * Devuelve false si el usuario la rechaza.
   */
  async ensureTrusted(path: string, parent: BrowserWindow | null): Promise<boolean> {
    if (this.isTrusted(path)) return true;

    const key = this.normalize(path);
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;

    const confirmation = this.confirm(path, parent).finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, confirmation);
    return confirmation;
  }

  private async confirm(path: string, parent: BrowserWindow | null): Promise<boolean> {
    const options: Electron.MessageBoxOptions = {
      type: 'warning',
      buttons: ['Cancelar', 'Ejecutar y recordar'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirmar ejecución',
      message: '¿Ejecutar este programa?',
      detail:
        `DeckForge va a abrir:\n\n${path}\n\n` +
        'Esta acción no la has autorizado antes. Si viene de un perfil que has ' +
        'importado, revisa la ruta con atención antes de continuar.',
      noLink: true,
    };

    const { response } = parent
      ? await dialog.showMessageBox(parent, options)
      : await dialog.showMessageBox(options);

    if (response === 1) {
      this.trust(path);
      return true;
    }
    log.warn(`Execution denied by user: ${path}`);
    return false;
  }
}

export const trustStore = new TrustStore();
