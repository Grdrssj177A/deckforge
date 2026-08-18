/**
 * Validadores para datos que cruzan el límite de confianza.
 *
 * Todo lo que llega del renderer (IPC) o de un perfil importado (JSON de
 * terceros) es NO CONFIABLE. Estas funciones son la única puerta por la que
 * esos datos pueden llegar a un plugin o a disco.
 */

import { isAbsolute, normalize } from 'path';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ─── Primitivos ──────────────────────────────────────────────────────────────

/** Protocolos que shell.openExternal puede recibir. Nunca file: ni esquemas custom. */
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

export function validateExternalUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError('URL no configurada');
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new ValidationError(`URL inválida: "${String(raw).slice(0, 120)}"`);
  }
  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    throw new ValidationError(
      `Esquema "${parsed.protocol}" no permitido. Solo se admiten http y https.`
    );
  }
  return parsed.toString();
}

/** Ruta absoluta y normalizada, sin secuencias de traversal. */
export function validateAbsolutePath(raw: unknown, label = 'Ruta'): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError(`${label} no configurada`);
  }
  const value = raw.trim();
  if (value.includes('\0')) {
    throw new ValidationError(`${label} contiene caracteres no válidos`);
  }
  const normalized = normalize(value);
  if (!isAbsolute(normalized)) {
    throw new ValidationError(`${label} debe ser una ruta absoluta: "${value.slice(0, 120)}"`);
  }
  return normalized;
}

/** Valor dentro de una lista cerrada. */
export function validateEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T,
  label = 'Valor'
): T {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw !== 'string' || !allowed.includes(raw as T)) {
    throw new ValidationError(
      `${label} "${String(raw).slice(0, 40)}" no permitido. Opciones: ${allowed.join(', ')}`
    );
  }
  return raw as T;
}

/** Entero finito dentro de un rango cerrado. */
export function validateInt(
  raw: unknown,
  min: number,
  max: number,
  fallback: number,
  label = 'Valor'
): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) {
    throw new ValidationError(`${label} debe ser numérico, recibido "${String(raw).slice(0, 40)}"`);
  }
  const int = Math.round(num);
  if (int < min || int > max) {
    throw new ValidationError(`${label} debe estar entre ${min} y ${max}, recibido ${int}`);
  }
  return int;
}

/**
 * Dirección de un dispositivo en la red local.
 * Evita que una config manipulada convierta la app en un escáner de red o en
 * un cliente HTTP hacia hosts arbitrarios (SSRF).
 */
export function validateLocalHost(raw: unknown, label = 'IP'): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError(`${label} no configurada`);
  }
  const value = raw.trim();

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!ipv4) {
    throw new ValidationError(`${label} debe ser una dirección IPv4 de tu red local`);
  }
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((o) => o < 0 || o > 255)) {
    throw new ValidationError(`${label} no es una dirección IPv4 válida: "${value}"`);
  }

  const [a, b] = octets;
  const isPrivate =
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254);

  if (!isPrivate) {
    throw new ValidationError(
      `${label} "${value}" no pertenece a un rango de red local. Solo se permiten dispositivos de tu LAN.`
    );
  }
  return value;
}

/** Segmento seguro para interpolar en un path de URL (tokens de API, etc.) */
export function validateUrlSegment(raw: unknown, label = 'Token'): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError(`${label} no configurado`);
  }
  const value = raw.trim();
  if (!/^[A-Za-z0-9._~-]+$/.test(value)) {
    throw new ValidationError(`${label} contiene caracteres no válidos`);
  }
  return value;
}

// ─── Esquema de acciones y perfiles ──────────────────────────────────────────

const KNOWN_PLUGIN_IDS = new Set([
  'soundboard',
  'hotkey',
  'obs',
  'discord',
  'nanoleaf',
  'system',
]);

/** Longitud máxima de un valor de config. Los iconos data: son los grandes. */
const MAX_CONFIG_VALUE_LENGTH = 256 * 1024;
const MAX_TEXT_LENGTH = 512;
const MAX_CONFIG_KEYS = 64;
const MAX_PAGES_PER_PROFILE = 64;

/** Claves que nunca deben copiarse desde JSON externo. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function clampText(value: string, max = MAX_TEXT_LENGTH): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Normaliza un objeto de config a un mapa plano de primitivos.
 * Descarta claves peligrosas, valores anidados y valores desmesurados.
 */
