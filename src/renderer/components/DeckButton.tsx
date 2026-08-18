import { memo, useMemo, useState, useRef } from 'react';
import { ButtonSlot, Action, ActionConfig } from '@/types';
import { useDragActions } from '@/store/DragContext';
import { useProfiles } from '@/store/ProfileContext';
import { usePlugins, ExecuteTarget } from '@/store/PluginContext';
import { ConfigModal } from './ConfigModal';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface DeckButtonProps {
  slot: ButtonSlot;
  serialFeedback?: string;
  /**
   * Cambia cuando un icono dinámico (soundboard, Discord) puede haber cambiado.
   * Es lo que permite memoizar el botón sin perder esas actualizaciones.
   */
  iconRevision?: number;
}

const DRAG_TYPE_BUTTON = 'deckforge/button';

function DeckButtonImpl({ slot, serialFeedback }: DeckButtonProps) {
  const { endDrag, getDraggedAction } = useDragActions();
  const {
    assignAction, removeAction, moveButton, navigateToPage, createFolder, deleteFolder,
    currentPageId, activeProfile,
  } = useProfiles();
  const { executeAction, getDynamicIcon } = usePlugins();

  /** Identidad del botón, necesaria para que el anti-spam del Core sea por botón. */
  const target = useMemo<ExecuteTarget>(
    () => ({ position: slot.position, pageId: currentPageId, profileId: activeProfile.id }),
    [slot.position, currentPageId, activeProfile.id]
  );
  const [showConfig, setShowConfig] = useState(false);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFolder = !!slot.folderId;
  const hasContent = !!(slot.action || isFolder);

  // ─── Drop ────────────────────────────────────────────────────────────────

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // Check si es un botón del grid moviéndose
    const buttonData = e.dataTransfer.getData(DRAG_TYPE_BUTTON);
    if (buttonData !== '') {
      const fromPosition = parseInt(buttonData, 10);
      if (!isNaN(fromPosition) && fromPosition !== slot.position) {
        moveButton(fromPosition, slot.position);
      }
      return;
    }

    // Es una acción del sidebar
    const action = getDraggedAction();
    if (action) {
      const actionCopy: Action = {
        ...action,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        config: { ...action.config },
      };
      setPendingAction(actionCopy);
      setShowConfig(true);
      endDrag();
    }
  };

  // ─── Config Modal ────────────────────────────────────────────────────────

  const handleConfigSave = (config: ActionConfig) => {
    if (pendingAction) {
      const customName = config._customName as string | undefined;
      const customIcon = config._customIcon as string | undefined;
      const cleanConfig = { ...config };
      delete cleanConfig._customName;
      delete cleanConfig._customIcon;

      if (cleanConfig.command === 'folder') {
        const folderName = (cleanConfig.folderName as string) || customName || 'Carpeta';
        const folderIcon = customIcon || '📁';
        createFolder(folderName, folderIcon, slot.position);
        setPendingAction(null);
        setShowConfig(false);
        return;
      }

      const actionToSave: Action = {
        ...pendingAction,
        config: cleanConfig,
        name: customName || pendingAction.name,
        icon: customIcon || pendingAction.icon,
      };
      assignAction(slot.position, actionToSave);
      setPendingAction(null);
    } else if (slot.action) {
      const customName = config._customName as string | undefined;
      const customIcon = config._customIcon as string | undefined;
      const cleanConfig = { ...config };
      delete cleanConfig._customName;
      delete cleanConfig._customIcon;

      const updatedAction: Action = {
        ...slot.action,
        config: cleanConfig,
        name: customName || slot.action.name,
        icon: customIcon || slot.action.icon,
      };
      assignAction(slot.position, updatedAction);
    }
    setShowConfig(false);
  };

  const handleConfigCancel = () => {
    setPendingAction(null);
    setShowConfig(false);
  };

  // ─── Drag (botones del grid para reordenar) ──────────────────────────────

  const handleDragStart = (e: React.DragEvent) => {
    if (!hasContent) {
      e.preventDefault();
      return;
    }
    // Marcar explícitamente como drag de botón del grid
    e.dataTransfer.setData(DRAG_TYPE_BUTTON, String(slot.position));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);
  const handleDragEnd = () => setDragOver(false);

  // ─── Click ───────────────────────────────────────────────────────────────

  const handleClick = () => {
    if (isFolder && slot.folderId) {
      navigateToPage(slot.folderId);
      return;
    }

    if (!slot.action) return;

    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
      clickTimeout.current = null;
    }

    clickTimeout.current = setTimeout(async () => {
      try {
        await executeAction(slot.action!, target);
        setFeedback('success');
      } catch {
        setFeedback('error');
      }
      setTimeout(() => setFeedback(null), 600);
    }, 100);
  };

  // ─── Context menu ────────────────────────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasContent) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const buildContextMenuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (isFolder) {
      items.push({ label: 'Abrir carpeta', icon: '📂', action: () => slot.folderId && navigateToPage(slot.folderId) });
      items.push({ label: 'Eliminar carpeta', icon: '🗑️', action: () => slot.folderId && deleteFolder(slot.folderId), danger: true });
    } else if (slot.action) {
      items.push({
        label: 'Ejecutar', icon: '▶️',
        action: async () => {
          if (!slot.action) return;
          try { await executeAction(slot.action, target); setFeedback('success'); } catch { setFeedback('error'); }
          setTimeout(() => setFeedback(null), 600);
        },
      });
      items.push({ label: 'Configurar', icon: '⚙️', action: () => { setPendingAction(null); setShowConfig(true); } });
      items.push({ label: 'Eliminar', icon: '🗑️', action: () => removeAction(slot.position), danger: true });
    }

    return items;
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const feedbackClass = feedback ? `feedback-${feedback}` : serialFeedback ? `feedback-${serialFeedback}` : '';
  const dragOverClass = dragOver ? 'drag-over' : '';

  // Extraer estilos visuales del config
  const bgColor = slot.action?.config?._bgColor as string | undefined;
  const indicator = slot.action?.config?._indicator as string | undefined;
  const animation = slot.action?.config?._animation as string | undefined;

  const indicatorClass = indicator && indicator !== 'none' ? `indicator-${indicator}` : '';
  const animationClass = animation && animation !== 'none' ? `anim-${animation}` : '';

  const renderContent = () => {
    if (isFolder) {
      return (
        <>
          <span className="deck-button-icon">📁</span>
          <span className="deck-button-label">{slot.label || 'Carpeta'}</span>
        </>
      );
    }
    if (slot.action) {
      const dynamicIcon = getDynamicIcon(slot.action);
      const iconImage = slot.action.config?._iconImage as string | undefined;
      // Determinar qué icono mostrar: dinámico > iconImage > emoji
      const displayIcon = dynamicIcon || iconImage;
      const isImageIcon = displayIcon && displayIcon.startsWith('data:');
      return (
        <>
          <span className="deck-button-icon">
            {isImageIcon
              ? <img src={displayIcon} className="deck-button-img" alt="" />
              : (displayIcon || slot.action.icon)
            }
          </span>
          <span className="deck-button-label">{slot.label || slot.action.name}</span>
        </>
      );
    }
    return <span className="deck-button-empty">+</span>;
  };

  // 'drop-target' ya no se aplica aquí: lo activa el contenedor del grid via
  // `.deck-grid.dragging .deck-button`, para no re-renderizar cada botón al
  // empezar un arrastre.
  const buttonClass = [
    'deck-button',
    slot.action ? 'has-action' : isFolder ? 'has-folder' : 'empty',
    feedbackClass,
    dragOverClass,
    indicatorClass,
    animationClass,
  ].filter(Boolean).join(' ');

  const buttonStyle: React.CSSProperties = {};
  if (bgColor) buttonStyle.backgroundColor = bgColor;
  if (slot.color) (buttonStyle as any)['--btn-color'] = slot.color;

  return (
    <>
      <button
        className={buttonClass}
        style={buttonStyle}
        draggable={hasContent}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={
          isFolder ? `${slot.label || 'Carpeta'}\nClick: abrir | Click derecho: opciones | Arrastrar: mover`
          : slot.action ? `${slot.action.name}\nClick: ejecutar | Click derecho: opciones | Arrastrar: mover`
          : 'Arrastra una acción aquí'
        }
        aria-label={isFolder ? slot.label || 'Carpeta' : slot.action ? slot.action.name : `Botón vacío ${slot.position + 1}`}
      >
        {renderContent()}
      </button>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showConfig && (pendingAction || slot.action) && (
        <ConfigModal
          action={pendingAction || slot.action!}
          onSave={handleConfigSave}
          onCancel={handleConfigCancel}
        />
      )}
    </>
  );
}

/**
 * Memoizado: el grid renderiza hasta 36 instancias y los valores de contexto
 * ya son estables, así que solo se re-renderiza el botón cuyo slot o feedback
 * cambia realmente.
 */
export const DeckButton = memo(DeckButtonImpl);
