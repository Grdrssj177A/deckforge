/**
 * Re-export shared types for the main process.
 * Main plugins/core import from here.
 */
export { ActionConfig, ActionContext, ActionState, ActionDefinition } from '../../shared/types/actions';
export { DeckPlugin, PluginId } from '../../shared/types/plugins';
export { Profile, Page, ButtonSlot, Action } from '../../shared/types/profiles';
export { DeviceInfo } from '../../shared/types/devices';
