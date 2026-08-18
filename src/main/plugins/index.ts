import { pluginManager } from '../core/PluginManager';
import { HotkeyPlugin } from './hotkey.plugin';
import { SystemPlugin } from './system.plugin';
import { NanoleafPlugin } from './nanoleaf.plugin';
import { DiscordPlugin } from './discord.plugin';
import { OBSPlugin } from './obs.plugin';

/**
 * Registra todos los plugins del main process.
 * Se llama una vez al arrancar la app.
 */
export function registerAllPlugins(): void {
  pluginManager.register(new HotkeyPlugin());
  pluginManager.register(new SystemPlugin());
  pluginManager.register(new NanoleafPlugin());
  pluginManager.register(new DiscordPlugin());
  pluginManager.register(new OBSPlugin());
}

export { pluginManager };
