/**
 * Interface base de transporte.
 * Define cómo se comunica la app con un dispositivo físico,
 * independientemente del protocolo (Serial, USB HID, BLE, etc.)
 */

export interface TransportEvents {
  onData: (line: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export interface Transport {
  readonly type: string; // 'serial' | 'usb-hid' | 'virtual'

  connect(config: TransportConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Enviar datos al dispositivo (para futuro: imágenes, LEDs)
  send(data: Buffer | string): Promise<void>;

  // Registrar listeners
  setListeners(listeners: TransportEvents): void;
}

export interface TransportConfig {
  path?: string;      // Para serial: COM port
  baudRate?: number;  // Para serial
  vendorId?: number;  // Para USB HID
  productId?: number; // Para USB HID
}

export interface TransportInfo {
  path: string;
  type: string;
  manufacturer?: string;
  friendlyName?: string;
}
