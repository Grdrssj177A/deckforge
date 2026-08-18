# Plan de pruebas — Refactor Core (PluginManager + ActionManager)

Después de cada paso del refactor, testear los puntos marcados.

---

## Paso A: PluginManager (plugins migrados al main)

### Funcionalidad básica
- [ ] La app arranca sin errores
- [ ] El sidebar de acciones muestra los 6 plugins con sus acciones
- [ ] Se pueden arrastrar acciones al grid
- [ ] El ConfigModal se abre y permite configurar acciones

### Hotkeys
- [ ] Asignar un hotkey (ej: Ctrl+C) a un botón y ejecutar → se simula la tecla
- [ ] El delay configurable funciona (poner 500ms y verificar que espera)

### Discord
- [ ] Auto-connect al arrancar (icono cambia al estado real)
- [ ] Toggle Mute desde DeckForge → Discord se mutea
- [ ] Mutearse desde Discord → icono cambia instantáneamente en DeckForge
- [ ] Toggle Deafen funciona igual

### Nanoleaf
- [ ] Toggle Power → enciende/apaga
- [ ] Brightness Up/Down → cambia brillo
- [ ] Set Color → cambia color
- [ ] Set Effect → aplica efecto
- [ ] Los settings globales (IP/Token) se usan correctamente

### Sistema
- [ ] Open URL → abre navegador
- [ ] Volume Up/Down/Mute → cambia volumen
- [ ] Screenshot → guarda archivo y abre carpeta
- [ ] Lock Screen → bloquea (cuidado al testear)
- [ ] Open App → abre aplicación

### OBS
- [ ] El plugin se registra sin error (aunque sea placeholder)

### Soundboard (se queda en renderer)
- [ ] Play Sound → suena
- [ ] Stop All → para
- [ ] Modo toggle → funciona (pulsar para play, pulsar para stop)
- [ ] Trim (start/end time) → suena solo el fragmento
- [ ] Icono dinámico cambia cuando suena

### Carpetas
- [ ] Crear carpeta → funciona
- [ ] Entrar en carpeta → muestra sub-página
- [ ] Botón "Volver" → vuelve a root
- [ ] Acciones dentro de carpetas se ejecutan correctamente

### Arduino/Dispositivos
- [ ] Conectar Arduino → funciona
- [ ] Pulsar botón físico → ejecuta acción del grid
- [ ] Feedback visual en la app al pulsar botón físico
- [ ] Botón físico en carpeta → ejecuta acción de la sub-página
- [ ] Botón 0 en carpeta → vuelve a root

### Perfiles
- [ ] Cambiar de perfil → grid cambia
- [ ] Crear perfil → funciona
- [ ] Eliminar perfil → funciona
- [ ] Duplicar perfil → funciona
- [ ] Exportar/Importar → funciona
- [ ] Renombrar perfil → funciona

### Anti-spam
- [ ] Pulsar el mismo botón muy rápido → solo se ejecuta una vez (cooldown 200ms)
- [ ] Pulsar dos botones diferentes rápido → ambos se ejecutan

### Iconos dinámicos
- [ ] Discord mute → icono cambia
- [ ] Soundboard toggle → icono cambia cuando suena
- [ ] Al terminar un audio → icono vuelve al normal

### Persistencia
- [ ] Cerrar y reabrir la app → todo se mantiene (perfiles, acciones, carpetas)
- [ ] Configuración global (Nanoleaf IP, Discord secret) se mantiene
- [ ] Token de Discord encriptado se usa al reconectar

---

## Paso B: ActionManager (si se hace en la misma sesión)

### Ejecución centralizada
- [ ] Click en botón UI → acción se ejecuta
- [ ] Botón físico → acción se ejecuta
- [ ] ActionContext contiene deviceId, pageId, buttonId, profileId
- [ ] Anti-spam funciona desde el ActionManager (no desde el renderer)

---

## Cosas que NO deberían romperse (regresiones)

- [ ] Drag & drop de acciones del sidebar al grid
- [ ] Drag & drop para mover botones entre slots (no se puede, solo desde modo mover — verificar que no hay conflicto)
- [ ] Click derecho → context menu funciona
- [ ] Configuración global (⚙️) se abre y guarda
- [ ] Grid se ajusta al tamaño de ventana
- [ ] Grid variable (cambiar cols/rows en settings)
- [ ] El modal de configuración no se cierra al seleccionar texto

---

## Notas

- Si algo falla, anotar qué paso lo rompió para poder revertir parcialmente
- Los plugins de main se testean uno a uno (primero hotkey que es el más simple)
- Soundboard siempre se testea último (es el que se queda en renderer y puede tener edge cases)