export function sanitizeActionConfig(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = Object.create(null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  let count = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_CONFIG_KEYS) break;
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (typeof key !== 'string' || key.length === 0 || key.length > 64) continue;

    if (typeof value === 'string') {
      if (value.length > MAX_CONFIG_VALUE_LENGTH) continue;
      out[key] = value;
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value;
    } else {
      // undefined / null / objetos / arrays / funciones: se descartan
      continue;
    }
    count++;
  }
  return out;
}

export interface SanitizedAction {
  id: string;
  pluginId: string;
  name: string;
  icon: string;
  description: string;
  config: Record<string, string | number | boolean>;
}

/**
 * Valida una acción venida de fuera. Devuelve null si es irrecuperable.
 * Rechazar aquí es lo que impide que un perfil compartido inyecte
 * acciones apuntando a plugins o payloads arbitrarios.
 */
export function sanitizeAction(raw: unknown): SanitizedAction | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const a = raw as Record<string, unknown>;

  if (typeof a.pluginId !== 'string' || !KNOWN_PLUGIN_IDS.has(a.pluginId)) return null;
  if (typeof a.id !== 'string' || a.id.length === 0 || a.id.length > 128) return null;

  return {
    id: a.id,
    pluginId: a.pluginId,
    name: typeof a.name === 'string' ? clampText(a.name) : 'Acción',
    icon: typeof a.icon === 'string' ? clampText(a.icon, MAX_CONFIG_VALUE_LENGTH) : '',
    description: typeof a.description === 'string' ? clampText(a.description) : '',
    config: sanitizeActionConfig(a.config),
  };
}

export interface SanitizedButtonSlot {
  position: number;
  action: SanitizedAction | null;
  label?: string;
  color?: string;
  folderId?: string;
}

export function sanitizeButtonSlot(raw: unknown, maxButtons: number): SanitizedButtonSlot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;

  const position = typeof b.position === 'number' ? b.position : Number(b.position);
  if (!Number.isInteger(position) || position < 0 || position >= maxButtons) return null;

  const slot: SanitizedButtonSlot = {
    position,
    action: b.action === null || b.action === undefined ? null : sanitizeAction(b.action),
  };
  if (typeof b.label === 'string') slot.label = clampText(b.label);
  if (typeof b.color === 'string') slot.color = clampText(b.color, 64);
  if (typeof b.folderId === 'string' && b.folderId.length <= 128) slot.folderId = b.folderId;
  return slot;
}

export interface SanitizedPage {
  id: string;
  name: string;
  icon: string;
  buttons: SanitizedButtonSlot[];
}

export function sanitizePage(raw: unknown, maxButtons: number): SanitizedPage | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id.length === 0 || p.id.length > 128) return null;

  return {
    id: p.id,
    name: typeof p.name === 'string' ? clampText(p.name) : 'Carpeta',
    icon: typeof p.icon === 'string' ? clampText(p.icon, MAX_CONFIG_VALUE_LENGTH) : '📁',
    buttons: Array.isArray(p.buttons)
      ? (p.buttons
          .map((b) => sanitizeButtonSlot(b, maxButtons))
          .filter(Boolean) as SanitizedButtonSlot[])
      : [],
  };
}

export interface SanitizedProfile {
  id: string;
  name: string;
  buttons: SanitizedButtonSlot[];
  pages: SanitizedPage[];
  createdAt: number;
  updatedAt: number;
}

export function sanitizeProfile(raw: unknown, maxButtons: number): SanitizedProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id.length === 0 || p.id.length > 128) return null;
  if (!Array.isArray(p.buttons)) return null;

  const now = Date.now();
  return {
    id: p.id,
    name: typeof p.name === 'string' && p.name.trim() ? clampText(p.name) : 'Perfil',
    buttons: p.buttons
      .map((b) => sanitizeButtonSlot(b, maxButtons))
      .filter(Boolean) as SanitizedButtonSlot[],
    pages: Array.isArray(p.pages)
      ? (p.pages
          .slice(0, MAX_PAGES_PER_PROFILE)
          .map((pg) => sanitizePage(pg, maxButtons))
          .filter(Boolean) as SanitizedPage[])
      : [],
    createdAt: typeof p.createdAt === 'number' && Number.isFinite(p.createdAt) ? p.createdAt : now,
    updatedAt: typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt) ? p.updatedAt : now,
  };
}
