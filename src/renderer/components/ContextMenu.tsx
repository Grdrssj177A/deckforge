import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon: string;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();

    // Usar timeout para evitar que el mismo click derecho cierre el menú
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  // Ajustar posición para que no se salga de pantalla
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    if (rect.right > viewW) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > viewH) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div
      className="context-menu"
      ref={menuRef}
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Menú contextual"
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`context-menu-item ${item.danger ? 'danger' : ''}`}
          onClick={() => {
            onClose();
            // Ejecutar la acción en el siguiente tick para que el menú se cierre primero
            setTimeout(() => item.action(), 0);
          }}
          disabled={item.disabled}
          role="menuitem"
        >
          <span className="context-menu-icon">{item.icon}</span>
          <span className="context-menu-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
