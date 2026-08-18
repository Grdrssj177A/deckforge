import { useState } from 'react';
import { usePlugins } from '@/store/PluginContext';
import { ActionItem } from './ActionItem';

export function ActionPanel() {
  const { plugins } = usePlugins();
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(plugins[0]?.id || null);

  const togglePlugin = (id: string) => {
    setExpandedPlugin((prev) => (prev === id ? null : id));
  };

  return (
    <aside className="action-panel" aria-label="Panel de acciones">
      <h2 className="action-panel-title">Acciones</h2>
      <p className="action-panel-hint">Arrastra acciones a los botones</p>

      <div className="action-panel-list" role="list">
        {plugins.map((plugin) => (
          <div key={plugin.id} className="plugin-group">
            <button
              className={`plugin-group-header ${expandedPlugin === plugin.id ? 'expanded' : ''}`}
              onClick={() => togglePlugin(plugin.id)}
              aria-expanded={expandedPlugin === plugin.id}
              aria-controls={`plugin-actions-${plugin.id}`}
            >
              <span className="plugin-group-icon">{plugin.icon}</span>
              <span className="plugin-group-name">{plugin.name}</span>
              <span className="plugin-group-chevron">
                {expandedPlugin === plugin.id ? '▾' : '▸'}
              </span>
            </button>

            {expandedPlugin === plugin.id && (
              <div
                className="plugin-group-actions"
                id={`plugin-actions-${plugin.id}`}
                role="list"
              >
                {plugin.actions.map((action) => (
                  <ActionItem key={action.id} action={action} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
