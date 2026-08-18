# Arquitectura — DeckForge v2

Documentación técnica interna. Actualizada tras el refactor Core y el endurecimiento de seguridad.

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop runtime | Electron 43 (contextIsolation + sandbox + CSP) |
| Frontend | React 18 + TypeScript 5.5 |
| Build | Vite 7.3.6 |
| Hotkeys y teclas multimedia | @hurdlegroup/robotjs (nativo) |
| Hardware | serialport (Serial), futuro node-hid (USB HID) |
| Secretos | safeStorage de Electron |

## Arquitectura

```
React UI (renderer)  ── sandbox + CSP, sin acceso a Node
  │ IPC (contrato único en src/shared/types/api.ts)
  ▼
Validación (lib/validate.ts)   ← nada llega al Core sin pasar por aquí
  │
  ▼
DeckForge Core (main process)
  ├── ActionManager     → anti-spam per-button + ejecución centralizada
  ├── PluginManager     → registro, initialize/dispose, execute
  ├── ProfileManager    → persistencia perfiles (JSON atómico en userData)
  ├── SettingsManager   → config global + secretos (safeStorage)
  ├── SessionManager    → perfil/página activos por dispositivo
  ├── TrustStore        → rutas autorizadas a ejecutarse (Open App)
  ├── EventBus          → pub/sub tipado (sucesos del sistema)
  └── DeviceManager     → dispositivos conectados
        ├── ArduinoDevice → SerialTransport
        ├── VirtualDevice → (grid UI)
        └── futuro RP2040Device → USBHIDTransport
```

---

## Límite de confianza

Esta es la sección más importante del documento. El renderer tiene acceso, vía IPC,
a operaciones que ejecutan programas y escriben en disco. Por tanto **nada de lo que
entra en el main se considera fiable**, ni siquiera lo que envía nuestra propia UI.

Fuentes no confiables:

| Origen | Por qué | Puerta de entrada |
|--------|---------|-------------------|
| IPC del renderer | Un XSS o un bug convierte la UI en ejecutor de comandos | `sanitizeActionConfig`, `toContext`, `requireId` en `ipc/actions.ts` |
| Perfiles importados (JSON) | Son archivos de terceros; sus acciones acaban ejecutándose | `sanitizeProfile` / `sanitizeAction` en `ProfileManager` |
| `settings.json` / `profiles.json` | Editables a mano | Saneado tolerante al cargar (descarta el campo, no el archivo) |
| Dispositivo serie | Hardware externo puede emitir cualquier trama | Rango de índice en `ArduinoDevice.handleData` |
| Named pipe de Discord | En Windows cualquier proceso local puede ocuparlo antes que Discord | Límite de trama (1 MB) en `discord-rpc.ts` |

Reglas que se derivan:

- **URLs**: `shell.openExternal` solo acepta `http:` y `https:`. Nunca `file:` ni esquemas
  custom, que se abrirían como programa.
- **Rutas ejecutables**: `Open App` exige que la ruta esté en el `TrustStore`. Las rutas
  elegidas en el diálogo nativo se autorizan solas; cualquier otra (típicamente, la de un
  perfil importado) pide confirmación explícita una vez, mostrando la ruta completa.
- **Nunca construir líneas de comandos**. Se usa `execFile` con array de argumentos, o
  APIs nativas. `system.plugin.ts` no contiene un solo `exec` con interpolación.
- **Credenciales**: los plugins las leen del `SettingsManager`, no de la config de la
  acción. Si vinieran en la config, el renderer podría apuntar una petición a cualquier host.
- **IPs de dispositivos**: solo rangos de red local (`validateLocalHost`).
- **Secretos**: nunca salen del main en claro. Al renderer se le envía `SECRET_MASK`
  (`••••••••`), y un update que devuelva esa máscara significa "no cambiar" — no
  "guardar estos ocho puntos".

### Endurecimiento del renderer

