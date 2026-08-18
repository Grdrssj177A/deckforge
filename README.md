<div align="center">

# ⚡ DeckForge

### Tu stream deck, tus reglas.

Stream deck open-source y personalizable. Controla Discord, OBS, Nanoleaf, audio y más desde una interfaz drag & drop — con soporte para hardware físico custom.

[![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
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
| 💾 | **Perfiles** | Múltiples perfiles con cambio rápido |
| 🎛️ | **Hardware** | Conecta tu deck físico (Arduino/RP2040) |
| ⚡ | **Concurrente** | Pulsa varios botones a la vez sin bloqueos |
| 🌙 | **Dark mode** | Tema oscuro nativo |

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
git clone https://github.com/tu-usuario/deckforge
cd deckforge

# Instalar
npm install

# Desarrollo (Electron + Vite hot reload)
npm run electron:dev

# Build producción
npm run build
```

---

## 📖 Docs

| Documento | Contenido |
|-----------|-----------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Estructura interna, IPC, plugins, cómo contribuir |

---

## 📋 Roadmap

- [x] Grid configurable con drag & drop
- [x] 6 plugins funcionales
- [x] Carpetas/sub-páginas
- [x] Discord RPC directo
- [x] Hardware serial (Arduino)
- [x] Iconos dinámicos + pack SVG
- [ ] OBS WebSocket completo
- [ ] Export/import perfiles
- [ ] Temas personalizables
- [ ] Firmware RP2040 + pantallas LCD
- [ ] Multi-acción (secuencia de comandos)

---

<div align="center">

**MIT License** · Hecho con ⚡ por ti

</div>
