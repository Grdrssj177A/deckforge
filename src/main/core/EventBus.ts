/**
 * EventBus tipado para DeckForge.
 * Pub/sub centralizado para sucesos del sistema.
 * Comandos van por llamadas directas; sucesos por aquí.
 */

export type DeckForgeEventMap = {
  'button:press': { deviceId: string; buttonId: number };
  'button:release': { deviceId: string; buttonId: number };
  'device:connected': { deviceId: string };
  'device:disconnected': { deviceId: string };
  'device:error': { deviceId: string; error: string };
  'action:started': { pluginId: string; actionId: string; context: any };
  'action:completed': { pluginId: string; actionId: string; context: any };
  'action:failed': { pluginId: string; actionId: string; context: any; error: string };
};

type EventHandler<T> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler<any>>>();

  on<K extends keyof DeckForgeEventMap>(event: K, handler: EventHandler<DeckForgeEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Devuelve función de unsubscribe
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  emit<K extends keyof DeckForgeEventMap>(event: K, data: DeckForgeEventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (e) {
          // Log but don't prevent other handlers from running
          console.error(`[EventBus] Handler error on "${event}":`, e);
        }
      }
    }
  }

  removeAllListeners(event?: keyof DeckForgeEventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Singleton global del main process
export const eventBus = new EventBus();