En `index.ts` (`hardenWebContents`):

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`
- `setWindowOpenHandler` deniega todo; los enlaces http/https se delegan al navegador
- `will-navigate` solo permite el propio origen (dev server o el `index.html` del bundle)
- `will-attach-webview` bloqueado
- Permisos denegados salvo `media` (lo necesita el selector de dispositivos de audio)
- DevTools solo si `!app.isPackaged`

La CSP se inyecta en `index.html` **solo en build** (plugin `deckforge-csp` en
`vite.config.mts`): el dev server de Vite necesita scripts y estilos inline que una
política estricta bloquearía. Permite `style-src 'unsafe-inline'` (la UI usa
`style={{...}}`), `img-src data:` (iconos) y `media-src file:` (soundboard).

---

## Estructura de archivos

```
src/
├── shared/                      # Tipos compartidos main ↔ renderer
│   └── types/
│       ├── index.ts
│       ├── api.ts               # Contrato del preload (fuente única de verdad)
│       ├── actions.ts           # ActionConfig, ActionContext, ActionState
│       ├── profiles.ts          # Action, ButtonSlot, Page, Profile, MAX_BUTTONS
│       ├── plugins.ts           # DeckPlugin, PluginId
│       └── devices.ts           # DeviceInfo, DeviceButtonEvent, ButtonFeedbackStatus
│
├── main/
│   ├── index.ts                 # Bootstrap + hardening + shutdown ordenado
│   ├── preload.ts               # Implementa DeckForgeAPI (solo require('electron'))
│   ├── discord-rpc.ts           # Cliente Discord RPC (named pipe)
│   ├── lib/
│   │   ├── logger.ts
│   │   ├── validate.ts          # Validadores + saneado de acciones/perfiles
│   │   └── robot.ts             # Carga única y memoizada de robotjs
│   ├── core/
│   │   ├── index.ts             # Exports singletons
│   │   ├── ActionManager.ts     # Ejecución + cooldown + CooldownError
│   │   ├── PluginManager.ts     # Registro + ciclo de vida plugins
│   │   ├── ProfileManager.ts    # Perfiles + folders + persistencia atómica
│   │   ├── SettingsManager.ts   # Config global + secretos encriptados
│   │   ├── SessionManager.ts    # Perfil/página activos por dispositivo
│   │   ├── DeviceManager.ts     # Gestión de dispositivos
│   │   ├── TrustStore.ts        # Allowlist persistida de rutas ejecutables
│   │   ├── EventBus.ts          # Pub/sub tipado
│   │   └── types.ts             # Reexport de shared para el main
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
│   │   └── SerialTransport.ts   # Puerto serie (con timeout y cierre ordenado)
│   └── ipc/
│       ├── actions.ts           # execute, getState, plugins:list
│       ├── devices.ts           # list, connect, disconnect
│       ├── profiles.ts          # CRUD, folders, import/export en bloque
│       ├── settings.ts          # get, update, migrate, nanoleaf:pair
│       ├── dialogs.ts           # File/folder pickers (+ marcan trust)
│       └── discord.ts           # ensureConnected + toggle + listeners
│
└── renderer/
    ├── App.tsx                  # Providers + rendererReady
    ├── components/              # UI pura
    ├── plugins/                 # Metadata + iconos dinámicos (NO ejecución)
    ├── store/                   # Contexts (leer estado via IPC)
    ├── assets/                  # Icon pack SVG
    ├── lib/                     # Logger renderer
    ├── styles/                  # CSS
    └── types/                   # Reexporta shared + tipos propios del renderer
```

> `renderer/types/index.ts` **reexporta** los tipos de `src/shared`. Antes los
> redefinía, y las dos copias podían divergir sin que el compilador dijera nada.

---

## Flujo de ejecución

```
Click en botón UI
  → DeckButton construye su ExecuteTarget { position, pageId, profileId }
  → PluginContext.executeAction(action, target)
  → IPC: actions:execute
  → validación (requireId + sanitizeActionConfig + toContext)
  → ActionManager.execute() [anti-spam por device:perfil:página:botón]
  → PluginManager.execute()
  → Plugin.execute()

Botón físico Arduino
  → SerialTransport recibe "BTN:X"
  → ArduinoDevice valida el rango del índice
  → DeviceManager → EventBus: button:press
  → SessionManager resuelve perfil/página/slot y ejecuta
  → IPC push: device:buttonFeedback { buttonId, status }
  → useSerialButtons → animación en el grid
