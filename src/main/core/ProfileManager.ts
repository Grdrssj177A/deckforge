import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createLogger } from '../lib/logger';

const log = createLogger('ProfileManager');

// ─── Types (mirrored from renderer for now) ─────────────────────────────────

export interface ActionConfig {
  [key: string]: string | number | boolean | undefined;
}

export interface Action {
  id: string;
  pluginId: string;
  name: string;
  icon: string;
  description: string;
  config: ActionConfig;
}

export interface ButtonSlot {
  position: number;
  action: Action | null;
  label?: string;
  color?: string;
  folderId?: string;
}

export interface Page {
  id: string;
  name: string;
  icon: string;
  buttons: ButtonSlot[];
}

export interface Profile {
  id: string;
  name: string;
  buttons: ButtonSlot[];
  pages: Page[];
  createdAt: number;
  updatedAt: number;
}

const MAX_BUTTONS = 36;

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

function isValidProfile(obj: any): obj is Profile {
  return obj && typeof obj === 'object' && typeof obj.id === 'string' && typeof obj.name === 'string' && Array.isArray(obj.buttons);
}

function ensureButtonSlots(buttons: ButtonSlot[]): ButtonSlot[] {
  if (buttons.length >= MAX_BUTTONS) return buttons;
  const extra = Array.from({ length: MAX_BUTTONS - buttons.length }, (_, i) => ({
    position: buttons.length + i,
    action: null as Action | null,
  }));
  return [...buttons, ...extra];
}

/**
 * ProfileManager: única autoridad sobre perfiles, páginas y persistencia.
 * Almacena en un archivo JSON en userData (no localStorage).
 */
