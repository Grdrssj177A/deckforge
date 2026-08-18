/**
 * Interface base de un dispositivo DeckForge.
 * Cualquier hardware (Arduino, RP2040, Virtual) implementa esto.
 */

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;          // 'arduino' | 'rp2040' | 'virtual'
  buttonCount: number;
  hasDisplays: boolean;
  hasLeds: boolean;
}

export interface DeckDevice {
  readonly id: string;
  readonly name: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  getInfo(): DeviceInfo;

  // Enviar imagen a una tecla (para dispositivos con pantalla)
  setKeyImage?(key: number, image: Buffer): Promise<void>;

  // Ajustar brillo global
  setBrightness?(brightness: number): Promise<void>;

  // Callback cuando se pulsa/suelta un botón
  onButtonPress: ((buttonId: number) => void) | null;
  onButtonRelease: ((buttonId: number) => void) | null;
}
