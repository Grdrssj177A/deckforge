import { DeckPlugin, ActionDefinition, ActionConfig, ActionContext } from '../core/types';
import { createLogger } from '../lib/logger';

const log = createLogger('OBSPlugin');

/**
 * Plugin OBS Studio (placeholder).
 * Cuando se implemente obs-websocket-js, la lógica irá aquí.
 */
export class OBSPlugin implements DeckPlugin {
  readonly id = 'obs';
  readonly name = 'OBS Studio';
  readonly icon = '🎬';
  readonly description = 'Controla OBS Studio via WebSocket';

  readonly actions: ActionDefinition[] = [
    { id: 'startStreaming', pluginId: 'obs', name: 'Start Streaming', description: 'Inicia el streaming', defaultConfig: { command: 'StartStreaming' } },
    { id: 'stopStreaming', pluginId: 'obs', name: 'Stop Streaming', description: 'Detiene el streaming', defaultConfig: { command: 'StopStreaming' } },
    { id: 'startRecording', pluginId: 'obs', name: 'Start Recording', description: 'Inicia la grabación', defaultConfig: { command: 'StartRecording' } },
    { id: 'stopRecording', pluginId: 'obs', name: 'Stop Recording', description: 'Detiene la grabación', defaultConfig: { command: 'StopRecording' } },
    { id: 'switchScene', pluginId: 'obs', name: 'Switch Scene', description: 'Cambia de escena', defaultConfig: { command: 'SetCurrentScene', sceneName: '' } },
    { id: 'toggleMute', pluginId: 'obs', name: 'Toggle Mute', description: 'Mute/Unmute fuente', defaultConfig: { command: 'ToggleMute', source: 'Mic/Aux' } },
  ];

  async initialize(): Promise<void> {
    // TODO: conectar a OBS WebSocket cuando se implemente
  }

  async dispose(): Promise<void> {
    // TODO: desconectar WebSocket
  }

  async execute(actionId: string, config: ActionConfig, context: ActionContext): Promise<void> {
    log.info(`OBS action: ${actionId} (placeholder — WebSocket not implemented yet)`);
    // TODO: implementar con obs-websocket-js
  }
}
