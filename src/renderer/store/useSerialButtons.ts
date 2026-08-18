import { useEffect } from 'react';
import type { ButtonFeedbackStatus } from '@/types';

// Evento custom para feedback visual en los botones
export const SERIAL_BUTTON_EVENT = 'deckforge:serialButton';

export interface SerialButtonEvent {
  buttonIndex: number;
  status: ButtonFeedbackStatus;
}

/**
 * Hook que escucha feedback de botones físicos del Core.
 *
 * El flujo es:
 *   Arduino → DeviceManager → EventBus → SessionManager → ActionManager → Plugin
 *   SessionManager → IPC push → device:buttonFeedback → este hook → animación visual
 *
 * Este hook no resuelve acciones, carpetas ni navegación: todo eso lo hace el
 * Core. Solo traduce el resultado real a un evento de UI.
 */
export function useSerialButtons() {
  useEffect(() => {
    if (!window.deckforge) return;

    const unsubscribe = window.deckforge.devices.onButtonPress((event) => {
      window.dispatchEvent(
        new CustomEvent<SerialButtonEvent>(SERIAL_BUTTON_EVENT, {
          detail: { buttonIndex: event.buttonId, status: event.status },
        })
      );
    });

    return () => { unsubscribe(); };
  }, []);
}
