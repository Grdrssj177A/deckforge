import React from 'react';
import { Action } from '@/types';
import { useDrag } from '@/store/DragContext';

interface ActionItemProps {
  action: Action;
}

export function ActionItem({ action }: ActionItemProps) {
  const { startDrag, endDrag } = useDrag();

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'all';
    e.dataTransfer.setData('deckforge/action', action.id);
    startDrag(action);
  };

  const handleDragEnd = () => {
    // Delay para que el drop event del target se procese primero
    setTimeout(() => endDrag(), 50);
  };

  return (
    <div
      className="action-item"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={action.description}
      role="listitem"
      aria-label={`Acción: ${action.name}`}
    >
      <span className="action-item-icon">{action.icon}</span>
      <div className="action-item-info">
        <span className="action-item-name">{action.name}</span>
        <span className="action-item-desc">{action.description}</span>
      </div>
    </div>
  );
}
