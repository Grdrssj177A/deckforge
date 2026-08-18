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
  const { profiles } = useProfiles();
  const [local, setLocal] = useState(settings);

  const handleSave = () => {
    updateSettings('nanoleaf', local.nanoleaf);
    updateSettings('obs', local.obs);
    updateSettings('discord', local.discord);
    updateSettings('grid', local.grid);
    onClose();
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

  const handleImport = async () => {
    if (!window.deckforge) return;
    const result = await window.deckforge.profiles.import();
    if (result.success && result.data) {
      try {
        const parsed = JSON.parse(result.data);
        const toImport = Array.isArray(parsed) ? parsed : [parsed];
        const imported: { id: string; name: string }[] = [];

        for (const p of toImport) {
          // Usar IPC para importar al ProfileManager (no localStorage)
          const res = await window.deckforge.profiles.create(p.name + ' (importado)');
          if (res.success && res.profile) {
            // Ahora asignar las acciones del perfil importado
            // Forma simple: usar assignAction para cada botón que tenga acción
            const profileId = res.profile.id;
            for (const btn of p.buttons || []) {
              if (btn.action) {
                await window.deckforge.profiles.assignAction(profileId, null, btn.position, btn.action);
              }
              if (btn.folderId) {
                // Recrear carpetas
                const page = (p.pages || []).find((pg: any) => pg.id === btn.folderId);
                if (page) {
                  const folderRes = await window.deckforge.profiles.createFolder(profileId, null, btn.position, page.name, page.icon);
                  // Asignar acciones dentro de la carpeta
                  if (folderRes.success && folderRes.folderId) {
                    for (const subBtn of page.buttons || []) {
                      if (subBtn.action) {
                        await window.deckforge.profiles.assignAction(profileId, folderRes.folderId, subBtn.position, subBtn.action);
                      }
                    }
                  }
                }
              }
            }
            imported.push({ id: profileId, name: p.name + ' (importado)' });
          }
        }

        setImportedProfiles(imported);
      } catch {
        log.error('Invalid profile format');
      }
    }
  };

  const handleRenameChange = (id: string, newName: string) => {
    setImportedProfiles((prev) => prev.map((p) => p.id === id ? { ...p, name: newName } : p));
  };

  const handleRenameConfirm = async () => {
    if (!window.deckforge) return;
    for (const p of importedProfiles) {
      await window.deckforge.profiles.rename(p.id, p.name);
    }
    setImportedProfiles([]);
    window.location.reload();
  };

  const handleRenameSkip = () => {
    setImportedProfiles([]);
    window.location.reload();
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
          {/* Perfiles: Export/Import */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span>💾</span> Perfiles
            </div>
            <div className="modal-file-field">
              <button type="button" className="modal-btn-browse" onClick={handleExportOpen}>📤 Exportar</button>
              <button type="button" className="modal-btn-browse" onClick={handleImport}>📥 Importar</button>
            </div>
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
          <button type="button" className="modal-btn cancel" onClick={onClose}>Cancelar</button>
          <button type="button" className="modal-btn save" onClick={handleSave}>Guardar</button>
        </footer>
      </div>
    </div>
  );
}
