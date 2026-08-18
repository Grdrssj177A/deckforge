import React, { useState } from 'react';
import { useProfiles } from '@/store/ProfileContext';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { SettingsModal } from './SettingsModal';

export function Header() {
  const { profiles, activeProfile, createProfile, deleteProfile, renameProfile, switchProfile } =
    useProfiles();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profileId: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = () => {
    if (newName.trim()) {
      createProfile(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') setIsCreating(false);
  };

  const handleProfileContext = (e: React.MouseEvent, profileId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, profileId });
  };

  const handleDuplicate = async (profileId: string) => {
    if (!window.deckforge) return;
    await window.deckforge.profiles.duplicate(profileId);
    window.location.reload();
  };

  const handleRename = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    setRenamingId(profileId);
    setRenameValue(profile.name);
  };

  const handleRenameConfirm = () => {
    if (renamingId && renameValue.trim()) {
      renameProfile(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameConfirm();
    if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
  };

  const handleExport = async (profileId: string) => {
    if (!window.deckforge) return;
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    const data = JSON.stringify(profile, null, 2);
    await window.deckforge.profiles.export(data);
  };

  const buildContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const profileId = contextMenu.profileId;
    return [
      { label: 'Duplicar', icon: '📋', action: () => handleDuplicate(profileId) },
      { label: 'Renombrar', icon: '✏️', action: () => handleRename(profileId) },
      { label: 'Exportar', icon: '📤', action: () => handleExport(profileId) },
      { label: 'Eliminar', icon: '🗑️', action: () => deleteProfile(profileId), danger: true, disabled: profiles.length <= 1 },
    ];
  };

  return (
    <>
      <header className="header">
        <div className="header-brand">
          <h1 className="header-title">⚡ DeckForge</h1>
        </div>

        <nav className="header-profiles" aria-label="Perfiles">
          <div className="profile-tabs">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                className={`profile-tab ${profile.id === activeProfile.id ? 'active' : ''}`}
                onClick={() => { if (!renamingId) switchProfile(profile.id); }}
                onContextMenu={(e) => handleProfileContext(e, profile.id)}
                title="Click derecho: opciones"
              >
                {renamingId === profile.id ? (
                  <input
                    type="text"
                    className="profile-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={handleRenameConfirm}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    {profile.name}
                    {profiles.length > 1 && (
                      <span
                        className="profile-tab-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProfile(profile.id);
                        }}
                        role="button"
                        aria-label={`Eliminar perfil ${profile.name}`}
                      >
                        ×
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>

          {isCreating ? (
            <div className="profile-create-input">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setIsCreating(false), 150)}
                placeholder="Nombre del perfil..."
                autoFocus
                aria-label="Nombre del nuevo perfil"
              />
            </div>
          ) : (
            <button
              className="profile-add-btn"
              onClick={() => setIsCreating(true)}
              aria-label="Crear nuevo perfil"
            >
              +
            </button>
          )}
        </nav>

        <button
          className="header-settings-btn"
          onClick={() => setShowSettings(true)}
          title="Configuración global de plugins"
          aria-label="Configuración global"
        >
          ⚙️
        </button>
      </header>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