```

### Anti-spam

La clave de cooldown es `deviceId:profileId:pageId:buttonId`. Es importante que el
renderer envíe los cuatro valores reales: cuando mandaba `buttonId: 0` fijo, todos los
botones de la UI compartían la clave `virtual::root:0` y se bloqueaban entre sí.

`ActionManager` distingue dos estados: `inFlight` (ejecutándose) y `cooldownUntil`
(200 ms tras terminar). El rechazo se señaliza con `CooldownError`, no con un
`Error('cooldown')` comparado por mensaje.

El único cooldown que queda en el renderer es el del **soundboard**, porque es el
único plugin que no cruza el IPC.

---

## Contratos

### Respuestas IPC

Toda operación que puede fallar devuelve `Result`:

```ts
interface Result { success: boolean; error?: string }
```

Los handlers **no** devuelven `success: true` a ciegas. `ProfileManager` expone
`MutationResult` y los handlers lo traducen:

```ts
type MutationResult = { ok: true } | { ok: false; error: string }
```

Esto cubre tres fallos que antes eran indistinguibles del éxito: perfil/página
inexistente, posición fuera de rango y error de escritura en disco.
El renderer los muestra vía `NotificationContext` (por eso `NotificationProvider`
envuelve a `ProfileProvider`).

### Persistencia

`ProfileManager.save()` escribe a `profiles.json.tmp` y hace `rename`. Si el proceso
muere a mitad, el archivo anterior queda intacto en vez de truncado.

El import de perfiles es una sola operación (`profiles:importProfiles`): valida, remapea
ids de carpeta y guarda una vez. Antes el renderer reconstruía el perfil botón a botón,
con una IPC y una reescritura completa del archivo **por cada botón**.

---

## Ciclo de vida

```
app.whenReady()
  1. registerAllPlugins()        # registerDiscordHandlers necesita el plugin 'discord'
  2. register*Handlers()         # antes de crear la ventana: el renderer invoca al cargar
  3. createWindow()
  4. await pluginManager.initializeAll()

app.on('before-quit')
  → deviceManager.disconnectAll()
  → pluginManager.disposeAll()
  → app.quit()
```

El orden de 2 y 3 importa: si la ventana carga antes de que existan los handlers, los
primeros `invoke` se rechazan con "No handler registered" y la UI se queda en blanco.

---

## Reglas de diseño

- **Comandos** → llamadas directas (connect, execute, create)
- **Sucesos** → EventBus (button:press, device:connected)
- **Validar en el borde** → nada entra al Core sin pasar por `lib/validate.ts`
- **Nunca construir líneas de comandos** → `execFile` con array, o API nativa
- **Secretos** → safeStorage; al renderer solo la máscara
- **Persistencia** → archivos JSON en userData, escritura atómica (no localStorage)
- **Errores** → se propagan al usuario; un fallo silencioso es un bug
- **Tipos** → una sola definición en `src/shared`, reexportada
- **Soundboard** → excepción: ejecuta en renderer (Web Audio API)
- **Renderer** → presentación, NO autoridad sobre ejecución ni persistencia

---

## Deuda conocida

| Tema | Estado |
|------|--------|
| Los clicks de la UI no pasan por `VirtualDevice`/`SessionManager` | Los bugs derivados están corregidos, pero siguen existiendo dos rutas de ejecución. Converger requiere pruebas manuales de GUI. |
| Soundboard bajo el dev server | Usa URLs `file:///`, que el origen `http://localhost:5173` bloquea. Funciona en el build empaquetado. Arreglo real: protocolo custom o servir los bytes por IPC. |
| `ProfileContext.refresh()` | Reconsulta todos los perfiles tras cada mutación. Correcto pero grueso. |
| `captureMode: 'window'` | No captura una ventana, captura la pantalla completa (el script anterior tampoco lo hacía). Falta una forma fiable de identificar la ventana en primer plano. |
| Sin tests automatizados | No hay framework configurado. La verificación es compilación + `docs/TEST-PLAN-*.md` manual. |
