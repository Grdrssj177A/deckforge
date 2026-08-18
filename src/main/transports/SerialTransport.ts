import { Transport, TransportConfig, TransportEvents, TransportInfo } from './Transport';
import { createLogger } from '../lib/logger';

const log = createLogger('SerialTransport');

/**
 * Transporte Serial para Arduino/CH340/FTDI.
 * Sabe cómo abrir un puerto serie y leer líneas.
 * NO sabe qué significan los datos (eso es responsabilidad del Device).
 */
export class SerialTransport implements Transport {
  readonly type = 'serial';
  private port: any = null;
  private listeners: TransportEvents | null = null;

  isConnected(): boolean {
    return this.port?.isOpen ?? false;
  }

  setListeners(listeners: TransportEvents): void {
    this.listeners = listeners;
  }

  async connect(config: TransportConfig): Promise<void> {
    if (!config.path) throw new Error('Serial path required');

    const { SerialPort } = await import('serialport');
    const { ReadlineParser } = await import('@serialport/parser-readline');

    return new Promise<void>((resolve, reject) => {
      this.port = new SerialPort({
        path: config.path!,
        baudRate: config.baudRate || 9600,
      });

      this.port.on('open', () => {
        const parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
        parser.on('data', (line: string) => {
          this.listeners?.onData(line.trim());
        });
        resolve();
      });

      this.port.on('error', (err: Error) => {
        log.error(`Port error: ${err.message}`);
        this.listeners?.onError(err);
        reject(err);
      });

      this.port.on('close', () => {
        this.listeners?.onClose();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.port?.isOpen) {
      this.port.close();
    }
    this.port = null;
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
