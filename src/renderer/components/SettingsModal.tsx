import { useState } from 'react';
import { useSettings } from '@/store/SettingsContext';
import { useProfiles } from '@/store/ProfileContext';
import { createLogger } from '@/lib/logger';

const log = createLogger('Settings');

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings();
  const { profiles, refresh } = useProfiles();
  const [local, setLocal] = useState(settings);
  const [saveError, setSaveError] = useState('');
  const [importError, setImportError] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * Guarda sección por sección y solo cierra si todo se aceptó.
   * El main valida rangos y formatos, así que un guardado puede fallar
   * legítimamente y el usuario tiene que verlo.
   */
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const sections: Array<[Parameters<typeof updateSettings>[0], any]> = [
        ['nanoleaf', local.nanoleaf],
        ['obs', local.obs],
        ['discord', local.discord],
        ['grid', local.grid],
      ];
      const errors: string[] = [];
      for (const [section, values] of sections) {
        const res = await updateSettings(section, values);
        if (!res.success) errors.push(res.error || `No se pudo guardar "${section}"`);
      }
      if (errors.length > 0) {
        setSaveError(errors.join(' · '));
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const [pairingNanoleaf, setPairingNanoleaf] = useState(false);
  const [nanoleafPairResult, setNanoleafPairResult] = useState<string | null>(null);

  const handleNanoleafPair = async () => {
    if (!local.nanoleaf.ip) return;
    setPairingNanoleaf(true);
    setNanoleafPairResult(null);
    try {
      const result = await window.deckforge!.settings.nanoleafPair(local.nanoleaf.ip);
      if (result.success && result.token) {
        setNanoleafPairResult(result.token);
        setLocal({ ...local, nanoleaf: { ...local.nanoleaf, token: result.token } });
      } else {
        setNanoleafPairResult(`Error: ${result.error || 'Fallo al emparejar'}`);
      }
    } catch (e) {
      setNanoleafPairResult('Error de conexión');
    }
    setPairingNanoleaf(false);
  };

  const [connectingDiscord, setConnectingDiscord] = useState(false);
  const [discordStatus, setDiscordStatus] = useState('');

  const handleDiscordConnect = async () => {
    setConnectingDiscord(true);
    setDiscordStatus('');
    try {
      // No enviar el secret enmascarado — el main ya lo tiene en safeStorage
      const result = await window.deckforge!.settings.discordConnect('');
      if (result.success) {
        setDiscordStatus('Conectado ✓');
      } else {
        setDiscordStatus(`Error: ${result.error || 'Fallo'}`);
      }
    } catch {
      setDiscordStatus('Error de conexión');
    }
    setConnectingDiscord(false);
  };

  const [exportSelection, setExportSelection] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [importedProfiles, setImportedProfiles] = useState<{ id: string; name: string }[]>([]);

  const handleExportOpen = () => {
    setExportSelection(new Set());
    setShowExportModal(true);
  };

  const handleExportToggle = (id: string) => {
    setExportSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportConfirm = async () => {
    if (!window.deckforge || exportSelection.size === 0) return;
    const selected = profiles.filter((p) => exportSelection.has(p.id));
    // Si es un solo perfil exportar como objeto, si son varios como array
    const data = selected.length === 1
      ? JSON.stringify(selected[0], null, 2)
      : JSON.stringify(selected, null, 2);
    const result = await window.deckforge.profiles.export(data);
    if (result.success) {
      log.info(`Exported ${selected.length} profile(s)`);
      setShowExportModal(false);
    }
  };

  /**
   * Importa en una sola llamada. Antes se recreaba el perfil botón a botón
   * (una IPC y una reescritura completa del archivo por botón) y sin validar
   * nada de lo que traía el JSON.
   */
  const handleImport = async () => {
    if (!window.deckforge) return;
    setImportError('');

    const picked = await window.deckforge.profiles.import();
    if (!picked.success || !picked.data) {
      if (picked.error && picked.error !== 'Cancelado') setImportError(picked.error);
      return;
    }

    const result = await window.deckforge.profiles.importProfiles(picked.data);
    if (!result.success) {
      setImportError(result.error || 'No se pudo importar el archivo');
      log.error(`Import failed: ${result.error}`);
      return;
    }

    await refresh();
    log.info(`Imported ${result.imported ?? 0} profile(s)`);

    // Los perfiles importados conservan su nombre; se ofrece renombrarlos.
    const known = new Set(profiles.map((p) => p.id));
    const fresh = (await window.deckforge.profiles.getAll()).profiles
      .filter((p) => !known.has(p.id))
      .map((p) => ({ id: p.id, name: p.name }));
    setImportedProfiles(fresh);
  };

  const handleRenameChange = (id: string, newName: string) => {
    setImportedProfiles((prev) => prev.map((p) => p.id === id ? { ...p, name: newName } : p));
  };

  // Antes ambos flujos hacían window.location.reload(), que descarta todo el
  // estado de la UI. Basta con refrescar los perfiles desde el main.
  const handleRenameConfirm = async () => {
    if (!window.deckforge) return;
    for (const p of importedProfiles) {
      const res = await window.deckforge.profiles.rename(p.id, p.name);
      if (!res.success) setImportError(res.error || 'No se pudo renombrar un perfil');
    }
    setImportedProfiles([]);
    await refresh();
  };

  const handleRenameSkip = async () => {
    setImportedProfiles([]);
    await refresh();
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
            <div className="modal-field">
              <p className="settings-hint">Mantén pulsado el botón del panel 5-7 segundos y pulsa "Emparejar".</p>
              <button type="button" className="modal-btn-browse" onClick={handleNanoleafPair} disabled={pairingNanoleaf || !local.nanoleaf.ip}>
                {pairingNanoleaf ? 'Emparejando...' : '🔑 Emparejar Nanoleaf'}
              </button>
              {nanoleafPairResult && (
                <div className={`settings-hint ${nanoleafPairResult.startsWith('Error') ? 'settings-error' : 'settings-success'}`}>
                  {nanoleafPairResult}
                </div>
              )}
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
            <button type="button" className="modal-btn-browse" onClick={handleDiscordConnect} disabled={connectingDiscord}>
              {connectingDiscord ? 'Conectando...' : '🔗 Conectar Discord'}
            </button>
            {discordStatus && (
              <div className={`settings-hint ${discordStatus.startsWith('Error') ? 'settings-error' : 'settings-success'}`}>
                {discordStatus}
              </div>
            )}
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
          {/* Perfiles: Export/Import */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span>💾</span> Perfiles
            </div>
            <div className="modal-file-field">
              <button type="button" className="modal-btn-browse" onClick={handleExportOpen}>📤 Exportar</button>
              <button type="button" className="modal-btn-browse" onClick={handleImport}>📥 Importar</button>
            </div>
            {importError && (
              <div className="settings-hint settings-error" role="alert">{importError}</div>
            )}
          </div>
        </div>

        {/* Modal de selección de export */}
        {showExportModal && (
          <div className="settings-export-overlay">
            <div className="settings-export-modal">
              <h4>Selecciona perfiles a exportar</h4>
              <div className="settings-export-list">
                {profiles.map((p) => (
                  <label key={p.id} className="settings-export-item">
                    <input
                      type="checkbox"
                      checked={exportSelection.has(p.id)}
                      onChange={() => handleExportToggle(p.id)}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
              <div className="settings-export-actions">
                <button type="button" className="modal-btn cancel" onClick={() => setShowExportModal(false)}>Cancelar</button>
                <button type="button" className="modal-btn save" onClick={handleExportConfirm} disabled={exportSelection.size === 0}>
                  Exportar ({exportSelection.size})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Popup de renombrar perfiles importados */}
        {importedProfiles.length > 0 && (
          <div className="settings-export-overlay">
            <div className="settings-export-modal">
              <h4>Perfiles importados ({importedProfiles.length})</h4>
              <div className="settings-export-list">
                {importedProfiles.map((p) => (
                  <div key={p.id} className="modal-field">
                    <input
                      type="text"
                      className="modal-input"
                      value={p.name}
                      onChange={(e) => handleRenameChange(p.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="settings-export-actions">
                <button type="button" className="modal-btn cancel" onClick={handleRenameSkip}>Mantener nombres</button>
                <button type="button" className="modal-btn save" onClick={handleRenameConfirm}>Guardar</button>
              </div>
            </div>
          </div>
        )}

        <footer className="modal-footer">
          {saveError && (
            <div className="settings-hint settings-error settings-save-error" role="alert">{saveError}</div>
          )}
          <button type="button" className="modal-btn cancel" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="modal-btn save" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
