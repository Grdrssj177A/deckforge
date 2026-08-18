# DeckForge — Tareas pendientes

Última actualización: 2026-08-18

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
| 8 | Testing (persistence + plugins) | **Alta** | Pendiente — sigue sin framework |
| 9 | ~~Separar useSerialButtons: lectura vs transporte~~ | Media | ✅ |
| 10 | ~~Preload genérico (devices + actions + profiles)~~ | Media | ✅ |

---

## Auditoría de seguridad y robustez (pasada completa)

Todo lo de esta tabla está implementado. Detalle del modelo de amenazas en
[ARCHITECTURE.md → Límite de confianza](ARCHITECTURE.md#límite-de-confianza).

### Crítico

| # | Problema | Estado |
|---|----------|--------|
| C1 | ~~`openUrl`/`openApp` ejecutaban rutas y esquemas arbitrarios desde la config~~ | ✅ Esquemas http/https + TrustStore con confirmación |
| C2 | ~~Inyección de comandos en el screenshot (`savePath`/`format` interpolados en PowerShell)~~ | ✅ Sin `exec`; `desktopCapturer` + `execFile` |
| C3 | ~~Sin CSP, sin bloqueo de navegación, sin sandbox explícito~~ | ✅ CSP en build, `will-navigate`, `setWindowOpenHandler`, permisos cerrados |
| C4 | ~~Un perfil importado inyectaba acciones sin validar~~ | ✅ `sanitizeProfile`/`sanitizeAction` en todas las entradas |

### Mayor

| # | Problema | Estado |
|---|----------|--------|
| M1 | ~~Guardar la config global sobrescribía los secretos con la máscara `••••••••`~~ | ✅ La máscara significa "no cambiar" |
| M2 | ~~Todos los botones de la UI compartían la clave de cooldown (`buttonId: 0` fijo)~~ | ✅ Se envía position/pageId/profileId reales |
| M3 | ~~Tras cambiar de perfil, el Arduino seguía ejecutando el perfil anterior~~ | ✅ `syncProfile()` conectado a setActive/delete/migrate |
| M4 | ~~`'cooldown'` como mensaje de error comparado en 4 sitios~~ | ✅ `CooldownError` + `isCooldownError()` |
| M5 | ~~Los handlers de perfiles devolvían `success: true` a ciegas~~ | ✅ `MutationResult` propagado y mostrado al usuario |
| M6 | ~~`settings:update` aceptaba cualquier sección y cualquier valor~~ | ✅ Whitelist de secciones + validación por campo |
| M7 | ~~El parser del pipe de Discord crecía sin límite~~ | ✅ Tope de trama de 1 MB |
| M8 | ~~Fugas de socket y de listener `_ready` en los 10 intentos de conexión~~ | ✅ `detach()` en todas las salidas; timeout 5 s → 1,5 s |
| M9 | ~~`SerialTransport.connect` podía colgarse para siempre; doble parser al reconectar~~ | ✅ Timeout, latch, guard de doble conexión, cierre esperado |
| M10 | ~~Un arrastre re-renderizaba los 36 botones~~ | ✅ DragContext dividido + `memo` + valores de contexto memoizados |
| M11 | ~~Cada toggle de Discord: 3 viajes RPC + `sleep(100)`, duplicado 4 veces~~ | ✅ `ensureConnected()` + `toggle()` compartidos |
| M12 | ~~Los handlers IPC se registraban después de cargar la ventana (UI en blanco)~~ | ✅ Handlers antes de `createWindow()` |
| M13 | ~~Nada se liberaba al cerrar (puertos serie, socket RPC)~~ | ✅ `before-quit` → `disconnectAll` + `disposeAll` |
| M14 | ~~`button:press` podía producir un unhandled rejection~~ | ✅ try/catch + guard de ventana destruida |
| M15 | ~~SSRF en Nanoleaf: IP y token venían de la config de la acción~~ | ✅ Solo desde SettingsManager, IP de red local, token codificado |
| M16 | ~~Import de perfiles: una IPC y una reescritura completa por botón~~ | ✅ `profiles:importProfiles` en una sola operación |
| M17 | ~~Escritura de perfiles no atómica (riesgo de archivo truncado)~~ | ✅ `.tmp` + `rename` |

### Menor

| # | Problema | Estado |
|---|----------|--------|
| m1 | ~~El selector de "Open App" filtraba solo archivos de audio~~ | ✅ `fileKind: 'app'` con filtros de ejecutable |
| m2 | ~~El preload descartaba el `status` de la pulsación física~~ | ✅ Se reenvía el evento completo |
| m3 | ~~`require('robotjs')` síncrono en cada pulsación~~ | ✅ `lib/robot.ts` memoizado + precarga |
| m4 | ~~`window.location.reload()` como mecanismo de refresco~~ | ✅ `refresh()` del contexto |
| m5 | ~~Tipos duplicados entre renderer y shared (podían divergir)~~ | ✅ `src/shared` como fuente única |
| m6 | ~~Formato `bmp` de screenshot escribía archivos corruptos~~ | ✅ Retirado (png/jpg) |
| m7 | ~~Índice de botón del Arduino sin validar~~ | ✅ Rango comprobado contra `MAX_BUTTONS` |

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
| 4 | ~~Connect Discord + Pair Nanoleaf: añadir botones en Settings~~ | ✅ |
| 5 | Selector de tiempo soundboard: visualizador de onda | Pendiente |
| 6 | Iconos del pack: mejorar diseño + más variedad | Pendiente |
| 7 | Grid 3x2: botones se solapan en ventana pequeña | Pendiente (CSS) |
| 8 | ~~Export: modal con checkboxes multi-selección~~ | ✅ |
| 9 | ~~Import: importar + popup renombrar~~ | ✅ |

---

## Deuda técnica abierta

| # | Tema | Notas |
|---|------|-------|
| D1 | Los clicks de la UI no pasan por `VirtualDevice`/`SessionManager` | Siguen existiendo dos rutas de ejecución. Los bugs que causaba (M2, M3) están corregidos, pero converger es lo correcto. Requiere pruebas manuales de GUI, por eso quedó fuera de la pasada de seguridad. |
| D2 | Soundboard no suena bajo el dev server | Usa URLs `file:///` y el origen `http://localhost:5173` las bloquea. Funciona empaquetado. Arreglo real: protocolo custom o servir los bytes por IPC. |
| D3 | `ProfileContext.refresh()` reconsulta todos los perfiles | Correcto pero grueso; con muchos perfiles conviene refrescar solo el afectado. |
| D4 | `captureMode: 'window'` captura la pantalla completa | El PowerShell anterior tampoco capturaba una ventana. Falta identificar la ventana en primer plano de forma fiable. |
| D5 | Sin tests automatizados | Ver #8. Hoy la verificación es compilación + build + checklist manual. |

---

## Arquitectura actual

```
React UI (renderer)   ── sandbox + CSP
  │ IPC (contrato en src/shared/types/api.ts)
  ▼
Validación (lib/validate.ts)
  ▼
DeckForge Core (main process)
  ├── PluginManager  → hotkey, system, nanoleaf, discord, obs
  ├── ActionManager  → anti-spam per-button + ejecución centralizada
  ├── SessionManager → perfil/página activos por dispositivo
  ├── ProfileManager → persistencia atómica en userData
  ├── SettingsManager→ config + secretos (safeStorage)
  ├── TrustStore     → rutas autorizadas a ejecutarse
  ├── EventBus       → sucesos
  └── DeviceManager  → ArduinoDevice / VirtualDevice
        └── SerialTransport
```

- React = presentación (sidebar, grid, config, drag & drop)
- Core = lógica (ejecución, plugins, perfiles, hardware)
- Validación = frontera de confianza, obligatoria
- Plugins = integraciones encapsuladas
- Devices/Transports = hardware abstracto

---

## Orden recomendado siguiente

1. **Tests automatizados** (#8) — es lo único que falta para poder tocar el Core con red
2. OBS WebSocket real (#6)
3. Converger los clicks de la UI en `VirtualDevice` (D1)
4. Fix grid overlap (CSS, #7)
5. Sidebar con iconos del pack por categoría (#2)
6. Temas, sonido de click, waveform

---

## Notas técnicas

- **Terminal Kiro**: usa PS5 internamente, workaround: `pwsh -NoProfile -Command "..."`
- **Vite**: v7.3.6 — la CSP se inyecta solo en `build` (plugin `deckforge-csp`)
- **Hotkeys y volumen**: `@hurdlegroup/robotjs` (nativo, cargado una sola vez en `lib/robot.ts`)
- **Electron**: v43 con contextIsolation + sandbox + preload tipado desde `src/shared`
- **Persistencia**: `ProfileManager` guarda en `%APPDATA%/deckforge/profiles.json` (escritura atómica)
- **Settings**: `SettingsManager` en `%APPDATA%/deckforge/settings.json`; los secretos en `secrets.enc` (safeStorage). Ya **no** viven en localStorage
- **Rutas autorizadas**: `%APPDATA%/deckforge/trusted-paths.json`
- **Discord**: suscripción push VOICE_SETTINGS_UPDATE + auto-connect al arrancar via rendererReady
- **Soundboard**: única excepción que se ejecuta en renderer (Web Audio API)
- **Verificación**: `npm run build` cubre tsc del renderer, bundle de Vite y tsc del main
