import { createContext, useContext, useState, useCallback } from 'react';

export interface InfoModalData {
  title: string;
  content: string;
  copiable?: boolean; // Si true, muestra botón de copiar
}

interface NotificationContextValue {
  infoModal: InfoModalData | null;
  showInfo: (data: InfoModalData) => void;
  closeInfo: () => void;
}

const NotificationCtx = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [infoModal, setInfoModal] = useState<InfoModalData | null>(null);

  const showInfo = useCallback((data: InfoModalData) => {
    setInfoModal(data);
  }, []);

  const closeInfo = useCallback(() => {
    setInfoModal(null);
  }, []);

  return (
    <NotificationCtx.Provider value={{ infoModal, showInfo, closeInfo }}>
      {children}
    </NotificationCtx.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationCtx);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}

// Global reference para que los plugins puedan disparar modales sin hooks
let globalShowInfo: ((data: InfoModalData) => void) | null = null;

export function setGlobalShowInfo(fn: (data: InfoModalData) => void) {
  globalShowInfo = fn;
}

export function showInfoGlobal(data: InfoModalData) {
  if (globalShowInfo) {
    globalShowInfo(data);
  } else {
    // Fallback si no hay provider montado
    prompt(data.title, data.content);
  }
}
