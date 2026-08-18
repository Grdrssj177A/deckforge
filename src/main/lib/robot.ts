/**
 * Cargador único de robotjs.
 *
 * Es un módulo nativo: si falla la compilación o falta el binario, la app debe
 * seguir arrancando y solo deben fallar las acciones que lo necesitan. Por eso
 * la carga es diferida y el resultado (incluido el fallo) se memoiza, para no
 * pagar un require nativo síncrono en cada pulsación.
 */

import { createLogger } from './logger';

const log = createLogger('robot');

export interface RobotModule {
  keyTap(key: string, modifiers?: string[]): void;
}

let cached: RobotModule | null = null;
let loadFailure: Error | null = null;

export function loadRobot(): RobotModule {
  if (cached) return cached;
  if (loadFailure) throw loadFailure;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('@hurdlegroup/robotjs') as RobotModule;
    return cached;
  } catch (e) {
    loadFailure = new Error(
      'No se pudo cargar robotjs (módulo nativo). Las acciones de teclado y volumen no están disponibles.'
    );
    log.error('robotjs unavailable:', e);
    throw loadFailure;
  }
}

/** Precarga sin propagar el error, para pagar el coste en el arranque. */
export function preloadRobot(): void {
  try {
    loadRobot();
    log.info('robotjs ready');
  } catch {
    /* ya registrado en loadRobot */
  }
}
