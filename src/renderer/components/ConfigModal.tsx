import { useState, useEffect, useRef } from 'react';
import { Action, ActionConfig } from '@/types';
import { ICON_PACK } from '@/assets/iconPack';

interface ConfigModalProps {
  action: Action;
  onSave: (config: ActionConfig) => void;
  onCancel: () => void;
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'file' | 'hotkey' | 'color' | 'select' | 'folder' | 'toggle' | 'audioDevice';
  placeholder?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  description?: string;
}

function getConfigFields(action: Action): ConfigField[] {
  const { pluginId, config } = action;

  switch (pluginId) {
    case 'soundboard':
      if (config.command === 'stopAll') return [];
      return [
        { key: 'filePath', label: 'Archivo de audio', type: 'file', description: 'MP3, WAV, OGG, FLAC' },
        { key: 'volume', label: 'Volumen', type: 'number', min: 0, max: 100, description: '0-100%' },
        { key: 'mode', label: 'Al pulsar de nuevo', type: 'select', options: [
          { value: 'overlap', label: 'Solapar (varias a la vez)' },
          { value: 'toggle', label: 'Parar (detiene el audio)' },
        ]},
        { key: 'startTime', label: 'Inicio (s)', type: 'number', min: 0, max: 9999 },
        { key: 'endTime', label: 'Fin (s)', type: 'number', min: 0, max: 9999, description: '0 = hasta el final' },
      ];
    case 'hotkey':
      return [
        { key: 'keys', label: 'Atajo de teclado', type: 'hotkey', placeholder: 'Graba una combinación...' },
        { key: 'delay', label: 'Retardo (ms)', type: 'number', min: 0, max: 5000 },
      ];
    case 'obs':
      if (config.command === 'SetCurrentScene')
        return [{ key: 'sceneName', label: 'Nombre de escena', type: 'text', placeholder: 'Scene 1' }];
      if (config.command === 'ToggleMute')
        return [{ key: 'source', label: 'Fuente de audio', type: 'text', placeholder: 'Mic/Aux' }];
      return [];
    case 'discord':
      return []; // No tiene config individual
    case 'nanoleaf':
      if (config.command === 'setColor') return [{ key: 'color', label: 'Color', type: 'color' }];
      if (config.command === 'setEffect') return [{ key: 'effect', label: 'Efecto', type: 'text', placeholder: 'Flames' }];
      if (config.command === 'brightnessUp' || config.command === 'brightnessDown')
        return [{ key: 'step', label: 'Incremento (%)', type: 'number', min: 1, max: 100 }];
      return [];
    case 'system':
      switch (config.command) {
        case 'openUrl': return [{ key: 'url', label: 'URL', type: 'text', placeholder: 'https://...' }];
        case 'openApp': return [{ key: 'path', label: 'Aplicación', type: 'file' }];
        case 'folder': return [{ key: 'folderName', label: 'Nombre de carpeta', type: 'text', placeholder: 'Mi carpeta' }];
        case 'screenshot': return [
          { key: 'savePath', label: 'Carpeta destino', type: 'folder', description: 'Vacío = Escritorio' },
          { key: 'format', label: 'Formato', type: 'select', options: [
            { value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' },
          ]},
          { key: 'captureMode', label: 'Modo', type: 'select', options: [
            { value: 'fullscreen', label: 'Pantalla completa' }, { value: 'window', label: 'Ventana activa' },
          ]},
        ];
        case 'volumeUp': case 'volumeDown':
          return [{ key: 'step', label: 'Paso (%)', type: 'number', min: 1, max: 50 }];
        default: return [];
      }
    default: return [];
  }
}

// ─── Audio Device Selector ──────────────────────────────────────────────────

function AudioDeviceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()));
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === 'audiooutput'));
      } catch { setDevices([]); }
    })();
  }, []);
  return (
    <select className="modal-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Por defecto</option>
      {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 12)}</option>)}
    </select>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ConfigModal({ action, onSave, onCancel }: ConfigModalProps) {
  const [config, setConfig] = useState<ActionConfig>({
    ...action.config,
    _customName: action.name,
    _customIcon: action.icon,
  });
  const [recordingHotkey, setRecordingHotkey] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const fields = getConfigFields(action);

  useEffect(() => {
    if (fields.length === 0 && action.config.command === 'stopAll') { onSave(config); }
  }, []); // eslint-disable-line

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !recordingHotkey) onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel, recordingHotkey]);

  useEffect(() => { modalRef.current?.focus(); }, []);

  const handleChange = (key: string, value: string | number | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleHotkeyKeyDown = (e: React.KeyboardEvent, fieldKey: string) => {
    if (!recordingHotkey) return;
    e.preventDefault();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Win');
    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();
    parts.push(key);
    setConfig((prev) => ({ ...prev, [fieldKey]: parts.join('+') }));
    setRecordingHotkey(null);
  };

  const handleFileSelect = async (fieldKey: string) => {
    if (window.deckforge) {
      const result = await window.deckforge.sound.selectFile();
      if (result) setConfig((prev) => ({ ...prev, [fieldKey]: result }));
    } else {
      const p = prompt('Ruta:');
      if (p) setConfig((prev) => ({ ...prev, [fieldKey]: p }));
    }
  };

  const handleFolderSelect = async (fieldKey: string) => {
    if (window.deckforge) {
      const result = await window.deckforge.system.selectFolder();
      if (result) setConfig((prev) => ({ ...prev, [fieldKey]: result }));
    }
  };

  const handleImageUpload = (targetKey: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/svg+xml,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file || file.size > 65536) { alert('Máximo 64KB'); return; }
      const reader = new FileReader();
      reader.onload = () => setConfig((prev) => ({ ...prev, [targetKey]: reader.result as string }));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSave = () => { onSave(config); };

  if (fields.length === 0 && action.config.command === 'stopAll') return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} ref={modalRef} tabIndex={-1}>
        <header className="modal-header">
          <span className="modal-icon">
            {(config._iconImage as string)
              ? <img src={config._iconImage as string} className="modal-icon-img" alt="" />
              : (config._customIcon as string) || action.icon}
          </span>
          <h3 className="modal-title">Configurar acción</h3>
        </header>

        <div className="modal-body">
          {/* ── Nombre + Icono (siempre visible, compacto) ── */}
          <div className="modal-row">
            <div className="modal-field modal-field-grow">
              <label className="modal-label">Nombre</label>
              <input type="text" className="modal-input" value={(config._customName as string) || ''}
                onChange={(e) => handleChange('_customName', e.target.value)} placeholder={action.name} />
            </div>
            <div className="modal-field">
              <label className="modal-label">Icono</label>
              <button type="button" className="modal-icon-preview" onClick={() => setShowIconPicker(!showIconPicker)}>
                {(config._iconImage as string)
                  ? <img src={config._iconImage as string} className="modal-icon-img" alt="" />
                  : (config._customIcon as string) || action.icon}
              </button>
            </div>
          </div>

          {/* Icon picker (expandible) */}
          {showIconPicker && (
            <div className="modal-icon-picker-container">
              <div className="modal-icon-picker-actions">
                <button type="button" className="modal-btn-browse" onClick={() => handleImageUpload('_iconImage')}>📷 Subir</button>
                <button type="button" className="modal-btn-browse" onClick={() => { handleChange('_iconImage', ''); handleChange('_customIcon', ''); }}>✕ Reset</button>
              </div>
              <div className="modal-icon-picker">
                {ICON_PACK.map((icon, i) => (
                  <button key={i} type="button" className="modal-icon-option icon-pack-item" title={icon.name}
                    onClick={() => { handleChange('_iconImage', icon.svg); handleChange('_customIcon', ''); setShowIconPicker(false); }}>
                    <img src={icon.svg} alt={icon.name} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Configuración de la acción ── */}
          {fields.length > 0 && (
            <div className="modal-section">
              {fields.map((field) => (
                <div key={field.key} className="modal-field">
                  <label className="modal-label">{field.label}</label>
                  {field.description && <span className="modal-field-desc">{field.description}</span>}

                  {field.type === 'text' && <input type="text" className="modal-input" value={(config[field.key] as string) || ''} onChange={(e) => handleChange(field.key, e.target.value)} placeholder={field.placeholder} />}
                  {field.type === 'number' && <input type="number" className="modal-input" value={(config[field.key] as number) ?? ''} onChange={(e) => handleChange(field.key, Number(e.target.value))} min={field.min} max={field.max} />}
                  {field.type === 'color' && <input type="color" className="modal-input modal-input-color" value={(config[field.key] as string) || '#ff6600'} onChange={(e) => handleChange(field.key, e.target.value)} />}
                  {field.type === 'select' && <select className="modal-input" value={(config[field.key] as string) || field.options?.[0]?.value || ''} onChange={(e) => handleChange(field.key, e.target.value)}>{field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
                  {field.type === 'toggle' && <label className="modal-toggle"><input type="checkbox" checked={!!config[field.key]} onChange={(e) => handleChange(field.key, e.target.checked)} /><span className="modal-toggle-slider"></span><span className="modal-toggle-label">{config[field.key] ? 'Sí' : 'No'}</span></label>}
                  {field.type === 'file' && <div className="modal-file-field"><input type="text" className="modal-input" value={(config[field.key] as string) || ''} readOnly placeholder="Seleccionar..." /><button type="button" className="modal-btn-browse" onClick={() => handleFileSelect(field.key)}>Explorar</button></div>}
                  {field.type === 'folder' && <div className="modal-file-field"><input type="text" className="modal-input" value={(config[field.key] as string) || ''} readOnly placeholder="Seleccionar..." /><button type="button" className="modal-btn-browse" onClick={() => handleFolderSelect(field.key)}>Explorar</button></div>}
                  {field.type === 'hotkey' && <div className="modal-hotkey-field"><input type="text" className={`modal-input ${recordingHotkey === field.key ? 'recording' : ''}`} value={recordingHotkey === field.key ? '⏺ Pulsa teclas...' : (config[field.key] as string) || ''} onKeyDown={(e) => handleHotkeyKeyDown(e, field.key)} readOnly placeholder={field.placeholder} /><button type="button" className="modal-btn-record" onClick={() => setRecordingHotkey(recordingHotkey === field.key ? null : field.key)}>{recordingHotkey === field.key ? '⏹' : '⏺'}</button></div>}
                  {field.type === 'audioDevice' && <AudioDeviceSelect value={(config[field.key] as string) || ''} onChange={(v) => handleChange(field.key, v)} />}
                </div>
              ))}
            </div>
          )}

          {/* ── Avanzado (colapsable) ── */}
          <button type="button" className="modal-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? '▾' : '▸'} Opciones avanzadas
          </button>

          {showAdvanced && (
            <div className="modal-section modal-section-advanced">
              <div className="modal-field">
                <label className="modal-label">Color de fondo</label>
                <div className="modal-color-row">
                  <input type="color" className="modal-input modal-input-color" value={(config._bgColor as string) || '#1e1e32'} onChange={(e) => handleChange('_bgColor', e.target.value)} />
                  <button type="button" className="modal-btn-browse" onClick={() => handleChange('_bgColor', '')}>Reset</button>
                </div>
              </div>
              <div className="modal-field">
                <label className="modal-label">Indicador (borde)</label>
                <select className="modal-input" value={(config._indicator as string) || 'none'} onChange={(e) => handleChange('_indicator', e.target.value)}>
                  <option value="none">Sin indicador</option>
                  <option value="green">Verde</option>
                  <option value="red">Rojo</option>
                  <option value="blue">Azul</option>
                  <option value="yellow">Amarillo</option>
                  <option value="purple">Morado</option>
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Animación al ejecutar</label>
                <select className="modal-input" value={(config._animation as string) || 'none'} onChange={(e) => handleChange('_animation', e.target.value)}>
                  <option value="none">Ninguna</option>
                  <option value="pulse">Pulso</option>
                  <option value="glow">Glow</option>
                  <option value="shake">Vibrar</option>
                  <option value="bounce">Rebote</option>
                  <option value="spin">Girar icono</option>
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Icono estado activo</label>
                <span className="modal-field-desc">Se muestra cuando la acción está activa (mute, playing...)</span>
                <div className="modal-icon-field">
                  <span className="modal-icon-preview modal-icon-preview-sm">
                    {(config._iconActive as string) ? <img src={config._iconActive as string} className="modal-icon-img" alt="" /> : '—'}
                  </span>
                  <button type="button" className="modal-btn-browse" onClick={() => handleImageUpload('_iconActive')}>📷</button>
                  <button type="button" className="modal-btn-browse" onClick={() => handleChange('_iconActive', '')}>✕</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="modal-btn cancel" onClick={onCancel}>Cancelar</button>
          <button type="button" className="modal-btn save" onClick={handleSave}>Guardar</button>
        </footer>
      </div>
    </div>
  );
}
