import { ipcMain } from 'electron';
import * as http from 'http';

function nanoleafRequest(ip: string, method: string, path: string, body?: object): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
    if (bodyStr) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    }

    const req = http.request({ hostname: ip, port: 16021, path, method, headers, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed: any = null;
        try { parsed = data ? JSON.parse(data) : null; } catch { parsed = data; }
        resolve({ status: res.statusCode || 0, data: parsed });
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

export function registerNanoleafHandlers(): void {
  ipcMain.handle('nanoleaf:pair', async (_event, ip: string) => {
    try {
      const { status, data } = await nanoleafRequest(ip, 'POST', '/api/v1/new');
      if (status === 200 && data?.auth_token) return { success: true, token: data.auth_token };
      return { success: false, error: `Status ${status}: ¿Mantuviste el botón pulsado 5-7 segundos?` };
    } catch {
      return { success: false, error: `No se pudo conectar a ${ip}:16021` };
    }
  });

  ipcMain.handle('nanoleaf:execute', async (_event, ip: string, token: string, command: string, params: any) => {
    const basePath = `/api/v1/${token}`;
    try {
      switch (command) {
        case 'togglePower': {
          let currentOn = false;
          try {
            const r = await nanoleafRequest(ip, 'GET', `${basePath}/state/on`);
            if (r.status === 200 && r.data) {
              currentOn = !!(r.data.on?.value ?? r.data.value);
            }
          } catch { currentOn = true; }
          await nanoleafRequest(ip, 'PUT', `${basePath}/state`, { on: { value: !currentOn } });
          return { success: true };
        }
        case 'setColor': {
          const hex = (params.color || '#ff6600').replace('#', '');
          const r = parseInt(hex.slice(0, 2), 16) / 255;
          const g = parseInt(hex.slice(2, 4), 16) / 255;
          const b = parseInt(hex.slice(4, 6), 16) / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b), diff = max - min;
          let h = 0, s = 0;
          const v = max;
          if (diff > 0) {
            s = diff / max;
            if (max === r) h = ((g - b) / diff) % 6;
            else if (max === g) h = (b - r) / diff + 2;
            else h = (r - g) / diff + 4;
            h = Math.round(h * 60);
            if (h < 0) h += 360;
          }
          await nanoleafRequest(ip, 'PUT', `${basePath}/state`, {
            on: { value: true }, hue: { value: h }, sat: { value: Math.round(s * 100) }, brightness: { value: Math.round(v * 100) },
          });
          return { success: true };
        }
        case 'setEffect': {
          await nanoleafRequest(ip, 'PUT', `${basePath}/effects`, { select: params.effect || 'Flames' });
          return { success: true };
        }
        case 'brightnessUp': case 'brightnessDown': {
          const step = Number(params.step) || 20;
          let cur = 50;
          try {
            const r = await nanoleafRequest(ip, 'GET', `${basePath}/state/brightness`);
            cur = Number(r.data?.brightness?.value ?? r.data?.value ?? 50);
          } catch { /* default */ }
          const val = command === 'brightnessUp' ? Math.min(100, cur + step) : Math.max(1, cur - step);
          await nanoleafRequest(ip, 'PUT', `${basePath}/state`, { brightness: { value: val, duration: 0 } });
          return { success: true };
        }
        default: return { success: false, error: `Comando desconocido: ${command}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('nanoleaf:getEffects', async (_event, ip: string, token: string) => {
    try {
      const { data } = await nanoleafRequest(ip, 'GET', `/api/v1/${token}/effects/effectsList`);
      return { success: true, effects: data || [] };
    } catch (error) { return { success: false, error: String(error) }; }
  });
}
