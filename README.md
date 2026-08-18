<div align="center">

# ⚡ DeckForge

### Tu stream deck, tus reglas.

Stream deck open-source y personalizable. Controla Discord, OBS, Nanoleaf, audio y más desde una interfaz drag & drop — con soporte para hardware físico custom.

[![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

<!-- Screenshots aquí cuando estén disponibles -->
<!-- <img src="docs/screenshots/main.png" width="800" alt="DeckForge UI"> -->

</div>

## 🎯 Para quién es

- **Streamers** que quieren un deck custom sin pagar €150 por un Stream Deck
- **Productores** que necesitan soundboard + control de DAW
- **Power users** que quieren automatizar tareas con un botón
- **Makers** que quieren construir su propio hardware con RP2040

---

## 🔌 Plugins

<table>
<tr>
<td align="center" width="150">

**💬 Discord**

Mute/deaf directo via RPC. Iconos en tiempo real.

</td>
<td align="center" width="150">

**💡 Nanoleaf**

On/off, color, brillo, efectos. API local.

</td>
<td align="center" width="150">

**🔊 Soundboard**

Audio con trim, overlap/toggle, volumen.

</td>
</tr>
<tr>
<td align="center" width="150">

**⌨️ Hotkeys**

Cualquier atajo de teclado global.

</td>
<td align="center" width="150">

**🎬 OBS Studio**

Stream, record, escenas.

</td>
<td align="center" width="150">

**🖥️ Sistema**

URLs, apps, screenshots, volumen, lock.

</td>
</tr>
</table>

---

## ✨ Features

| | Feature | Detalle |
|---|---------|---------|
| 🎛️ | **Grid flexible** | 2×2 hasta 6×6, configurable |
| 📁 | **Carpetas** | Sub-páginas anidadas para organizar |
| 🎨 | **Personalización** | Iconos SVG/PNG, colores, animaciones, indicadores |
| 🔄 | **Iconos dinámicos** | Cambian según estado (mute, playing...) |
| 👆 | **Drag & drop** | Arrastra acciones al grid, mueve botones entre slots |
| 💾 | **Perfiles** | Múltiples perfiles con cambio rápido, export/import |
| 🎛️ | **Hardware** | Conecta tu deck físico (Arduino/RP2040) |
| ⚡ | **Concurrente** | Pulsa varios botones a la vez sin bloqueos |
| 🔒 | **Seguro por defecto** | Sandbox, CSP, validación de todo lo que entra |
| 🌙 | **Dark mode** | Tema oscuro nativo |

---

## 🔒 Seguridad

DeckForge ejecuta programas, simula teclas y escribe archivos. Eso lo convierte en un
objetivo interesante, así que el proyecto trata **todo lo que entra como no fiable**:
la propia UI, los perfiles que importas y el hardware conectado.

| | Qué hace |
|---|---|
| 🧱 | **Renderer aislado** — `contextIsolation` + `sandbox`, sin acceso a Node, con CSP en la app empaquetada |
| 🚫 | **Navegación cerrada** — no se abren ventanas ni se navega fuera de la app; los enlaces van a tu navegador |
| ✅ | **Validación en el borde** — URLs solo `http`/`https`, IPs solo de red local, rangos y formatos comprobados |
| 🛡️ | **Sin líneas de comandos** — nunca se interpola texto en una shell; se usan argumentos separados y APIs nativas |
| 🔑 | **Permiso para ejecutar** — abrir una aplicación pide tu confirmación la primera vez, mostrando la ruta completa |
| 🔐 | **Secretos cifrados** — tokens y contraseñas en `safeStorage` del sistema; el renderer solo ve `••••••••` |

### Sobre los perfiles compartidos

Un archivo de perfil es JSON de otra persona, y sus botones pueden apuntar a programas
de tu disco. Al importar, DeckForge sanea el archivo y descarta lo que no reconoce; y la
primera vez que pulses un botón que abre una aplicación que tú no has elegido a mano,
te pedirá confirmación mostrando la ruta. **Revísala antes de aceptar.**

---

## 🛠️ Hardware

<table>
<tr>
<td width="50%">

### Ahora (prototipo)

Arduino Mega + 4 botones físicos.
Protocolo serial simple.
Para testear la comunicación app ↔ hardware.

</td>
<td width="50%">

### Futuro

PCB custom con **RP2040**.
Pantalla LCD por botón (como Stream Deck).
Protocolo USB HID bidireccional.
100% open source.

</td>
</tr>
</table>

---

## 🚀 Quick Start

```bash
# Clonar
git clone https://github.com/Grdrssj177A/deckforge
cd deckforge

# Instalar
npm install

# Desarrollo (Electron + Vite hot reload)
npm run electron:dev

# Build producción
npm run build

# Empaquetar
npm run electron:build
```

> **Requisitos**: Node 18+ y Windows — el RPC de Discord usa named pipes de Windows y
> `Lock Screen` llama a `user32.dll`. El resto de acciones ya son multiplataforma.
>
> Las hotkeys y el volumen usan `@hurdlegroup/robotjs`, un módulo nativo: si no compila,
> la app arranca igual y solo esas acciones quedan deshabilitadas.

> **Nota de desarrollo**: el soundboard reproduce rutas locales (`file://`), que el dev
> server bloquea por origen. Para probarlo, usa el build empaquetado.

---

## 📖 Docs

| Documento | Contenido |
|-----------|-----------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Estructura interna, límite de confianza, IPC, plugins, cómo contribuir |
| [TODO.md](docs/TODO.md) | Tareas pendientes y estado del roadmap técnico |
| [TEST-PLAN-CORE-REFACTOR.md](docs/TEST-PLAN-CORE-REFACTOR.md) | Checklist de pruebas manuales (no hay tests automatizados aún) |

---

## 📋 Roadmap

- [x] Grid configurable con drag & drop
- [x] 6 plugins funcionales
- [x] Carpetas/sub-páginas
- [x] Discord RPC directo
- [x] Hardware serial (Arduino)
- [x] Iconos dinámicos + pack SVG
- [x] Export/import de perfiles
- [x] Endurecimiento de seguridad (sandbox, CSP, validación, secretos cifrados)
- [ ] Tests automatizados
- [ ] OBS WebSocket completo
- [ ] Temas personalizables
- [ ] Firmware RP2040 + pantallas LCD
- [ ] Multi-acción (secuencia de comandos)

---

<div align="center">

**MIT License** · Hecho con ⚡ por ti

</div>
