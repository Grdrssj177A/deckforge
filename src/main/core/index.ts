export { eventBus } from './EventBus';
export { deviceManager } from './DeviceManager';
export { profileManager } from './ProfileManager';
export { pluginManager } from './PluginManager';
export { settingsManager } from './SettingsManager';

// ActionManager needs pluginManager and eventBus, so we create it here
import { ActionManager } from './ActionManager';
import { pluginManager } from './PluginManager';
import { eventBus } from './EventBus';

export const actionManager = new ActionManager(pluginManager, eventBus);
