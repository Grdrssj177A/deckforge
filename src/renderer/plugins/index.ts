import { Plugin } from '@/types';
import soundboardPlugin from './soundboard';
import hotkeyPlugin from './hotkey';
import obsPlugin from './obs';
import discordPlugin from './discord';
import nanoleafPlugin from './nanoleaf';
import systemPlugin from './system';

export const pluginRegistry: Plugin[] = [
  soundboardPlugin,
  hotkeyPlugin,
  obsPlugin,
  discordPlugin,
  nanoleafPlugin,
  systemPlugin,
];
