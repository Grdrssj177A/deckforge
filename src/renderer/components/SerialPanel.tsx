import { useState, useEffect, useCallback } from 'react';

interface DeviceStatus {
  connected: boolean;
  deviceId: string;
}

/**
 * Panel de conexión de dispositivos (Arduino/RP2040).
 * Usa la API genérica `window.deckforge.devices` (agnóstica del transporte).
 */
export function SerialPanel() {
  const [ports, setPorts] = useState<any[]>([]);
  const [status, setStatus] = useState<DeviceStatus>({ connected: false, deviceId: '' });
  const [selectedPort, setSelectedPort] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!window.deckforge) return;

    const unsubStatus = window.deckforge.devices.onStatus((s) => {
      setStatus(s);
    });

    // Comprobar dispositivos ya conectados
    window.deckforge.devices.listConnected().then((res) => {
      if (res.success && res.devices.length > 0) {
        const dev = res.devices.find((d: any) => d.type !== 'virtual');
        if (dev) setStatus({ connected: true, deviceId: dev.id });
      }
    });

    return () => { unsubStatus(); };
  }, []);

  const refreshPorts = useCallback(async () => {
    if (!window.deckforge) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.deckforge.devices.listAvailable();
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
      const result = await window.deckforge.devices.connect(selectedPort, 9600);
      if (!result.success) {
        setError(result.error || 'Error de conexión');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.deckforge || !status.deviceId) return;
    setLoading(true);
    try {
      await window.deckforge.devices.disconnect(status.deviceId);
      setStatus({ connected: false, deviceId: '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshPorts(); }, [refreshPorts]);

  if (!window.deckforge) {
    return (
      <div className="serial-panel">
        <div className="serial-unavailable">No disponible (ejecuta en Electron)</div>
      </div>
    );
  }

  return (
    <div className="serial-panel">
      <div className="serial-header">
        <div className="serial-title">
          <span className="serial-title-icon">🎛️</span>
          <span>Dispositivo</span>
        </div>
        <div className={`serial-status-dot ${status.connected ? 'connected' : ''}`}
          title={status.connected ? `Conectado: ${status.deviceId}` : 'Desconectado'} />
      </div>

      {status.connected ? (
        <div className="serial-connected">
          <div className="serial-info">
            <span className="serial-info-label">ID:</span>
            <span className="serial-info-value">{status.deviceId}</span>
          </div>
          <div className="serial-hint">
            Botones físicos → Slots del grid
          </div>
          <button className="serial-btn disconnect" onClick={handleDisconnect} disabled={loading}>
            Desconectar
          </button>
        </div>
      ) : (
        <div className="serial-disconnected">
          <div className="serial-port-row">
            <select className="serial-select" value={selectedPort} onChange={(e) => setSelectedPort(e.target.value)} disabled={loading}>
              {ports.length === 0 && <option value="">No hay puertos</option>}
              {ports.map((p: any) => (
                <option key={p.path} value={p.path}>
                  {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}
                </option>
              ))}
            </select>
            <button className="serial-btn refresh" onClick={refreshPorts} disabled={loading} title="Buscar puertos">🔄</button>
          </div>
          <button className="serial-btn connect" onClick={handleConnect} disabled={loading || !selectedPort}>
            {loading ? 'Conectando...' : 'Conectar'}
          </button>
        </div>
      )}

      {error && <div className="serial-error">{error}</div>}
    </div>
  );
}
