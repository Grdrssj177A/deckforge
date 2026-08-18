# Plan de pruebas — Refactor Core + endurecimiento

Después de cada paso, testear los puntos marcados.

No hay tests automatizados (ver TODO #8), así que este checklist **es** la suite de
regresión del proyecto. `npm run build` solo garantiza que compila y empaqueta.

- **Pasos A y B**: refactor Core (PluginManager + ActionManager). Completado.
- **Paso C**: pasada de seguridad y robustez. Sin verificar en GUI todavía.

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
- [ ] Pulsar dos botones diferentes rápido → **ambos se ejecutan** (esto estaba roto: todos
      los botones de la UI compartían la clave de cooldown)
- [ ] Mismo slot en dos dispositivos distintos (virtual + Arduino) → cooldowns independientes

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

## Paso C: endurecimiento de seguridad y robustez

Cambios de comportamiento visibles al usuario, más las rutas de fallo que antes eran
silenciosas. Ver [ARCHITECTURE.md → Límite de confianza](ARCHITECTURE.md#límite-de-confianza).

### Arranque y cierre
- [ ] La app arranca y el grid aparece (los handlers IPC se registran antes de la ventana)
- [ ] Con el build empaquetado, DevTools **no** se abre solo
- [ ] Cerrar la app con un Arduino conectado → el puerto se libera (se puede reconectar
      desde otra app sin reiniciar)
- [ ] Si `robotjs` no compila: la app arranca igual y solo fallan hotkeys/volumen

### Secretos (regresión importante)
- [ ] Configurar token de Nanoleaf → guardar → reabrir Settings: se ve `••••••••`
- [ ] Pulsar **Guardar** sin tocar nada → las acciones de Nanoleaf siguen funcionando
      (antes esto sobrescribía el token con la máscara y las rompía)
- [ ] Igual con la contraseña de OBS y el client secret de Discord
- [ ] Borrar el campo del token y guardar → el secreto se borra de verdad

### Validación de entrada
- [ ] `Open URL` con `https://...` → abre el navegador
- [ ] `Open URL` con `file:///C:/Windows/System32/cmd.exe` → **rechazado** con mensaje
- [ ] `Open URL` vacía o mal formada → mensaje de error claro, no un fallo silencioso
- [ ] Nanoleaf con IP pública (ej. `8.8.8.8`) → rechazada al guardar
- [ ] Nanoleaf con IP de LAN (`192.168.x.x`) → aceptada
- [ ] Grid: no se pueden guardar valores fuera de 2..6

### Ejecutar aplicaciones (nuevo flujo)
- [ ] `Open App` eligiendo el ejecutable con **Explorar** → abre sin preguntar nada
- [ ] El diálogo de `Open App` muestra ejecutables, no solo archivos de audio
- [ ] Editar la ruta a mano / importar un perfil ajeno → al pulsar, aparece un diálogo
      nativo con la ruta completa
- [ ] Cancelar ese diálogo → no se ejecuta nada, el botón marca error
- [ ] Aceptar → se ejecuta, y la **segunda** vez ya no pregunta
- [ ] Reiniciar la app → sigue sin preguntar (persistido en `trusted-paths.json`)

### Screenshot
- [ ] Formato PNG y JPG → archivo válido, se abre la carpeta
- [ ] Carpeta destino vacía → va al Escritorio
- [ ] Con carpeta destino personalizada → se crea si no existe
- [ ] La captura no está recortada por la barra de tareas y se ve nítida en pantallas HiDPI
- [ ] Modo "Ventana activa" → captura pantalla completa (limitación conocida, no un fallo)

### Perfiles: errores visibles
- [ ] Importar un JSON válido → los perfiles aparecen y se ofrece renombrarlos
- [ ] Importar un JSON corrupto o que no sea de DeckForge → mensaje de error, sin perfiles basura
- [ ] Importar un perfil con carpetas → las carpetas y sus acciones se conservan
- [ ] Importar es rápido (una sola escritura, no una por botón)
- [ ] Duplicar/renombrar/importar **no** recarga la ventana ni resetea la vista
- [ ] Con `profiles.json` en solo-lectura: al asignar una acción aparece un aviso de error
      (antes se decía "guardado" y se perdía el cambio)

### Perfil activo y hardware
- [ ] Cambiar de perfil en la UI → el botón físico ejecuta las acciones del **perfil nuevo**
- [ ] Estando dentro de una carpeta, borrarla desde la UI → el botón físico no ejecuta
      acciones equivocadas
- [ ] Feedback visual del botón físico distingue éxito / error / hueco vacío / navegación
      (antes siempre se pintaba "success")

### Dispositivos
- [ ] Conectar a un puerto inexistente u ocupado → error en el panel, sin cuelgue
- [ ] El botón "Conectar" no se queda en "Conectando..." indefinidamente
- [ ] Desconectar y reconectar varias veces → cada pulsación se ejecuta **una** vez
      (no duplicada)
- [ ] Desenchufar el Arduino en caliente → la app avisa y sigue usable

### Discord
- [ ] Auto-connect al arrancar con token guardado
- [ ] Toggle Mute responde notablemente más rápido (antes había 100 ms artificiales)
- [ ] Mutearse desde Discord → el icono cambia al instante
- [ ] Con Discord cerrado: pulsar el botón da "Discord no conectado" y la app no se congela
      (el barrido de pipes tarda ~15 s como máximo, no 50 s)
- [ ] Pulsar Conectar dos veces rápido → no se abren dos sesiones

### Renderer aislado
- [ ] En el build empaquetado, la UI se ve y funciona igual (la CSP no rompe estilos ni iconos)
- [ ] Los iconos subidos por el usuario (data: URL) se siguen mostrando
- [ ] El selector de dispositivo de audio del soundboard sigue listando salidas
- [ ] Soundboard: **no** funciona con `npm run electron:dev` (limitación conocida, D2);
      probarlo con el build empaquetado

### Rendimiento de la UI
- [ ] Arrastrar una acción sobre el grid va fluido con grid 6×6
- [ ] Un audio en modo toggle sonando no hace parpadear el resto de botones

---

## Cosas que NO deberían romperse (regresiones)

- [ ] Drag & drop de acciones del sidebar al grid
- [ ] Drag & drop para mover botones entre slots
- [ ] Todos los slots se marcan como destino mientras arrastras
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
- El paso C se probó solo con compilación y build; **nada de su checklist está verificado en GUI**
