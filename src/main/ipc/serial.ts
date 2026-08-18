import { ipcMain, BrowserWindow } from 'electron';

let serialPort: any = null;
let serialConnected = false;
let serialPortPath = '';

export function registerSerialHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('serial:listPorts', async () => {
    try {
      const { SerialPort } = await import('serialport');
      const ports = await SerialPort.list();
      return {
        success: true,
        ports: ports.map((p) => ({
          path: p.path,
          manufacturer: p.manufacturer || '',
          vendorId: p.vendorId || '',
          productId: p.productId || '',
          friendlyName: (p as any).friendlyName || p.path,
        })),
      };
    } catch (error) {
      return { success: false, ports: [], error: String(error) };
    }
  });

  ipcMain.handle('serial:connect', async (_event, portPath: string, baudRate: number = 9600) => {
    try {
      if (serialPort?.isOpen) serialPort.close();

      const { SerialPort } = await import('serialport');
      const { ReadlineParser } = await import('@serialport/parser-readline');

      serialPort = new SerialPort({ path: portPath, baudRate });
      serialPortPath = portPath;

      const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
      parser.on('data', (line: string) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('BTN:')) {
          const idx = parseInt(trimmed.slice(4), 10);
          const win = getWindow();
          if (!isNaN(idx) && win) win.webContents.send('serial:buttonPress', idx);
        }
      });

      serialPort.on('close', () => {
        serialConnected = false;
        const win = getWindow();
        if (win) win.webContents.send('serial:status', { connected: false, port: '' });
      });

      serialPort.on('error', (err: Error) => {
        serialConnected = false;
        const win = getWindow();
        if (win) win.webContents.send('serial:status', { connected: false, port: '', error: err.message });
      });

      serialConnected = true;
      const win = getWindow();
      if (win) win.webContents.send('serial:status', { connected: true, port: portPath });
      return { success: true, port: portPath };
    } catch (error) {
      serialConnected = false;
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('serial:disconnect', async () => {
    try {
      if (serialPort?.isOpen) serialPort.close();
      serialPort = null;
      serialConnected = false;
      serialPortPath = '';
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('serial:getStatus', async () => ({ connected: serialConnected, port: serialPortPath }));
}
