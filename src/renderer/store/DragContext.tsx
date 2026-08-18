import React, { createContext, useContext, useMemo, useState, useCallback, useRef } from 'react';
import { Action } from '@/types';

/**
 * El estado de arrastre se separa de las acciones a propósito.
 *
 * `useContext` re-renderiza al consumidor ante cualquier cambio del valor del
 * contexto, sin importar qué campo se lea. Con un único contexto, empezar o
 * terminar un arrastre re-renderizaba los 36 botones del grid. Ahora:
 *   - DragActionsContext: callbacks estables, lo que consumen los botones.
 *   - DragStateContext: el flag volátil, que solo consume el contenedor del grid.
 */

interface DragState {
  dragging: boolean;
  draggedAction: Action | null;
}

interface DragActions {
  startDrag: (action: Action) => void;
  endDrag: () => void;
  getDraggedAction: () => Action | null;
}

const DragStateContext = createContext<DragState | null>(null);
const DragActionsContext = createContext<DragActions | null>(null);

export function DragProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DragState>({
    dragging: false,
    draggedAction: null,
  });

  // Ref para acceso sincrónico en event handlers sin depender del re-render
  const draggedRef = useRef<Action | null>(null);

  const startDrag = useCallback((action: Action) => {
    draggedRef.current = action;
    setState({ dragging: true, draggedAction: action });
  }, []);

  const endDrag = useCallback(() => {
    draggedRef.current = null;
    setState({ dragging: false, draggedAction: null });
  }, []);

  const getDraggedAction = useCallback(() => draggedRef.current, []);

  // Estable durante toda la vida del provider: los consumidores de acciones
  // nunca se re-renderizan por un arrastre.
  const actions = useMemo<DragActions>(
    () => ({ startDrag, endDrag, getDraggedAction }),
    [startDrag, endDrag, getDraggedAction]
  );

  return (
    <DragActionsContext.Provider value={actions}>
      <DragStateContext.Provider value={state}>
        {children}
      </DragStateContext.Provider>
    </DragActionsContext.Provider>
  );
}

export function useDragActions(): DragActions {
  const ctx = useContext(DragActionsContext);
  if (!ctx) throw new Error('useDragActions must be used within DragProvider');
  return ctx;
}

export function useDragState(): DragState {
  const ctx = useContext(DragStateContext);
  if (!ctx) throw new Error('useDragState must be used within DragProvider');
  return ctx;
}
