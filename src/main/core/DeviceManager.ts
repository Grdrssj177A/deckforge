import { DeckDevice, DeviceInfo } from '../devices/DeckDevice';
import { EventBus, eventBus } from './EventBus';
import { SerialTransport } from '../transports/SerialTransport';
import { TransportInfo } from '../transports/Transport';
import { ArduinoDevice } from '../devices/ArduinoDevice';
import { VirtualDevice } from '../devices/VirtualDevice';
import { createLogger } from '../lib/logger';

const log = createLogger('DeviceManager');

/**
 * DeviceManager: punto de entrada para gestionar dispositivos.
 * 
 * - Comandos: llamadas directas (connect, disconnect, list)
 * - Sucesos: emitidos via EventBus (button:press, device:connected, etc.)
 */
export class DeviceManager {
  private devices = new Map<string, DeckDevice>();
  private bus: EventBus;
  private virtualDevice: VirtualDevice;

  constructor(bus: EventBus) {
    this.bus = bus;

    // Virtual device siempre existe
    this.virtualDevice = new VirtualDevice();
    this.registerDevice(this.virtualDevice);
  }

  // ─── Comandos (llamadas directas) ─────────────────────────────────────────

  /**
   * Lista puertos/dispositivos disponibles para conectar.
   */
  async listAvailable(): Promise<TransportInfo[]> {
    try {
      return await SerialTransport.listPorts();
    } catch {
      return [];
    }
  }

  /**
   * Conecta un dispositivo Arduino por serial.
   */
  async connectArduino(portPath: string, baudRate = 9600): Promise<string> {
    const id = `arduino-${portPath.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Si ya existe, desconectar primero
    if (this.devices.has(id)) {
      await this.disconnect(id);
    }

    const device = new ArduinoDevice(id, `Arduino (${portPath})`, { path: portPath, baudRate });
    this.registerDevice(device);

    try {
      await device.connect();
      this.bus.emit('device:connected', { deviceId: id });
      log.info(`Device connected: ${id}`);
      return id;
    } catch (error) {
      this.devices.delete(id);
      const msg = error instanceof Error ? error.message : String(error);
      this.bus.emit('device:error', { deviceId: id, error: msg });
      throw error;
    }
  }

  /**
   * Desconecta un dispositivo por ID.
   */
  async disconnect(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;
    if (device.id === 'virtual') return; // No se puede desconectar el virtual

    await device.disconnect();
    this.devices.delete(deviceId);
    this.bus.emit('device:disconnected', { deviceId });
    log.info(`Device disconnected: ${deviceId}`);
  }

  /**
   * Obtiene info de un dispositivo.
   */
  getDevice(deviceId: string): DeckDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Lista todos los dispositivos conectados.
   */
  getConnectedDevices(): DeviceInfo[] {
    return Array.from(this.devices.values())
      .filter((d) => d.isConnected())
      .map((d) => d.getInfo());
  }

  /**
   * Obtiene el virtual device (para pulsaciones desde la UI).
   */
  getVirtualDevice(): VirtualDevice {
    return this.virtualDevice;
  }

  // ─── Internos ─────────────────────────────────────────────────────────────

  private registerDevice(device: DeckDevice): void {
    this.devices.set(device.id, device);

    // Vincular callbacks de botón al EventBus
    device.onButtonPress = (buttonId: number) => {
      this.bus.emit('button:press', { deviceId: device.id, buttonId });
    };

    device.onButtonRelease = (buttonId: number) => {
      this.bus.emit('button:release', { deviceId: device.id, buttonId });
    };
  }
}

// Singleton
export const deviceManager = new DeviceManager(eventBus);
