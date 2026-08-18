import { useEffect, useCallback, useRef } from 'react';
import { useProfiles } from './ProfileContext';
import { usePlugins } from './PluginContext';
import { createLogger } from '@/lib/logger';

const log = createLogger('Serial');

// Evento custom para feedback visual en los botones
export const SERIAL_BUTTON_EVENT = 'deckforge:serialButton';

export interface SerialButtonEvent {
  buttonIndex: number;
  status: 'success' | 'error' | 'empty';
}

function emitSerialFeedback(buttonIndex: number, status: SerialButtonEvent['status']) {
  window.dispatchEvent(
    new CustomEvent(SERIAL_BUTTON_EVENT, { detail: { buttonIndex, status } })
  );
}

/**
 * Hook que escucha eventos de botones físicos del Arduino
 * y ejecuta la acción del slot correspondiente en la PÁGINA ACTUAL.
 */
export function useSerialButtons() {
  const { currentButtons, currentPageId, navigateToPage, navigateBack } = useProfiles();
  const { executeAction, isActionBusy } = usePlugins();

  const currentButtonsRef = useRef(currentButtons);
  const currentPageIdRef = useRef(currentPageId);

  useEffect(() => { currentButtonsRef.current = currentButtons; }, [currentButtons]);
  useEffect(() => { currentPageIdRef.current = currentPageId; }, [currentPageId]);

  const handleButtonPress = useCallback(async (buttonIndex: number) => {
    log.info(`Button ${buttonIndex} pressed`);

    const isInFolder = !!currentPageIdRef.current;

    // Dentro de un folder: botón 0 = "Volver"
    if (isInFolder && buttonIndex === 0) {
      navigateBack();
      emitSerialFeedback(buttonIndex, 'success');
      return;
    }

    const slotIndex = isInFolder ? buttonIndex - 1 : buttonIndex;
    const buttons = currentButtonsRef.current;

    if (slotIndex < 0 || slotIndex >= buttons.length) {
      emitSerialFeedback(buttonIndex, 'empty');
      return;
    }

    const slot = buttons[slotIndex];

    // Folder → navegar
    if (slot.folderId) {
      navigateToPage(slot.folderId);
      emitSerialFeedback(buttonIndex, 'success');
      return;
    }

    // Vacío
    if (!slot.action) {
      emitSerialFeedback(buttonIndex, 'empty');
      return;
    }

    // Anti-spam: per-button check
    if (isActionBusy(slot.action.id)) {
      log.debug(`Button ${buttonIndex} still busy, skipping`);
      return;
    }

    try {
      await executeAction(slot.action);
      emitSerialFeedback(buttonIndex, 'success');
    } catch {
      emitSerialFeedback(buttonIndex, 'error');
    }
  }, [executeAction, isActionBusy, navigateBack, navigateToPage]);

  useEffect(() => {
    if (!window.deckforge) return;
    const unsubscribe = window.deckforge.devices.onButtonPress(handleButtonPress);
    return () => { unsubscribe(); };
  }, [handleButtonPress]);
}
