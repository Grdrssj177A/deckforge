import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'fs';
import { Action, ButtonSlot, Page, Profile, MAX_BUTTONS } from '../../shared/types/profiles';
import { createLogger } from '../lib/logger';
import {
  SanitizedButtonSlot,
  ValidationError,
  sanitizeAction,
  sanitizeProfile,
} from '../lib/validate';

const log = createLogger('ProfileManager');

export type { Action, ButtonSlot, Page, Profile };
export { MAX_BUTTONS };

/** Resultado de una mutación, para que el IPC pueda informar al usuario. */
export type MutationResult = { ok: true } | { ok: false; error: string };

const OK: MutationResult = { ok: true };
function fail(error: string): MutationResult {
  return { ok: false, error };
}

const MAX_PROFILES = 100;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyButtons(): ButtonSlot[] {
  return Array.from({ length: MAX_BUTTONS }, (_, i) => ({ position: i, action: null }));
}

function createDefaultProfile(): Profile {
  return {
    id: generateId(),
    name: 'Default',
    buttons: createEmptyButtons(),
    pages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Convierte una lista de slots (posiblemente dispersa, desordenada o con
 * posiciones repetidas) en un array canónico donde índice === posición.
 */
function normalizeButtons(slots: SanitizedButtonSlot[] | ButtonSlot[] | undefined): ButtonSlot[] {
  const canonical = createEmptyButtons();
  if (!Array.isArray(slots)) return canonical;
  for (const slot of slots) {
    if (!slot) continue;
    const pos = slot.position;
    if (!Number.isInteger(pos) || pos < 0 || pos >= MAX_BUTTONS) continue;
    canonical[pos] = {
      position: pos,
      action: (slot.action as Action | null) ?? null,
      label: slot.label,
      color: slot.color,
      folderId: slot.folderId,
    };
  }
  return canonical;
}

/** Aplica el saneado completo a un perfil de origen no confiable. */
function toSafeProfile(raw: unknown): Profile | null {
  const clean = sanitizeProfile(raw, MAX_BUTTONS);
  if (!clean) return null;
  return {
    id: clean.id,
    name: clean.name,
    buttons: normalizeButtons(clean.buttons),
    pages: clean.pages.map((pg) => ({
      id: pg.id,
      name: pg.name,
      icon: pg.icon,
      buttons: normalizeButtons(pg.buttons),
    })),
    createdAt: clean.createdAt,
    updatedAt: clean.updatedAt,
  };
}

/**
 * ProfileManager: única autoridad sobre perfiles, páginas y persistencia.
 *
 * Todo lo que entra (archivo en disco, migración, import) pasa por
 * `toSafeProfile`: el JSON de un perfil puede venir de terceros y sus acciones
 * acaban ejecutándose en el sistema.
 */
export class ProfileManager {
  private profiles: Profile[] = [];
  private activeProfileId = '';
  private filePath: string;
  /** Última causa de fallo de escritura, para poder reportarla. */
  private lastSaveError: string | null = null;

  constructor() {
    const dataDir = app.getPath('userData');
    this.filePath = join(dataDir, 'profiles.json');
    this.load();
  }

  // ─── Persistencia ─────────────────────────────────────────────────────────

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.profiles)) {
          const before = data.profiles.length;
          this.profiles = data.profiles
            .slice(0, MAX_PROFILES)
            .map(toSafeProfile)
            .filter(Boolean) as Profile[];
          if (this.profiles.length !== before) {
            log.warn(`Discarded ${before - this.profiles.length} invalid profile(s) while loading`);
          }
          if (typeof data.activeProfileId === 'string') {
            this.activeProfileId = data.activeProfileId;
          }
        }
      }
    } catch (e) {
      log.error('Error loading profiles:', e);
    }

    // Si no hay perfiles, crear uno default
    if (this.profiles.length === 0) {
      this.profiles = [createDefaultProfile()];
    }
    if (!this.activeProfileId || !this.profiles.find((p) => p.id === this.activeProfileId)) {
      this.activeProfileId = this.profiles[0].id;
    }

    log.info(`Loaded ${this.profiles.length} profiles, active: ${this.activeProfileId}`);
  }

  /**
   * Escritura atómica: se escribe a un temporal y se renombra. Si el proceso
   * muere a mitad, el archivo original sigue intacto en vez de quedar truncado.
   */
  private save(): MutationResult {
    const tmpPath = `${this.filePath}.tmp`;
    try {
      const data = JSON.stringify(
        { profiles: this.profiles, activeProfileId: this.activeProfileId },
        null,
        2
      );
      writeFileSync(tmpPath, data, 'utf-8');
      renameSync(tmpPath, this.filePath);
      this.lastSaveError = null;
      return OK;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.lastSaveError = msg;
      log.error('Error saving profiles:', e);
      try {
        if (existsSync(tmpPath)) unlinkSync(tmpPath);
      } catch { /* nada que hacer */ }
      return fail(`No se pudieron guardar los perfiles: ${msg}`);
    }
  }

  getLastSaveError(): string | null {
    return this.lastSaveError;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getAll(): Profile[] { return this.profiles; }
  getActive(): Profile { return this.profiles.find((p) => p.id === this.activeProfileId) || this.profiles[0]; }
  getActiveId(): string { return this.activeProfileId; }
  getById(id: string): Profile | undefined { return this.profiles.find((p) => p.id === id); }

  /** Resuelve el array de botones de una página (o la raíz si pageId es null). */
  private getButtons(profile: Profile, pageId: string | null): ButtonSlot[] | null {
    if (!pageId) return profile.buttons;
    return profile.pages.find((pg) => pg.id === pageId)?.buttons ?? null;
  }

  // ─── Commands ─────────────────────────────────────────────────────────────

  setActive(id: string): MutationResult {
    if (!this.profiles.find((p) => p.id === id)) {
      return fail(`El perfil "${id}" no existe`);
    }
    this.activeProfileId = id;
    return this.save();
  }

  create(name: string): { result: MutationResult; profile: Profile | null } {
    if (typeof name !== 'string' || !name.trim()) {
      return { result: fail('El nombre del perfil no puede estar vacío'), profile: null };
    }
    if (this.profiles.length >= MAX_PROFILES) {
      return { result: fail(`Máximo de ${MAX_PROFILES} perfiles alcanzado`), profile: null };
    }
    const profile = createDefaultProfile();
    profile.name = name.trim().slice(0, 512);
    this.profiles.push(profile);
    this.activeProfileId = profile.id;
    return { result: this.save(), profile };
  }

  delete(id: string): MutationResult {
    if (!this.profiles.find((p) => p.id === id)) {
      return fail(`El perfil "${id}" no existe`);
    }
    this.profiles = this.profiles.filter((p) => p.id !== id);
    if (this.profiles.length === 0) this.profiles = [createDefaultProfile()];
    if (this.activeProfileId === id) this.activeProfileId = this.profiles[0].id;
    return this.save();
  }

  rename(id: string, name: string): MutationResult {
    if (typeof name !== 'string' || !name.trim()) {
      return fail('El nombre del perfil no puede estar vacío');
    }
    const p = this.profiles.find((pr) => pr.id === id);
    if (!p) return fail(`El perfil "${id}" no existe`);
    p.name = name.trim().slice(0, 512);
    p.updatedAt = Date.now();
    return this.save();
  }

  duplicate(id: string): { result: MutationResult; profile: Profile | null } {
    const source = this.profiles.find((p) => p.id === id);
    if (!source) return { result: fail(`El perfil "${id}" no existe`), profile: null };
    if (this.profiles.length >= MAX_PROFILES) {
      return { result: fail(`Máximo de ${MAX_PROFILES} perfiles alcanzado`), profile: null };
    }
    const dup: Profile = {
      ...(JSON.parse(JSON.stringify(source)) as Profile),
      id: generateId(),
      name: `${source.name} (copia)`.slice(0, 512),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.profiles.push(dup);
    return { result: this.save(), profile: dup };
  }

  /**
   * Asigna una acción a un slot. La acción se sanea aquí: es el punto por el que
   * entra la configuración que después ejecutan los plugins.
   */
  assignAction(profileId: string, pageId: string | null, position: number, action: unknown): MutationResult {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return fail(`El perfil "${profileId}" no existe`);

    const buttons = this.getButtons(profile, pageId);
    if (!buttons) return fail(`La página "${pageId}" no existe`);

    if (!Number.isInteger(position) || position < 0 || position >= MAX_BUTTONS) {
      return fail(`Posición fuera de rango: ${position}`);
    }

    const clean = sanitizeAction(action);
    if (!clean) return fail('La acción no es válida o su plugin no está reconocido');

    const btn = buttons[position];
    btn.action = clean as Action;
    btn.label = clean.name;
    btn.folderId = undefined;
    profile.updatedAt = Date.now();
    return this.save();
  }

  removeAction(profileId: string, pageId: string | null, position: number): MutationResult {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return fail(`El perfil "${profileId}" no existe`);

    const buttons = this.getButtons(profile, pageId);
    if (!buttons) return fail(`La página "${pageId}" no existe`);

    if (!Number.isInteger(position) || position < 0 || position >= MAX_BUTTONS) {
      return fail(`Posición fuera de rango: ${position}`);
    }

    const btn = buttons[position];
    btn.action = null;
    btn.label = undefined;
    btn.folderId = undefined;
    profile.updatedAt = Date.now();
    return this.save();
  }

  moveButton(profileId: string, pageId: string | null, from: number, to: number): MutationResult {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return fail(`El perfil "${profileId}" no existe`);
    if (from === to) return OK;

    const buttons = this.getButtons(profile, pageId);
    if (!buttons) return fail(`La página "${pageId}" no existe`);

    const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < MAX_BUTTONS;
    if (!inRange(from) || !inRange(to)) {
      return fail(`Posiciones fuera de rango: ${from} → ${to}`);
    }

    const fromBtn = buttons[from];
    const toBtn = buttons[to];
    const temp = { action: fromBtn.action, label: fromBtn.label, color: fromBtn.color, folderId: fromBtn.folderId };
    fromBtn.action = toBtn.action; fromBtn.label = toBtn.label; fromBtn.color = toBtn.color; fromBtn.folderId = toBtn.folderId;
    toBtn.action = temp.action; toBtn.label = temp.label; toBtn.color = temp.color; toBtn.folderId = temp.folderId;
    profile.updatedAt = Date.now();
    return this.save();
  }

  createFolder(
    profileId: string,
    pageId: string | null,
    position: number,
    name: string,
    icon: string
  ): { result: MutationResult; folderId: string | null } {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return { result: fail(`El perfil "${profileId}" no existe`), folderId: null };

    if (!Number.isInteger(position) || position < 0 || position >= MAX_BUTTONS) {
      return { result: fail(`Posición fuera de rango: ${position}`), folderId: null };
    }

    const buttons = this.getButtons(profile, pageId);
    if (!buttons) return { result: fail(`La página "${pageId}" no existe`), folderId: null };

    const folderId = generateId();
    const safeName = (typeof name === 'string' && name.trim() ? name.trim() : 'Carpeta').slice(0, 512);
    const safeIcon = typeof icon === 'string' && icon ? icon.slice(0, 256 * 1024) : '📁';

    profile.pages.push({ id: folderId, name: safeName, icon: safeIcon, buttons: createEmptyButtons() });

    const btn = buttons[position];
    btn.action = null;
    btn.label = safeName;
    btn.folderId = folderId;
    btn.color = undefined;

    profile.updatedAt = Date.now();
    return { result: this.save(), folderId };
  }

  deleteFolder(profileId: string, folderId: string): MutationResult {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return fail(`El perfil "${profileId}" no existe`);
    if (!profile.pages.find((pg) => pg.id === folderId)) {
      return fail(`La carpeta "${folderId}" no existe`);
    }

    profile.pages = profile.pages.filter((pg) => pg.id !== folderId);
    const clean = (buttons: ButtonSlot[]) =>
      buttons.forEach((b) => {
        if (b.folderId === folderId) { b.folderId = undefined; b.label = undefined; }
      });
    clean(profile.buttons);
    profile.pages.forEach((pg) => clean(pg.buttons));
    profile.updatedAt = Date.now();
    return this.save();
  }

  // ─── Import/Export ────────────────────────────────────────────────────────

  /**
   * Importa uno o varios perfiles desde JSON en una sola operación.
   *
   * Sustituye al bucle del renderer que llamaba a assignAction por cada botón:
   * aquello reescribía el archivo completo decenas de veces por perfil y no
   * validaba nada. Aquí se sanea todo y se guarda una única vez.
   */
  importProfiles(rawJson: string): { result: MutationResult; imported: Profile[] } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return { result: fail('El archivo no contiene JSON válido'), imported: [] };
    }

    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    if (candidates.length === 0) {
      return { result: fail('El archivo no contiene perfiles'), imported: [] };
    }

    const room = MAX_PROFILES - this.profiles.length;
    if (room <= 0) {
      return { result: fail(`Máximo de ${MAX_PROFILES} perfiles alcanzado`), imported: [] };
    }

    const imported: Profile[] = [];
    let rejected = 0;

    for (const candidate of candidates.slice(0, room)) {
      const safe = toSafeProfile(candidate);
      if (!safe) { rejected++; continue; }

      // Ids nuevos para no colisionar con perfiles existentes, remapeando las
      // referencias de carpeta de los botones.
      const idMap = new Map<string, string>();
      for (const page of safe.pages) {
        const newId = generateId();
        idMap.set(page.id, newId);
        page.id = newId;
      }
      const remap = (buttons: ButtonSlot[]) =>
        buttons.forEach((b) => {
          if (b.folderId) {
            const mapped = idMap.get(b.folderId);
            if (mapped) b.folderId = mapped;
            else { b.folderId = undefined; b.label = undefined; }
          }
        });
      remap(safe.buttons);
      safe.pages.forEach((pg) => remap(pg.buttons));

      safe.id = generateId();
      safe.createdAt = Date.now();
      safe.updatedAt = Date.now();

      this.profiles.push(safe);
      imported.push(safe);
    }

    if (imported.length === 0) {
      return { result: fail('Ningún perfil del archivo tenía un formato válido'), imported: [] };
    }
    if (rejected > 0) {
      log.warn(`Discarded ${rejected} invalid profile(s) during import`);
    }

    return { result: this.save(), imported };
  }

  exportProfile(id: string): Profile | null {
    return this.profiles.find((p) => p.id === id) || null;
  }

  // ─── Migración desde localStorage (primera vez) ───────────────────────────

  migrateFromLocalStorage(data: string): MutationResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return fail('Los datos de migración no son JSON válido');
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return fail('Los datos de migración no contienen perfiles');
    }

    const migrated = parsed
      .slice(0, MAX_PROFILES)
      .map(toSafeProfile)
      .filter(Boolean) as Profile[];

    if (migrated.length === 0) {
      return fail('Ningún perfil migrado tenía un formato válido');
    }

    this.profiles = migrated;
    this.activeProfileId = migrated[0].id;
    const result = this.save();
    if (result.ok) log.info(`Migrated ${migrated.length} profiles from localStorage`);
    return result;
  }
}

export const profileManager = new ProfileManager();

/** Reexportado para que los handlers IPC puedan distinguir errores de validación. */
export { ValidationError };
