import { useEffect } from 'react';
import { DragProvider } from '@/store/DragContext';
import { PluginProvider } from '@/store/PluginContext';
import { ProfileProvider } from '@/store/ProfileContext';
import { NotificationProvider, useNotification, setGlobalShowInfo } from '@/store/NotificationContext';
import { SettingsProvider, useSettings, setGlobalGetDefaults } from '@/store/SettingsContext';
import { useSerialButtons } from '@/store/useSerialButtons';
import { initDiscordStateListener } from '@/plugins/discord';
import { Header } from '@/components/Header';
import { DeckGrid } from '@/components/DeckGrid';
import { ActionPanel } from '@/components/ActionPanel';
import { SerialPanel } from '@/components/SerialPanel';
import { InfoModal } from '@/components/InfoModal';
import '@/styles/global.css';
import '@/styles/app.css';

function AppContent() {
  useSerialButtons();

  const { showInfo } = useNotification();
  const { getPluginDefaults } = useSettings();

  useEffect(() => {
    setGlobalShowInfo(showInfo);
  }, [showInfo]);

  useEffect(() => {
    setGlobalGetDefaults(getPluginDefaults);
  }, [getPluginDefaults]);

  // Inicializar listener de estado de Discord
  useEffect(() => {
    const cleanup = initDiscordStateListener();
    return cleanup;
  }, []);

  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">
        <DeckGrid />
        <div className="sidebar">
          <ActionPanel />
          <SerialPanel />
        </div>
      </main>
      <InfoModal />
    </div>
  );
}

export function App() {
  return (
    <ProfileProvider>
      <PluginProvider>
        <SettingsProvider>
          <NotificationProvider>
            <DragProvider>
              <AppContent />
            </DragProvider>
          </NotificationProvider>
        </SettingsProvider>
      </PluginProvider>
    </ProfileProvider>
  );
}
