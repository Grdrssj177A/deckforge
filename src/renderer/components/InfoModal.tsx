import { useState } from 'react';
import { useNotification } from '@/store/NotificationContext';

export function InfoModal() {
  const { infoModal, closeInfo } = useNotification();
  const [copied, setCopied] = useState(false);

  if (!infoModal) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(infoModal.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: seleccionar el texto
      const textarea = document.querySelector('.info-modal-content') as HTMLTextAreaElement;
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleClose = () => {
    setCopied(false);
    closeInfo();
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal-content info-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <span className="modal-icon">ℹ️</span>
          <h3 className="modal-title">{infoModal.title}</h3>
        </header>

        <div className="modal-body">
          <textarea
            className="info-modal-content"
            value={infoModal.content}
            readOnly
            rows={3}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />

          {infoModal.copiable && (
            <button
              className={`info-modal-copy ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
            >
              {copied ? '✓ Copiado' : '📋 Copiar al portapapeles'}
            </button>
          )}
        </div>

        <footer className="modal-footer">
          <button className="modal-btn save" onClick={handleClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
