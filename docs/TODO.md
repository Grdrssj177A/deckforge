# DeckForge — Tareas pendientes

Última actualización: 2026-08-19

---

## Arquitectura (de los PDFs de revisión)

| # | Tarea | Prioridad | Estado |
|---|-------|-----------|--------|
| 1 | ~~Hotkeys: migrar de PowerShell a nativo (robotjs)~~ | Alta | ✅ |
| 2 | ~~Bug README: tu-usuario → Grdrssj177A~~ | Baja | ✅ |
| 3 | ~~Hardware abstraction (DeckDevice, ArduinoDevice, VirtualDevice, Transport)~~ | Alta | ✅ |
| 4 | ~~Core + EventBus + PluginManager + ActionManager + ProfileManager~~ | Alta | ✅ |
| 5 | ~~Token Discord: usar safeStorage en vez de .txt~~ | Media | ✅ |
| 6 | OBS WebSocket real (obs-websocket-js) | Media | Pendiente |
| 7 | GIF/capturas en README | Baja | Pendiente |
| 8 | Testing (persistence + plugins) | Baja | Pendiente |
| 9 | ~~Separar useSerialButtons: lectura vs transporte~~ | Media | ✅ |
| 10 | ~~Preload genérico (devices + actions + profiles)~~ | Media | ✅ |

---

## Features pendientes (lista original)

| # | Feature | Estado |
|---|---------|--------|
| 11 | OBS: toggle stream/record con icono dinámico | Pendiente (necesita #6) |
| 14 | OBS: replay buffer | Pendiente (necesita #6) |
| 37 | ~~Export/import perfiles (JSON)~~ | ✅ |
| 38 | Temas personalizables | Pendiente |
| 39 | Sonido de click (feedback audio) | Pendiente |

---

## Bugs / UX pendientes

| # | Problema | Estado |
|---|----------|--------|
| 1 | ~~Iconos dinámicos Discord: polling~~ → reemplazado por suscripción RPC push | ✅ |
| 2 | Sidebar acciones: poner iconos del pack en categorías | Pendiente |
| 3 | Salida de audio: mover de config individual a global | Pendiente |
| 4 | Connect Discord + Pair Nanoleaf: añadir botones en Settings | Pendiente |
| 5 | Selector de tiempo soundboard: visualizador de onda | Pendiente |
| 6 | Iconos del pack: mejorar diseño + más variedad | Pendiente |
| 7 | Grid 3x2: botones se solapan en ventana pequeña | Pendiente (CSS) |
| 8 | Export: modal con checkboxes multi-selección | ✅ (implementado) |
| 9 | Import: importar + popup renombrar | ✅ (implementado) |

---

## Arquitectura actual (post-refactor)

```
React UI (renderer)
  │ IPC
  ▼
DeckForge Core (main process)
  ├── PluginManager → plugins/hotkey, system, nanoleaf, discord, obs
  ├── ActionManager (ipc/actions.ts) → anti-spam + ejecución centralizada
  ├── ProfileManager → persistencia en archivo JSON (userData)
  ├── EventBus → pub/sub tipado para sucesos
  └── DeviceManager → ArduinoDevice / VirtualDevice
        └── SerialTransport
```

- React = presentación (sidebar, grid, config, drag & drop)
- Core = lógica (ejecución, plugins, perfiles, hardware)
- Plugins = integraciones encapsuladas
- Devices = hardware abstracto
- Transports = conexión física
- EventBus = sucesos

---

## Orden recomendado siguiente

1. OBS WebSocket real
2. Sidebar con iconos del pack por categoría
3. Fix grid overlap (CSS)
4. Temas, sonido click, waveform
5. Testing

---

## Notas técnicas

- **Terminal Kiro**: usa PS5 internamente, workaround: `pwsh -NoProfile -Command "..."`
- **Vite**: v7.3.6
- **Hotkeys**: `@hurdlegroup/robotjs` (nativo, cross-platform)
- **Electron**: v43 con contextIsolation + preload tipado
- **Persistencia**: ProfileManager guarda en `%APPDATA%/deckforge/profiles.json`
- **Settings**: siguen en localStorage (renderer) por ahora
- **Discord**: suscripción push VOICE_SETTINGS_UPDATE + auto-connect al arrancar via rendererReady
- **Soundboard**: única excepción que se ejecuta en renderer (Web Audio API)
