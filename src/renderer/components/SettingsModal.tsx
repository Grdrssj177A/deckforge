import { useState } from 'react';
import { useSettings } from '@/store/SettingsContext';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings();
  const [local, setLocal] = useState(settings);

  const handleSave = () => {
    updateSettings('nanoleaf', local.nanoleaf);
    updateSettings('obs', local.obs);
    updateSettings('discord', local.discord);
    updateSettings('grid', local.grid);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <span className="modal-icon">⚙️</span>
          <h3 className="modal-title">Configuración global</h3>
        </header>

        <div className="modal-body settings-body">
          {/* Nanoleaf */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span>💡</span> Nanoleaf
            </div>
            <p className="settings-hint">
              Se usará automáticamente en todas las acciones de Nanoleaf que no tengan IP/token propio.
            </p>
            <div className="modal-field">
              <label className="modal-label">IP del panel</label>
              <input
                type="text"
                className="modal-input"
                value={local.nanoleaf.ip}
                onChange={(e) => setLocal({ ...local, nanoleaf: { ...local.nanoleaf, ip: e.target.value } })}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Token</label>
              <input
                type="text"
                className="modal-input"
                value={local.nanoleaf.token}
                onChange={(e) => setLocal({ ...local, nanoleaf: { ...local.nanoleaf, token: e.target.value } })}
                placeholder="Tu auth token"
              />
            </div>
          </div>

          {/* OBS */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span>🎬</span> OBS Studio
            </div>
            <p className="settings-hint">
              Conexión WebSocket para todas las acciones de OBS.
            </p>
            <div className="modal-field">
              <label className="modal-label">Host:Puerto</label>
              <input
                type="text"
                className="modal-input"
                value={local.obs.host}
                onChange={(e) => setLocal({ ...local, obs: { ...local.obs, host: e.target.value } })}
                placeholder="localhost:4455"
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Contraseña</label>
              <input
                type="password"
                className="modal-input"
                value={local.obs.password}
                onChange={(e) => setLocal({ ...local, obs: { ...local.obs, password: e.target.value } })}
                placeholder="(vacío si no tiene)"
              />
            </div>
          </div>

          {/* Discord */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span>💬</span> Discord
            </div>
            <p className="settings-hint">
              Se conecta directamente a Discord via RPC local. Necesitas el Client Secret de tu app en discord.com/developers &gt; OAuth2.
            </p>
            <div className="modal-field">
              <label className="modal-label">Client Secret</label>
              <input
                type="password"
                className="modal-input"
                value={local.discord.clientSecret}
                onChange={(e) => setLocal({ ...local, discord: { ...local.discord, clientSecret: e.target.value } })}
                placeholder="Tu client secret de la app Discord"
              />
            </div>
            <p className="settings-hint">
              La primera vez que conectes, Discord te pedirá autorizar DeckForge. Después se reconecta automáticamente.
            </p>
          </div>

          {/* Grid */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span>🔲</span> Tamaño del grid
            </div>
            <p className="settings-hint">
              Cambia el número de botones visibles. Los botones existentes se mantienen.
            </p>
            <div className="settings-grid-size">
              <div className="modal-field">
                <label className="modal-label">Columnas</label>
                <select
                  className="modal-input"
                  value={local.grid.cols}
                  onChange={(e) => setLocal({ ...local, grid: { ...local.grid, cols: Number(e.target.value) } })}
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                </select>
              </div>
              <span className="settings-grid-x">×</span>
              <div className="modal-field">
                <label className="modal-label">Filas</label>
                <select
                  className="modal-input"
                  value={local.grid.rows}
                  onChange={(e) => setLocal({ ...local, grid: { ...local.grid, rows: Number(e.target.value) } })}
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                </select>
              </div>
              <span className="settings-grid-total">= {local.grid.cols * local.grid.rows} botones</span>
            </div>
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="modal-btn cancel" onClick={onClose}>Cancelar</button>
          <button type="button" className="modal-btn save" onClick={handleSave}>Guardar</button>
        </footer>
      </div>
    </div>
  );
}
