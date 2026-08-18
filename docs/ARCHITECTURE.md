# Arquitectura — DeckForge

Documentación técnica interna del proyecto.

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop runtime | Electron 31 |
| Frontend | React 18 + TypeScript 5.5 |
| Build | Vite 5 |
| Estado | React Context + localStorage |
| Hardware | Serial (Arduino/RP2040) |

## Estructura de archivos

```
src/
├── main/                        # Electron main process (backend)
│   ├── index.ts                 # Crea ventana + registra IPC handlers
│   ├── preload.ts               # Bridge seguro renderer ↔ main
│   ├── discord-rpc.ts           # Cliente Discord RPC via named pipe
│   ├── lib/
│   │   └── logger.ts            # Logger centralizado (main)
│   └── ipc/                     # Handlers IPC por dominio
│       ├── dialogs.ts           # File/folder pickers
│       ├── system.ts            # Volume, screenshot, lock, open URL/app
│       ├── hotkey.ts            # Simulación de teclas (user32.dll)
│       ├── nanoleaf.ts          # API HTTP local de Nanoleaf
│       ├── serial.ts            # Conexión serial con Arduino/RP2040
│       └── discord.ts           # Discord RPC connect/mute/deaf
│
└── renderer/                    # React frontend
    ├── main.tsx                 # Entry point React
    ├── App.tsx                  # Layout + providers
    ├── components/
    │   ├── Header.tsx           # Perfiles + botón settings
    │   ├── DeckGrid.tsx         # Grid responsive de botones
    │   ├── DeckButton.tsx       # Botón individual (drop target + ejecutar)
    │   ├── ActionPanel.tsx      # Sidebar con acciones arrastrables
    │   ├── ActionItem.tsx       # Acción arrastrable
    │   ├── ConfigModal.tsx      # Modal de configuración de acción
    │   ├── ContextMenu.tsx      # Menú contextual (click derecho)
    │   ├── ErrorBoundary.tsx    # Captura errores de rendering
    │   ├── InfoModal.tsx        # Modal informativo (token copiable)
    │   ├── SerialPanel.tsx      # Panel conexión Arduino
    │   └── SettingsModal.tsx    # Configuración global
    ├── plugins/
    │   ├── index.ts             # Registry de plugins
    │   ├── soundboard.ts        # Reproducir audio (Web Audio API)
    │   ├── hotkey.ts            # Atajos de teclado
    │   ├── obs.ts               # Control OBS (placeholder WebSocket)
    │   ├── discord.ts           # Mute/deafen via RPC + iconos dinámicos
    │   ├── nanoleaf.ts          # Control paneles Nanoleaf
    │   └── system.ts            # URLs, apps, capturas, volumen, carpetas
    ├── store/
    │   ├── DragContext.tsx       # Estado de drag & drop (con ref sincrónico)
    │   ├── PluginContext.tsx     # Registry + ejecución con anti-spam per-button
    │   ├── ProfileContext.tsx    # Perfiles + páginas/folders + navegación
    │   ├── SettingsContext.tsx   # Config global (Nanoleaf, OBS, Discord, grid)
    │   ├── NotificationContext.tsx # Modales informativos
    │   ├── persistence.ts       # localStorage con validación de schema
    │   └── useSerialButtons.ts  # Hook: botones físicos → ejecutar acciones
    ├── assets/
    │   └── iconPack.ts          # Pack de iconos SVG integrados
    ├── lib/
    │   └── logger.ts            # Logger centralizado (renderer)
    ├── styles/
    │   ├── global.css           # Variables CSS, reset, scrollbar
    │   └── app.css              # Layout + componentes
    └── types/
        └── index.ts             # Tipos compartidos del renderer
```

## Comunicación IPC (Frontend ↔ Backend)

```
Renderer (React)                    Main (Electron/Node)
─────────────────                   ────────────────────
window.deckforge.system.*    ──►    ipc/system.ts
window.deckforge.hotkey.*    ──►    ipc/hotkey.ts
window.deckforge.nanoleaf.*  ──►    ipc/nanoleaf.ts
window.deckforge.serial.*    ──►    ipc/serial.ts
window.deckforge.discord.*   ──►    ipc/discord.ts
window.deckforge.sound.*     ──►    ipc/dialogs.ts

                             ◄──    serial:buttonPress (push event)
                             ◄──    serial:status (push event)
                             ◄──    discord:voiceState (push event)
                             ◄──    discord:status (push event)
```

- `invoke` = request/response (renderer pide, main responde)
- `send` = push (main envía sin que renderer lo pida)
- `preload.ts` es el bridge: expone API tipada sin acceso a Node

## Sistema de plugins

Cada plugin implementa la interfaz `Plugin`:

```typescript
interface Plugin {
  id: PluginId;
  name: string;
  icon: string;
  actions: Action[];
  execute: (action: Action) => Promise<void>;
  getDynamicIcon?: (action: Action) => string | undefined;
}
```

| Plugin | Ejecución | Backend necesario |
|--------|-----------|-------------------|
| Soundboard | Web Audio API en renderer | — |
| Hotkeys | IPC → PowerShell temp file + user32.dll | ipc/hotkey.ts |
| OBS | Placeholder (futuro: obs-websocket-js) | — |
| Discord | IPC → Named pipe RPC | ipc/discord.ts + discord-rpc.ts |
| Nanoleaf | IPC → HTTP REST local | ipc/nanoleaf.ts |
| System | IPC → shell/PowerShell | ipc/system.ts |

## Ejecución de acciones

- Concurrencia: botones diferentes se ejecutan en paralelo
- Anti-spam: per-button cooldown de 200ms tras ejecutar
- El DeckButton usa `isActionBusy(actionId)` en vez de flag global
- Errores se capturan y muestran feedback rojo sin crashear la app (ErrorBoundary)

## Iconos dinámicos

Los plugins pueden implementar `getDynamicIcon(action)` para devolver un icono SVG diferente según estado:
- Discord: micrófono verde ↔ micrófono rojo tachado (según mute)
- Soundboard: play ↔ stop (según si está sonando, modo toggle)

El DeckGrid escucha eventos custom (`deckforge:discordState`, `deckforge:soundState`) para forzar re-render de iconos.

## Persistencia

- Perfiles: `localStorage['deckforge_profiles']` — validado al cargar (schema check)
- Settings: `localStorage['deckforge_plugin_settings']` — merge profundo con defaults
- Discord token: `%APPDATA%/deckforge/discord_token.txt`
- En caso de datos corruptos: se resetea a defaults automáticamente

## Hardware (Arduino / futuro RP2040)

Protocolo actual: serial 9600 baud, Arduino envía `BTN:X\n`.
El renderer escucha via `useSerialButtons` → mapea a la página actual → ejecuta acción.

Futuro: RP2040 con USB HID bidireccional + pantallas LCD per button.

## Desarrollo

```bash
npm install
npm run dev              # Solo frontend (Vite)
npm run electron:dev     # Electron + Vite + watch
npm run build            # Build producción
npm run package          # Crear ejecutable
```
