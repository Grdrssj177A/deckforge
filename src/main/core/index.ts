export { eventBus } from './EventBus';
export { deviceManager } from './DeviceManager';
export { profileManager } from './ProfileManager';
export { pluginManager } from './PluginManager';
export { settingsManager } from './SettingsManager';

import { ActionManager } from './ActionManager';
import { SessionManager } from './SessionManager';
import { pluginManager } from './PluginManager';
import { profileManager } from './ProfileManager';
import { eventBus } from './EventBus';

export const actionManager = new ActionManager(pluginManager, eventBus);
export const sessionManager = new SessionManager(profileManager, actionManager);
