import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProfiles } from '@/store/ProfileContext';
import { useSettings } from '@/store/SettingsContext';
import { useDragState } from '@/store/DragContext';
import { SERIAL_BUTTON_EVENT, SerialButtonEvent } from '@/store/useSerialButtons';
import { SOUND_STATE_EVENT } from '@/plugins/soundboard';
import { DISCORD_STATE_EVENT } from '@/plugins/discord';
import { DeckButton } from './DeckButton';
import { ErrorBoundary } from './ErrorBoundary';

export function DeckGrid() {
  const { currentButtons, currentPageId, navigateBack } = useProfiles();
  const { settings } = useSettings();
  const { dragging } = useDragState();
  const [serialFeedback, setSerialFeedback] = useState<{ index: number; status: string } | null>(null);

  /**
   * Contador que invalida los iconos dinámicos (soundboard, Discord).
   * Se mantiene como estado del grid porque los iconos dependen de módulos
   * globales, no de props; los botones memoizados lo reciben como prop.
   */
  const [iconRevision, setIconRevision] = useState(0);

  const cols = settings.grid.cols;
  const rows = settings.grid.rows;
  const totalSlots = cols * rows;

  const isInFolder = !!currentPageId;
  // En folder, slot 0 es "Volver", así que mostramos totalSlots - 1 botones de la página
  const displayButtons = useMemo(
    () => (isInFolder ? currentButtons.slice(0, totalSlots - 1) : currentButtons.slice(0, totalSlots)),
    [currentButtons, isInFolder, totalSlots]
  );

  // Escuchar feedback de botones físicos
  useEffect(() => {
    const handler = (e: Event) => {
      const { buttonIndex, status } = (e as CustomEvent<SerialButtonEvent>).detail;
      setSerialFeedback({ index: buttonIndex, status });
      setTimeout(() => setSerialFeedback(null), 600);
    };
    window.addEventListener(SERIAL_BUTTON_EVENT, handler);
    return () => window.removeEventListener(SERIAL_BUTTON_EVENT, handler);
  }, []);

  // Refrescar iconos dinámicos
  const bumpIcons = useCallback(() => setIconRevision((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener(SOUND_STATE_EVENT, bumpIcons);
    window.addEventListener(DISCORD_STATE_EVENT, bumpIcons);
    return () => {
      window.removeEventListener(SOUND_STATE_EVENT, bumpIcons);
      window.removeEventListener(DISCORD_STATE_EVENT, bumpIcons);
    };
  }, [bumpIcons]);

  const gridClass = `deck-grid${dragging ? ' dragging' : ''}`;

  return (
    <section className="deck-grid-container" aria-label="Grid de botones">
      <div
        className={gridClass}
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {isInFolder && (
          <button
            className={`deck-button back-button ${serialFeedback?.index === 0 ? `feedback-${serialFeedback.status}` : ''}`}
            onClick={navigateBack}
            title="Volver a la página anterior"
            aria-label="Volver"
          >
            <span className="deck-button-icon">←</span>
            <span className="deck-button-label">Volver</span>
          </button>
        )}

        {displayButtons.map((slot, i) => {
          const arduinoIndex = isInFolder ? i + 1 : i;
          const feedback = serialFeedback?.index === arduinoIndex ? serialFeedback.status : undefined;
          return (
            <ErrorBoundary key={`${currentPageId || 'root'}-${slot.position}`} name={`Button-${slot.position}`}>
              <DeckButton slot={slot} serialFeedback={feedback} iconRevision={iconRevision} />
            </ErrorBoundary>
          );
        })}
      </div>
    </section>
  );
}
