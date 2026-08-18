import * as http from 'http';
import { DeckPlugin, ActionDefinition, ActionConfig, ActionContext, ActionState } from '../core/types';
import { settingsManager } from '../core/SettingsManager';
import { createLogger } from '../lib/logger';
import {
  ValidationError,
  validateInt,
  validateLocalHost,
  validateUrlSegment,
} from '../lib/validate';

const log = createLogger('NanoleafPlugin');

/** Respuesta máxima aceptada del panel, para no crecer sin límite. */
const MAX_RESPONSE_BYTES = 256 * 1024;

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
      let aborted = false;
      res.on('data', (chunk) => {
        if (aborted) return;
        data += chunk;
        if (data.length > MAX_RESPONSE_BYTES) {
          aborted = true;
          req.destroy();
          reject(new Error('Respuesta demasiado grande del panel Nanoleaf'));
        }
      });
      res.on('end', () => {
        if (aborted) return;
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

export class NanoleafPlugin implements DeckPlugin {
  readonly id = 'nanoleaf';
  readonly name = 'Nanoleaf';
  readonly icon = '💡';
  readonly description = 'Controla paneles Nanoleaf via API local';

  readonly actions: ActionDefinition[] = [
    { id: 'togglePower', pluginId: 'nanoleaf', name: 'Toggle Power', description: 'Enciende/apaga', defaultConfig: { command: 'togglePower' } },
    { id: 'setColor', pluginId: 'nanoleaf', name: 'Set Color', description: 'Cambia color', defaultConfig: { command: 'setColor', color: '#ff6600' } },
    { id: 'setEffect', pluginId: 'nanoleaf', name: 'Set Effect', description: 'Aplica un efecto', defaultConfig: { command: 'setEffect', effect: 'Flames' } },
    { id: 'brightnessUp', pluginId: 'nanoleaf', name: 'Brightness Up', description: 'Aumenta brillo', defaultConfig: { command: 'brightnessUp', step: 20 } },
    { id: 'brightnessDown', pluginId: 'nanoleaf', name: 'Brightness Down', description: 'Disminuye brillo', defaultConfig: { command: 'brightnessDown', step: 20 } },
  ];

  /**
   * IP y token salen siempre del SettingsManager, nunca de la config de la acción:
   * `_globalIp`/`_globalToken` son inyectables desde el renderer via actions:execute,
   * lo que permitiría apuntar la petición a un host arbitrario (SSRF).
   */
  private getCredentials(): { ip: string; token: string } {
    const nanoleafSettings = settingsManager.get('nanoleaf');
    if (!nanoleafSettings.ip || !nanoleafSettings.token) {
      throw new ValidationError('IP y Token no configurados. Ve a ⚙️ Configuración global > Nanoleaf.');
    }
    return {
      ip: validateLocalHost(nanoleafSettings.ip, 'IP de Nanoleaf'),
      token: validateUrlSegment(nanoleafSettings.token, 'Token de Nanoleaf'),
    };
  }

  async initialize(): Promise<void> {}
  async dispose(): Promise<void> {}

  async execute(actionId: string, config: ActionConfig, context: ActionContext): Promise<void> {
    const { ip, token } = this.getCredentials();
    const basePath = `/api/v1/${encodeURIComponent(token)}`;

    switch (actionId) {
      case 'togglePower': {
        let currentOn = false;
        try {
          const r = await nanoleafRequest(ip, 'GET', `${basePath}/state/on`);
          if (r.status === 200 && r.data) currentOn = !!(r.data.on?.value ?? r.data.value);
        } catch { currentOn = true; }
        await nanoleafRequest(ip, 'PUT', `${basePath}/state`, { on: { value: !currentOn } });
        break;
      }
      case 'setColor': {
        const rawColor = typeof config.color === 'string' && config.color.trim() ? config.color.trim() : '#ff6600';
        if (!/^#?[0-9a-fA-F]{6}$/.test(rawColor)) {
          throw new ValidationError(`Color inválido: "${rawColor.slice(0, 20)}". Formato esperado #rrggbb.`);
        }
        const hex = rawColor.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), diff = max - min;
        let h = 0, s = 0; const v = max;
        if (diff > 0) {
          s = diff / max;
          if (max === r) h = ((g - b) / diff) % 6;
          else if (max === g) h = (b - r) / diff + 2;
          else h = (r - g) / diff + 4;
          h = Math.round(h * 60); if (h < 0) h += 360;
        }
        await nanoleafRequest(ip, 'PUT', `${basePath}/state`, {
          on: { value: true }, hue: { value: h }, sat: { value: Math.round(s * 100) }, brightness: { value: Math.round(v * 100) },
        });
        break;
      }
      case 'setEffect': {
        const effect = typeof config.effect === 'string' && config.effect.trim() ? config.effect.trim() : 'Flames';
        if (effect.length > 128) throw new ValidationError('Nombre de efecto demasiado largo');
        await nanoleafRequest(ip, 'PUT', `${basePath}/effects`, { select: effect });
        break;
      }
      case 'brightnessUp': case 'brightnessDown': {
        const step = validateInt(config.step, 1, 100, 20, 'Incremento de brillo');
        let cur = 50;
        try {
          const r = await nanoleafRequest(ip, 'GET', `${basePath}/state/brightness`);
          cur = Number(r.data?.brightness?.value ?? r.data?.value ?? 50);
        } catch {}
        const val = actionId === 'brightnessUp' ? Math.min(100, cur + step) : Math.max(1, cur - step);
        await nanoleafRequest(ip, 'PUT', `${basePath}/state`, { brightness: { value: val, duration: 0 } });
        break;
      }
    }
  }

  async getState(actionId: string, config: ActionConfig): Promise<ActionState | null> {
    // Futuro: leer estado de on/off para icono dinámico
    return null;
  }
}
