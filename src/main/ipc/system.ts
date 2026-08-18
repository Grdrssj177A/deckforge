import { ipcMain, shell, app, desktopCapturer, screen } from 'electron';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export function registerSystemHandlers(): void {
  ipcMain.handle('system:openUrl', async (_event, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle('system:openApp', async (_event, appPath: string) => {
    try {
      const errorMsg = await shell.openPath(appPath);
      if (errorMsg) return { success: false, error: errorMsg };
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('system:volumeUp', async (_event, step: number = 10) => {
    try {
      const presses = Math.max(1, Math.ceil(step / 2));
      await execAsync(`powershell -NoProfile -Command "$wshell = New-Object -ComObject WScript.Shell; 1..${presses} | ForEach-Object { $wshell.SendKeys([char]175) }"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('system:volumeDown', async (_event, step: number = 10) => {
    try {
      const presses = Math.max(1, Math.ceil(step / 2));
      await execAsync(`powershell -NoProfile -Command "$wshell = New-Object -ComObject WScript.Shell; 1..${presses} | ForEach-Object { $wshell.SendKeys([char]174) }"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('system:volumeMute', async () => {
    try {
      await execAsync(`powershell -NoProfile -Command "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys([char]173)"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('system:lockScreen', async () => {
    try {
      await execAsync('rundll32.exe user32.dll,LockWorkStation');
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('system:screenshot', async (_event, options: { savePath?: string; format?: string; captureMode?: string }) => {
    try {
      const { savePath, format = 'png', captureMode = 'fullscreen' } = options || {};
      let destFolder = savePath || join(app.getPath('desktop'), 'DeckForge Screenshots');

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
        } else {
          const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $s = [System.Windows.Forms.Screen]::PrimaryScreen; $b = New-Object System.Drawing.Bitmap($s.Bounds.Width, $s.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($s.Bounds.Location, [System.Drawing.Point]::Empty, $s.Bounds.Size); $b.Save('${filePath.replace(/\\/g, '\\\\')}'); $g.Dispose(); $b.Dispose()`;
          await execAsync(`powershell -NoProfile -Command "${script}"`);
        }
      }

      shell.showItemInFolder(filePath);
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
