import { app, shell, desktopCapturer, screen } from 'electron';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { DeckPlugin, ActionDefinition, ActionConfig, ActionContext } from '../core/types';
import { createLogger } from '../lib/logger';

const execAsync = promisify(exec);
const log = createLogger('SystemPlugin');

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

  async execute(actionId: string, config: ActionConfig, context: ActionContext): Promise<void> {
    const command = config.command as string || actionId;

    switch (command) {
      case 'openUrl': {
        const url = config.url as string;
        if (!url) throw new Error('URL no configurada');
        await shell.openExternal(url);
        break;
      }
      case 'openApp': {
        const appPath = config.path as string;
        if (!appPath) throw new Error('Ruta no configurada');
        const err = await shell.openPath(appPath);
        if (err) throw new Error(err);
        break;
      }
      case 'volumeUp': {
        const step = Math.max(1, Math.ceil((config.step as number || 10) / 2));
        await execAsync(`powershell -NoProfile -Command "$wshell = New-Object -ComObject WScript.Shell; 1..${step} | ForEach-Object { $wshell.SendKeys([char]175) }"`);
        break;
      }
      case 'volumeDown': {
        const step = Math.max(1, Math.ceil((config.step as number || 10) / 2));
        await execAsync(`powershell -NoProfile -Command "$wshell = New-Object -ComObject WScript.Shell; 1..${step} | ForEach-Object { $wshell.SendKeys([char]174) }"`);
        break;
      }
      case 'volumeMute': {
        await execAsync(`powershell -NoProfile -Command "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys([char]173)"`);
        break;
      }
      case 'lockScreen': {
        await execAsync('rundll32.exe user32.dll,LockWorkStation');
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
        throw new Error(`Comando desconocido: ${command}`);
    }
  }

  private async takeScreenshot(config: ActionConfig): Promise<void> {
    const format = (config.format as string) || 'png';
    const captureMode = (config.captureMode as string) || 'fullscreen';
    let destFolder = (config.savePath as string) || join(app.getPath('desktop'), 'DeckForge Screenshots');

    if (!existsSync(destFolder)) await mkdir(destFolder, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filePath = join(destFolder, `screenshot-${timestamp}.${format}`);

    if (captureMode === 'window') {
      const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $s = [System.Windows.Forms.Screen]::PrimaryScreen; $b = New-Object System.Drawing.Bitmap($s.Bounds.Width, $s.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($s.Bounds.Location, [System.Drawing.Point]::Empty, $s.Bounds.Size); $b.Save('${filePath.replace(/\\/g, '\\\\')}'); $g.Dispose(); $b.Dispose()`;
      await execAsync(`powershell -NoProfile -Command "${script}"`);
    } else {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: screen.getPrimaryDisplay().workAreaSize });
      if (sources.length > 0) {
        const thumb = sources[0].thumbnail;
        const buffer = format === 'jpg' ? thumb.toJPEG(90) : format === 'bmp' ? thumb.toBitmap() : thumb.toPNG();
        await writeFile(filePath, buffer);
      }
    }
    shell.showItemInFolder(filePath);
  }
}
