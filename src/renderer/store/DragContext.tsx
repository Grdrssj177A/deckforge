import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Action } from '@/types';

interface DragState {
  dragging: boolean;
  draggedAction: Action | null;
}

interface DragContextValue extends DragState {
  startDrag: (action: Action) => void;
  endDrag: () => void;
  getDraggedAction: () => Action | null;
}

const DragContext = createContext<DragContextValue | null>(null);

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

  const getDraggedAction = useCallback(() => {
    return draggedRef.current;
  }, []);

  return (
    <DragContext.Provider value={{ ...state, startDrag, endDrag, getDraggedAction }}>
      {children}
    </DragContext.Provider>
  );
}

export function useDrag(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDrag must be used within DragProvider');
  return ctx;
}
