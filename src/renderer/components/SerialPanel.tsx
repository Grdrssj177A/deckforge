import { useState, useEffect, useCallback } from 'react';
import { SerialPortInfo } from '@/types';

interface SerialStatus {
  connected: boolean;
  port: string;
  error?: string;
}

export function SerialPanel() {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [status, setStatus] = useState<SerialStatus>({ connected: false, port: '' });
  const [selectedPort, setSelectedPort] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Suscribirse a eventos de status del serial
  useEffect(() => {
    if (!window.deckforge) return;

    // Obtener estado inicial
    window.deckforge.serial.getStatus().then(setStatus);

    // Escuchar cambios de estado
    const unsubStatus = window.deckforge.serial.onStatus((s) => {
      setStatus(s);
      if (s.error) setError(s.error);
    });

    return () => { unsubStatus(); };
  }, []);

  const refreshPorts = useCallback(async () => {
    if (!window.deckforge) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.deckforge.serial.listPorts();
      if (result.success) {
        setPorts(result.ports);
        if (result.ports.length > 0 && !selectedPort) {
          setSelectedPort(result.ports[0].path);
        }
      } else {
        setError(result.error || 'Error listando puertos');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedPort]);

  const handleConnect = async () => {
    if (!window.deckforge || !selectedPort) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.deckforge.serial.connect(selectedPort, 9600);
      if (!result.success) {
        setError(result.error || 'Error de conexión');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.deckforge) return;
    setLoading(true);
    try {
      await window.deckforge.serial.disconnect();
    } finally {
      setLoading(false);
    }
  };

  // Cargar puertos al montar
  useEffect(() => {
    refreshPorts();
  }, [refreshPorts]);

  if (!window.deckforge) {
    return (
      <div className="serial-panel">
        <div className="serial-unavailable">
          Serial no disponible (ejecuta en Electron)
        </div>
      </div>
    );
  }

  return (
    <div className="serial-panel">
      <div className="serial-header">
        <div className="serial-title">
          <span className="serial-title-icon">🎛️</span>
          <span>Arduino</span>
        </div>
        <div className={`serial-status-dot ${status.connected ? 'connected' : ''}`}
          title={status.connected ? `Conectado: ${status.port}` : 'Desconectado'} />
      </div>

      {status.connected ? (
        <div className="serial-connected">
          <div className="serial-info">
            <span className="serial-info-label">Puerto:</span>
            <span className="serial-info-value">{status.port}</span>
          </div>
          <div className="serial-info">
            <span className="serial-info-label">Estado:</span>
            <span className="serial-info-value serial-ok">Conectado</span>
          </div>
          <div className="serial-hint">
            Botones 1-4 del Arduino → Slots 1-4 del grid
          </div>
          <button
            className="serial-btn disconnect"
            onClick={handleDisconnect}
            disabled={loading}
          >
            Desconectar
          </button>
        </div>
      ) : (
        <div className="serial-disconnected">
          <div className="serial-port-row">
            <select
              className="serial-select"
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              disabled={loading}
            >
              {ports.length === 0 && <option value="">No hay puertos</option>}
              {ports.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}
                </option>
              ))}
            </select>
            <button
              className="serial-btn refresh"
              onClick={refreshPorts}
              disabled={loading}
              title="Buscar puertos"
            >
              🔄
            </button>
          </div>
          <button
            className="serial-btn connect"
            onClick={handleConnect}
            disabled={loading || !selectedPort}
          >
            {loading ? 'Conectando...' : 'Conectar'}
          </button>
        </div>
      )}

      {error && <div className="serial-error">{error}</div>}
    </div>
  );
}
