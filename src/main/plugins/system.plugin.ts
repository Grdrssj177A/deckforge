import { app, shell, desktopCapturer, screen, BrowserWindow } from 'electron';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { DeckPlugin, ActionDefinition, ActionConfig, ActionContext } from '../core/types';
import { trustStore } from '../core/TrustStore';
import { createLogger } from '../lib/logger';
import { loadRobot } from '../lib/robot';
import {
  ValidationError,
  validateAbsolutePath,
  validateEnum,
  validateExternalUrl,
  validateInt,
} from '../lib/validate';

const execFileAsync = promisify(execFile);
const log = createLogger('SystemPlugin');

/** Formatos que realmente sabemos serializar (toPNG / toJPEG). */
const SCREENSHOT_FORMATS = ['png', 'jpg'] as const;
const CAPTURE_MODES = ['fullscreen', 'window'] as const;

export class SystemPlugin implements DeckPlugin {
  readonly id = 'system';
  readonly name = 'Sistema';
  readonly icon = '🖥️';
  readonly description = 'Acciones del sistema operativo';

  readonly actions: ActionDefinition[] = [
    { id: 'openUrl', pluginId: 'system', name: 'Open URL', description: 'Abre una URL en el navegador', defaultConfig: { command: 'openUrl', url: '' } },
    { id: 'openApp', pluginId: 'system', name: 'Open App', description: 'Abre una aplicación', defaultConfig: { command: 'openApp', path: '' } },
    { id: 'screenshot', pluginId: 'system', name: 'Screenshot', description: 'Captura de pantalla', defaultConfig: { command: 'screenshot', savePath: '', format: 'png', captureMode: 'fullscreen' } },
    { id: 'lockScreen', pluginId: 'system', name: 'Lock Screen', description: 'Bloquea la pantalla', defaultConfig: { command: 'lockScreen' } },
    { id: 'volumeUp', pluginId: 'system', name: 'Volume Up', description: 'Sube el volumen', defaultConfig: { command: 'volumeUp', step: 10 } },
    { id: 'volumeDown', pluginId: 'system', name: 'Volume Down', description: 'Baja el volumen', defaultConfig: { command: 'volumeDown', step: 10 } },
    { id: 'volumeMute', pluginId: 'system', name: 'Mute', description: 'Silencia/activa el volumen', defaultConfig: { command: 'volumeMute' } },
    { id: 'folder', pluginId: 'system', name: 'Carpeta', description: 'Crea una carpeta con sub-página', defaultConfig: { command: 'folder', folderName: '' } },
  ];

  async initialize(): Promise<void> {}
  async dispose(): Promise<void> {}

  async execute(actionId: string, config: ActionConfig, _context: ActionContext): Promise<void> {
    const command = (config.command as string) || actionId;

    switch (command) {
      case 'openUrl': {
        // Solo http/https: bloquea file: y esquemas custom, que shell.openExternal
        // ejecutaría como programa.
        const url = validateExternalUrl(config.url);
        await shell.openExternal(url);
        break;
      }
      case 'openApp': {
        await this.openApp(config);
        break;
      }
      case 'volumeUp': {
        this.tapVolumeKey('audio_vol_up', config);
        break;
      }
      case 'volumeDown': {
        this.tapVolumeKey('audio_vol_down', config);
        break;
      }
      case 'volumeMute': {
        loadRobot().keyTap('audio_mute');
        break;
      }
      case 'lockScreen': {
        // Argumentos como array: nunca se construye una línea de comandos.
        await execFileAsync('rundll32.exe', ['user32.dll,LockWorkStation']);
        break;
      }
      case 'screenshot': {
        await this.takeScreenshot(config);
        break;
      }
      case 'folder': {
        // No-op: la navegación la gestiona el renderer
        break;
      }
      default:
        throw new ValidationError(`Comando desconocido: ${String(command).slice(0, 40)}`);
    }
  }

  /**
   * Abre una aplicación. La ruta puede venir de un perfil importado, así que se
   * exige autorización explícita del usuario la primera vez (TrustStore).
   */
  private async openApp(config: ActionConfig): Promise<void> {
    const appPath = validateAbsolutePath(config.path, 'Ruta de la aplicación');

    if (!existsSync(appPath)) {
      throw new ValidationError(`La ruta no existe: ${appPath}`);
    }
    if (statSync(appPath).isDirectory()) {
      throw new ValidationError('La ruta apunta a una carpeta, no a una aplicación');
    }

    const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
    const allowed = await trustStore.ensureTrusted(appPath, parent);
    if (!allowed) {
      throw new ValidationError('Ejecución cancelada por el usuario');
    }

    const err = await shell.openPath(appPath);
    if (err) throw new Error(err);
  }

  /**
   * Volumen via robotjs (teclas multimedia). Sustituye al PowerShell anterior,
   * que interpolaba `step` en una línea de comandos.
   */
  private tapVolumeKey(key: string, config: ActionConfig): void {
    const step = validateInt(config.step, 1, 50, 10, 'Paso de volumen');
    // Cada pulsación mueve ~2% en Windows.
    const taps = Math.max(1, Math.ceil(step / 2));
    const robot = loadRobot();
    for (let i = 0; i < taps; i++) robot.keyTap(key);
  }

  private async takeScreenshot(config: ActionConfig): Promise<void> {
    const format = validateEnum(config.format, SCREENSHOT_FORMATS, 'png', 'Formato');
    const captureMode = validateEnum(config.captureMode, CAPTURE_MODES, 'fullscreen', 'Modo de captura');

    const destFolder = config.savePath
      ? validateAbsolutePath(config.savePath, 'Carpeta destino')
      : join(app.getPath('desktop'), 'DeckForge Screenshots');

    if (captureMode === 'window') {
      // El modo "ventana" nunca capturó una ventana: el script anterior copiaba
      // la pantalla primaria completa. Se mantiene ese comportamiento hasta que
      // exista una forma fiable de identificar la ventana en primer plano.
      log.warn('captureMode "window" no está implementado; se captura la pantalla completa');
    }

    if (!existsSync(destFolder)) await mkdir(destFolder, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filePath = join(destFolder, `screenshot-${timestamp}.${format}`);

    const display = screen.getPrimaryDisplay();
    const scale = display.scaleFactor || 1;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * scale),
        height: Math.round(display.size.height * scale),
      },
    });

    if (sources.length === 0) {
      throw new Error('No se pudo capturar la pantalla (sin fuentes disponibles)');
    }

    const thumb = sources[0].thumbnail;
    const buffer = format === 'jpg' ? thumb.toJPEG(90) : thumb.toPNG();
    await writeFile(filePath, buffer);

    log.info(`Screenshot saved: ${filePath}`);
    shell.showItemInFolder(filePath);
  }
}
