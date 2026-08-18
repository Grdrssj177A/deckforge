# Arquitectura — DeckForge v2

Documentación técnica interna. Actualizada tras el refactor Core.

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop runtime | Electron 43 |
| Frontend | React 18 + TypeScript 5.5 |
| Build | Vite 7.3.6 |
| Hotkeys | @hurdlegroup/robotjs (nativo) |
| Hardware | serialport (Serial), futuro node-hid (USB HID) |

## Arquitectura

```
React UI (renderer)
  │ IPC
  ▼
DeckForge Core (main process)
  ├── ActionManager     → anti-spam + ejecución centralizada
  ├── PluginManager     → registro, initialize/dispose, execute
  ├── ProfileManager    → persistencia perfiles (JSON en userData)
  ├── SettingsManager   → config global + secretos (safeStorage)
  ├── EventBus          → pub/sub tipado (sucesos del sistema)
  └── DeviceManager     → dispositivos conectados
        ├── ArduinoDevice → SerialTransport
        ├── VirtualDevice → (grid UI)
        └── futuro RP2040Device → USBHIDTransport
```

## Estructura de archivos

```
src/
├── main/
│   ├── index.ts                 # Bootstrap: ventana + registrar IPC + plugins
│   ├── preload.ts               # Bridge tipado renderer ↔ main
│   ├── discord-rpc.ts           # Cliente Discord RPC (named pipe)
│   ├── lib/
│   │   └── logger.ts
│   ├── core/
│   │   ├── index.ts             # Exports singletons
│   │   ├── ActionManager.ts     # Ejecución + cooldown
│   │   ├── PluginManager.ts     # Registro + ciclo de vida plugins
│   │   ├── ProfileManager.ts    # Perfiles + folders + persistencia
│   │   ├── SettingsManager.ts   # Config global + secretos encriptados
│   │   ├── DeviceManager.ts     # Gestión de dispositivos
│   │   ├── EventBus.ts          # Pub/sub tipado
│   │   └── types.ts             # DeckPlugin, ActionContext, ActionState
│   ├── plugins/
│   │   ├── index.ts             # registerAllPlugins()
│   │   ├── hotkey.plugin.ts     # robotjs keyTap
│   │   ├── system.plugin.ts     # volumen, screenshot, URLs, apps
│   │   ├── nanoleaf.plugin.ts   # HTTP REST local
│   │   ├── discord.plugin.ts    # Wrapper sobre discord-rpc.ts
│   │   └── obs.plugin.ts        # Placeholder WebSocket
│   ├── devices/
│   │   ├── DeckDevice.ts        # Interface base
│   │   ├── ArduinoDevice.ts     # Interpreta protocolo BTN:X
│   │   └── VirtualDevice.ts     # Grid UI como dispositivo
│   ├── transports/
│   │   ├── Transport.ts         # Interface base
│   │   └── SerialTransport.ts   # Puerto serie
│   └── ipc/
│       ├── actions.ts           # execute, getState, plugins:list
│       ├── devices.ts           # list, connect, disconnect
│       ├── profiles.ts          # CRUD perfiles, folders, import/export
│       ├── settings.ts          # get, update, migrate
│       ├── dialogs.ts           # File/folder pickers
│       └── discord.ts           # Auto-connect + listeners estado
│
└── renderer/
    ├── App.tsx                  # Providers + rendererReady
    ├── components/              # UI pura
    ├── plugins/                 # Metadata + iconos dinámicos (NO ejecución)
    ├── store/                   # Contexts (leer estado via IPC)
    ├── assets/                  # Icon pack SVG
    ├── lib/                     # Logger renderer
    ├── styles/                  # CSS
    └── types/                   # Tipos del renderer
```

## Flujo de ejecución

```
Click en botón UI
  → PluginContext.executeAction()
  → IPC: actions:execute { pluginId, actionId, config, context }
  → ActionManager.execute() [anti-spam check]
  → PluginManager.execute()
  → Plugin.execute()

Botón físico Arduino
  → SerialTransport recibe "BTN:X"
  → ArduinoDevice.onButtonPress()
  → DeviceManager → EventBus: button:press
  → IPC push: device:buttonPress
  → useSerialButtons → actions:execute
  → ActionManager → Plugin
```

## Reglas de diseño

- **Comandos** → llamadas directas (connect, execute, create)
- **Sucesos** → EventBus (button:press, device:connected)
- **Secretos** → safeStorage de Electron (nunca en renderer)
- **Persistencia** → archivos JSON en userData (no localStorage)
- **Soundboard** → excepción: ejecuta en renderer (Web Audio API)
- **Renderer** → presentación, NO autoridad sobre ejecución ni persistencia
