import { DeckDevice, DeviceInfo } from './DeckDevice';
import { createLogger } from '../lib/logger';

const log = createLogger('VirtualDevice');

/**
 * Dispositivo virtual (el grid de pantalla).
 * Se comporta como un dispositivo real desde el punto de vista del Core.
 * Permite probar pulsaciones, acciones y estados sin hardware.
 */
export class VirtualDevice implements DeckDevice {
  readonly id = 'virtual';
  readonly name = 'DeckForge Virtual';

  onButtonPress: ((buttonId: number) => void) | null = null;
  onButtonRelease: ((buttonId: number) => void) | null = null;

  private connected = true; // Siempre "conectado"

  async connect(): Promise<void> {
    this.connected = true;
    log.info('Virtual device connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getInfo(): DeviceInfo {
    return {
      id: this.id,
      name: this.name,
      type: 'virtual',
      buttonCount: 36, // Max grid size
      hasDisplays: true, // Pantalla = la propia UI
      hasLeds: false,
    };
  }

  /**
   * Simula una pulsación desde la UI.
   * Llamado por el renderer cuando el usuario hace click en un botón.
   */
  simulatePress(buttonId: number): void {
    this.onButtonPress?.(buttonId);
  }

  simulateRelease(buttonId: number): void {
    this.onButtonRelease?.(buttonId);
  }

  // El virtual device "muestra" imágenes en la UI via IPC (no buffer directo)
  async setKeyImage(key: number, image: Buffer): Promise<void> {
    // En el futuro: enviar al renderer para mostrar en el grid
  }
}
