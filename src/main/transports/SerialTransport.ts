import { Transport, TransportConfig, TransportEvents, TransportInfo } from './Transport';
import { createLogger } from '../lib/logger';

const log = createLogger('SerialTransport');

/** Si el puerto no abre en este tiempo, se aborta en vez de esperar para siempre. */
const CONNECT_TIMEOUT_MS = 5000;

/**
 * Transporte Serial para Arduino/CH340/FTDI.
 * Sabe cómo abrir un puerto serie y leer líneas.
 * NO sabe qué significan los datos (eso es responsabilidad del Device).
 */
export class SerialTransport implements Transport {
  readonly type = 'serial';
  private port: any = null;
  private parser: any = null;
  private listeners: TransportEvents | null = null;
  private connecting = false;

  isConnected(): boolean {
    return this.port?.isOpen ?? false;
  }

  setListeners(listeners: TransportEvents): void {
    this.listeners = listeners;
  }

  async connect(config: TransportConfig): Promise<void> {
    if (!config.path) throw new Error('Serial path required');
    if (this.connecting) throw new Error('Ya hay una conexión en curso');
    if (this.isConnected()) {
      // Sin esto, un segundo connect() encadenaba otro parser y cada línea se
      // entregaba dos veces.
      throw new Error('El transporte ya está conectado');
    }

    const { SerialPort } = await import('serialport');
    const { ReadlineParser } = await import('@serialport/parser-readline');

    this.connecting = true;

    return new Promise<void>((resolve, reject) => {
      // Una única resolución: tras abrir, un error posterior es un evento de
      // runtime (onError), no un fallo de conexión.
      let settled = false;
      let timer: NodeJS.Timeout | null = null;

      const finish = (err?: Error) => {
        if (settled) return false;
        settled = true;
        this.connecting = false;
        if (timer) { clearTimeout(timer); timer = null; }
        if (err) reject(err); else resolve();
        return true;
      };

      const port = new SerialPort({
        path: config.path!,
        baudRate: config.baudRate || 9600,
        autoOpen: true,
      });
      this.port = port;

      timer = setTimeout(() => {
        if (settled) return;
        log.error(`Timeout opening ${config.path}`);
        this.teardown();
        finish(new Error(`Tiempo de espera agotado al abrir ${config.path}`));
      }, CONNECT_TIMEOUT_MS);

      port.on('open', () => {
        this.parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
        this.parser.on('data', (line: string) => {
          this.listeners?.onData(String(line).trim());
        });
        log.info(`Port open: ${config.path}`);
        finish();
      });

      port.on('error', (err: Error) => {
        log.error(`Port error: ${err.message}`);
        if (settled) {
          // Ya conectado: es un fallo en caliente, se notifica al device.
          this.listeners?.onError(err);
        } else {
          this.teardown();
          finish(err);
        }
      });

      port.on('close', () => {
        this.listeners?.onClose();
      });
    });
  }

  /** Quita listeners y descarta el puerto sin propagar más eventos. */
  private teardown(): void {
    const port = this.port;
    this.port = null;
    if (this.parser) {
      try { this.parser.removeAllListeners(); } catch { /* ignore */ }
      this.parser = null;
    }
    if (!port) return;
    try { port.removeAllListeners(); } catch { /* ignore */ }
    try { if (port.isOpen) port.close(() => { /* ignore */ }); else port.destroy?.(); } catch { /* ignore */ }
  }

  async disconnect(): Promise<void> {
    const port = this.port;
    if (!port) return;

    // Se espera el cierre real antes de soltar la referencia, y los errores de
    // cierre se registran en vez de quedar sin manejar.
    await new Promise<void>((resolve) => {
      if (!port.isOpen) { resolve(); return; }
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      // Red de seguridad: si el driver no llama al callback, no bloquear el cierre.
      const timer = setTimeout(finish, 2000);
      try {
        port.close((err?: Error | null) => {
          clearTimeout(timer);
          if (err) log.error(`Error closing port: ${err.message}`);
          finish();
        });
      } catch (e) {
        clearTimeout(timer);
        log.error('Error closing port:', e);
        finish();
      }
    });

    this.teardown();
  }

  async send(data: Buffer | string): Promise<void> {
    if (!this.port?.isOpen) return;
    const buf = typeof data === 'string' ? Buffer.from(data + '\n') : data;
    this.port.write(buf);
  }

  /**
   * Lista los puertos serie disponibles en el sistema.
   */
  static async listPorts(): Promise<TransportInfo[]> {
    const { SerialPort } = await import('serialport');
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,
      type: 'serial',
      manufacturer: p.manufacturer || '',
      friendlyName: (p as any).friendlyName || p.path,
    }));
  }
}
