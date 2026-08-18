/**
 * Tipos compartidos para dispositivos.
 * Importado tanto por main como por renderer.
 */

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  buttonCount: number;
  hasDisplays: boolean;
  hasLeds: boolean;
}

/** Resultado de resolver una pulsación física en el Core. */
export type ButtonFeedbackStatus = 'success' | 'error' | 'empty' | 'navigate' | 'back';

/** Evento push que el main envía al renderer tras resolver una pulsación. */
export interface DeviceButtonEvent {
  deviceId: string;
  buttonId: number;
  status: ButtonFeedbackStatus;
}

export interface DeviceStatusEvent {
  connected: boolean;
  deviceId: string;
}
