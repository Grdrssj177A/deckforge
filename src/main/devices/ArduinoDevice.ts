import { DeckDevice, DeviceInfo } from './DeckDevice';
import { SerialTransport } from '../transports/SerialTransport';
import { TransportConfig } from '../transports/Transport';
import { createLogger } from '../lib/logger';

const log = createLogger('ArduinoDevice');

/**
 * Dispositivo Arduino (prototipo actual).
 * Sabe interpretar el protocolo "BTN:X" del Arduino.
 * Usa SerialTransport para la comunicación física.
 */
export class ArduinoDevice implements DeckDevice {
  readonly id: string;
  readonly name: string;
  private transport: SerialTransport;
  private config: TransportConfig;

  onButtonPress: ((buttonId: number) => void) | null = null;
  onButtonRelease: ((buttonId: number) => void) | null = null;

  constructor(id: string, name: string, config: TransportConfig) {
    this.id = id;
    this.name = name;
    this.transport = new SerialTransport();
    this.config = config;

    this.transport.setListeners({
      onData: (line) => this.handleData(line),
      onError: (err) => log.error(`Device error: ${err.message}`),
      onClose: () => log.info(`Device disconnected: ${this.name}`),
    });
  }

  async connect(): Promise<void> {
    await this.transport.connect(this.config);
    log.info(`Connected: ${this.name} on ${this.config.path}`);
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
    log.info(`Disconnected: ${this.name}`);
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  getInfo(): DeviceInfo {
    return {
      id: this.id,
      name: this.name,
      type: 'arduino',
      buttonCount: 4, // Prototipo tiene 4 botones
      hasDisplays: false,
      hasLeds: false,
    };
  }

  /**
   * Interpreta los datos del Arduino.
   * Protocolo: "BTN:X" donde X es el índice del botón (0-based).
   */
  private handleData(line: string): void {
    if (line.startsWith('BTN:')) {
      const buttonId = parseInt(line.slice(4), 10);
      if (!isNaN(buttonId)) {
        this.onButtonPress?.(buttonId);
      }
    } else if (line === 'DECKFORGE:READY') {
      log.info('Arduino ready');
    }
  }
}