export class ProfileManager {
  private profiles: Profile[] = [];
  private activeProfileId = '';
  private filePath: string;

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
        if (data.profiles && Array.isArray(data.profiles)) {
          this.profiles = data.profiles.filter(isValidProfile).map((p: Profile) => ({
            ...p,
            pages: (p.pages || []).map((pg: Page) => ({ ...pg, buttons: ensureButtonSlots(pg.buttons) })),
            buttons: ensureButtonSlots(p.buttons),
          }));
          this.activeProfileId = data.activeProfileId || '';
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

  private save(): void {
    try {
      const data = JSON.stringify({ profiles: this.profiles, activeProfileId: this.activeProfileId }, null, 2);
      writeFileSync(this.filePath, data, 'utf-8');
    } catch (e) {
      log.error('Error saving profiles:', e);
    }
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getAll(): Profile[] { return this.profiles; }
  getActive(): Profile { return this.profiles.find((p) => p.id === this.activeProfileId) || this.profiles[0]; }
  getActiveId(): string { return this.activeProfileId; }
  getById(id: string): Profile | undefined { return this.profiles.find((p) => p.id === id); }

  // ─── Commands ─────────────────────────────────────────────────────────────

  setActive(id: string): void {
    if (this.profiles.find((p) => p.id === id)) {
      this.activeProfileId = id;
      this.save();
    }
  }

  create(name: string): Profile {
    const profile = createDefaultProfile();
    profile.name = name;
    this.profiles.push(profile);
    this.activeProfileId = profile.id;
    this.save();
    return profile;
  }

  delete(id: string): void {
    this.profiles = this.profiles.filter((p) => p.id !== id);
    if (this.profiles.length === 0) this.profiles = [createDefaultProfile()];
    if (this.activeProfileId === id) this.activeProfileId = this.profiles[0].id;
    this.save();
  }

  rename(id: string, name: string): void {
    const p = this.profiles.find((pr) => pr.id === id);
    if (p) { p.name = name; p.updatedAt = Date.now(); this.save(); }
  }

  duplicate(id: string): Profile | null {
    const source = this.profiles.find((p) => p.id === id);
    if (!source) return null;
    const dup: Profile = { ...JSON.parse(JSON.stringify(source)), id: generateId(), name: source.name + ' (copia)', createdAt: Date.now(), updatedAt: Date.now() };
    this.profiles.push(dup);
    this.save();
    return dup;
  }

  assignAction(profileId: string, pageId: string | null, position: number, action: Action): void {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return;

    const buttons = pageId ? profile.pages.find((pg) => pg.id === pageId)?.buttons : profile.buttons;
    if (!buttons) return;

    const btn = buttons.find((b) => b.position === position);
    if (btn) { btn.action = action; btn.label = action.name; btn.folderId = undefined; }
    profile.updatedAt = Date.now();
    this.save();
  }

  removeAction(profileId: string, pageId: string | null, position: number): void {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return;

    const buttons = pageId ? profile.pages.find((pg) => pg.id === pageId)?.buttons : profile.buttons;
    if (!buttons) return;

    const btn = buttons.find((b) => b.position === position);
    if (btn) { btn.action = null; btn.label = undefined; btn.folderId = undefined; }
    profile.updatedAt = Date.now();
    this.save();
  }

  moveButton(profileId: string, pageId: string | null, from: number, to: number): void {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile || from === to) return;

    const buttons = pageId ? profile.pages.find((pg) => pg.id === pageId)?.buttons : profile.buttons;
    if (!buttons) return;

    const fromBtn = buttons.find((b) => b.position === from);
    const toBtn = buttons.find((b) => b.position === to);
    if (!fromBtn || !toBtn) return;

    const temp = { action: fromBtn.action, label: fromBtn.label, color: fromBtn.color, folderId: fromBtn.folderId };
    fromBtn.action = toBtn.action; fromBtn.label = toBtn.label; fromBtn.color = toBtn.color; fromBtn.folderId = toBtn.folderId;
    toBtn.action = temp.action; toBtn.label = temp.label; toBtn.color = temp.color; toBtn.folderId = temp.folderId;
    profile.updatedAt = Date.now();
    this.save();
  }

  createFolder(profileId: string, pageId: string | null, position: number, name: string, icon: string): string {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return '';

    const folderId = generateId();
    const newPage: Page = { id: folderId, name, icon, buttons: createEmptyButtons() };
    profile.pages.push(newPage);

    const buttons = pageId ? profile.pages.find((pg) => pg.id === pageId)?.buttons : profile.buttons;
    if (buttons) {
      const btn = buttons.find((b) => b.position === position);
      if (btn) { btn.action = null; btn.label = name; btn.folderId = folderId; btn.color = undefined; }
    }
    profile.updatedAt = Date.now();
    this.save();
    return folderId;
  }

  deleteFolder(profileId: string, folderId: string): void {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return;
    profile.pages = profile.pages.filter((pg) => pg.id !== folderId);
    // Clean button references
    const clean = (buttons: ButtonSlot[]) => buttons.forEach((b) => { if (b.folderId === folderId) { b.folderId = undefined; b.label = undefined; } });
    clean(profile.buttons);
    profile.pages.forEach((pg) => clean(pg.buttons));
    profile.updatedAt = Date.now();
    this.save();
  }

  // ─── Import/Export ────────────────────────────────────────────────────────

  importProfile(profileData: Profile): Profile {
    const imported: Profile = {
      ...profileData,
      id: generateId(),
      buttons: ensureButtonSlots(profileData.buttons || []),
      pages: (profileData.pages || []).map((pg) => ({ ...pg, buttons: ensureButtonSlots(pg.buttons || []) })),
    };
    this.profiles.push(imported);
    this.save();
    return imported;
  }

  exportProfile(id: string): Profile | null {
    return this.profiles.find((p) => p.id === id) || null;
  }

  // ─── Migración desde localStorage (primera vez) ───────────────────────────

  migrateFromLocalStorage(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.profiles = parsed.filter(isValidProfile).map((p: Profile) => ({
          ...p,
          pages: (p.pages || []).map((pg: Page) => ({ ...pg, buttons: ensureButtonSlots(pg.buttons) })),
          buttons: ensureButtonSlots(p.buttons),
        }));
        if (this.profiles.length > 0) {
          this.activeProfileId = this.profiles[0].id;
          this.save();
          log.info(`Migrated ${this.profiles.length} profiles from localStorage`);
        }
      }
    } catch (e) {
      log.error('Migration failed:', e);
    }
  }
}

export const profileManager = new ProfileManager();
