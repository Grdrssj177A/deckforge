import React, { useState } from 'react';
import { useProfiles } from '@/store/ProfileContext';
import { SettingsModal } from './SettingsModal';

export function Header() {
  const { profiles, activeProfile, createProfile, deleteProfile, renameProfile, switchProfile } =
    useProfiles();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showSettings, setShowSettings] = useState(false);

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
                onClick={() => switchProfile(profile.id)}
                onDoubleClick={() => {
                  const name = prompt('Renombrar perfil:', profile.name);
                  if (name?.trim()) renameProfile(profile.id, name.trim());
                }}
                title={`Doble click para renombrar`}
              >
                {profile.name}
                {profiles.length > 1 && (
                  <span
                    className="profile-tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`¿Eliminar perfil "${profile.name}"?`)) {
                        deleteProfile(profile.id);
                      }
                    }}
                    role="button"
                    aria-label={`Eliminar perfil ${profile.name}`}
                  >
                    ×
                  </span>
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
                onBlur={() => setIsCreating(false)}
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
