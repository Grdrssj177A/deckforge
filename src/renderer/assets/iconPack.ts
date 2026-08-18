// Pack de iconos integrados como SVG data URLs
// Iconos con color propio para que se vean bien sobre fondo oscuro

function svg(paths: string, viewBox = '0 0 24 24'): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths}</svg>`)}`;
}

export interface IconPackItem {
  name: string;
  svg: string;
  category: string;
  id: string;
}

export function getIconById(id: string): IconPackItem | undefined {
  return ICON_PACK.find((i) => i.id === id);
}

function ic(id: string, name: string, cat: string, paths: string, vb = '0 0 24 24'): IconPackItem {
  return { id, name, category: cat, svg: svg(paths, vb) };
}

export const ICON_PACK: IconPackItem[] = [
  // ─── Audio (verdes/cyan) ──────────────────────────────────────
  ic('mic', 'Micrófono', 'audio', '<path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" fill="#4caf50"/><path d="M17 11a5 5 0 01-10 0" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round"/><path d="M12 17v3m-3 0h6" fill="none" stroke="#a5d6a7" stroke-width="2" stroke-linecap="round"/>'),
  ic('mic-mute', 'Micro mute', 'audio', '<path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" fill="#ef5350"/><path d="M17 11a5 5 0 01-10 0" fill="none" stroke="#ef5350" stroke-width="2" stroke-linecap="round"/><path d="M12 17v3m-3 0h6" fill="none" stroke="#ef9a9a" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="4" x2="20" y2="20" stroke="#ef5350" stroke-width="2.5" stroke-linecap="round"/>'),
  ic('headphones', 'Auriculares', 'audio', '<path d="M3 18v-6a9 9 0 0118 0v6" fill="none" stroke="#7c4dff" stroke-width="2"/><rect x="3" y="14" width="4" height="6" rx="1" fill="#7c4dff"/><rect x="17" y="14" width="4" height="6" rx="1" fill="#7c4dff"/>'),
  ic('headphones-off', 'Auriculares off', 'audio', '<path d="M3 18v-6a9 9 0 0118 0v6" fill="none" stroke="#ef5350" stroke-width="2"/><rect x="3" y="14" width="4" height="6" rx="1" fill="#ef5350"/><rect x="17" y="14" width="4" height="6" rx="1" fill="#ef5350"/><line x1="4" y1="4" x2="20" y2="20" stroke="#ef5350" stroke-width="2.5" stroke-linecap="round"/>'),
  ic('volume', 'Volumen', 'audio', '<path d="M11 5L6 9H2v6h4l5 4V5z" fill="#42a5f5"/><path d="M19 9a5 5 0 010 6m2-9a8 8 0 010 12" fill="none" stroke="#90caf9" stroke-width="2" stroke-linecap="round"/>'),
  ic('volume-mute', 'Mute', 'audio', '<path d="M11 5L6 9H2v6h4l5 4V5z" fill="#ef5350"/><line x1="22" y1="9" x2="16" y2="15" stroke="#ef5350" stroke-width="2.5" stroke-linecap="round"/><line x1="16" y1="9" x2="22" y2="15" stroke="#ef5350" stroke-width="2.5" stroke-linecap="round"/>'),
  ic('play', 'Play', 'audio', '<polygon points="6,3 20,12 6,21" fill="#4caf50"/>'),
  ic('pause', 'Pause', 'audio', '<rect x="6" y="4" width="4" height="16" rx="1" fill="#ffa726"/><rect x="14" y="4" width="4" height="16" rx="1" fill="#ffa726"/>'),
  ic('stop', 'Stop', 'audio', '<rect x="5" y="5" width="14" height="14" rx="3" fill="#ef5350"/>'),
  ic('skip', 'Skip', 'audio', '<polygon points="5,4 15,12 5,20" fill="#42a5f5"/><rect x="17" y="4" width="3" height="16" rx="1" fill="#42a5f5"/>'),

  // ─── Streaming (rojos/naranjas) ───────────────────────────────
  ic('record', 'Record', 'stream', '<circle cx="12" cy="12" r="7" fill="#e53935"/><circle cx="12" cy="12" r="10" fill="none" stroke="#ef9a9a" stroke-width="1.5"/>'),
  ic('live', 'Live', 'stream', '<circle cx="12" cy="12" r="4" fill="#e53935"/><circle cx="12" cy="12" r="8" fill="none" stroke="#e53935" stroke-width="2" opacity="0.6"/><circle cx="12" cy="12" r="11" fill="none" stroke="#e53935" stroke-width="1" opacity="0.3"/>'),
  ic('camera', 'Cámara', 'stream', '<rect x="2" y="6" width="14" height="12" rx="2" fill="#78909c"/><polygon points="22,8 16,12 22,16" fill="#90a4ae"/>'),
  ic('camera-off', 'Cámara off', 'stream', '<rect x="2" y="6" width="14" height="12" rx="2" fill="#546e7a"/><line x1="3" y1="3" x2="21" y2="21" stroke="#ef5350" stroke-width="2.5" stroke-linecap="round"/>'),
  ic('screen', 'Pantalla', 'stream', '<rect x="2" y="3" width="20" height="14" rx="2" fill="none" stroke="#90caf9" stroke-width="2"/><rect x="4" y="5" width="16" height="10" rx="1" fill="#1e3a5f"/><line x1="8" y1="20" x2="16" y2="20" stroke="#90caf9" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="12" y2="20" stroke="#90caf9" stroke-width="2"/>'),
  ic('scene', 'Escena', 'stream', '<rect x="2" y="2" width="9" height="9" rx="2" fill="#7c4dff"/><rect x="13" y="2" width="9" height="9" rx="2" fill="#536dfe"/><rect x="2" y="13" width="9" height="9" rx="2" fill="#536dfe"/><rect x="13" y="13" width="9" height="9" rx="2" fill="#7c4dff"/>'),

  // ─── Sistema (azules/grises) ──────────────────────────────────
  ic('folder', 'Carpeta', 'system', '<path d="M2 6a2 2 0 012-2h4l2 2h10a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" fill="#ffa726"/>'),
  ic('link', 'Link', 'system', '<path d="M10 14a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1.5 1.5m1 4a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5L11 18" fill="none" stroke="#42a5f5" stroke-width="2" stroke-linecap="round"/>'),
  ic('terminal', 'Terminal', 'system', '<rect x="2" y="3" width="20" height="18" rx="3" fill="#263238"/><polyline points="6,15 10,11 6,7" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="15" x2="18" y2="15" stroke="#78909c" stroke-width="2" stroke-linecap="round"/>'),
  ic('power', 'Power', 'system', '<path d="M18.36 6.64a9 9 0 11-12.73 0" fill="none" stroke="#ef5350" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="2" x2="12" y2="12" stroke="#ef5350" stroke-width="2.5" stroke-linecap="round"/>'),
  ic('lock', 'Lock', 'system', '<rect x="5" y="11" width="14" height="10" rx="2" fill="#ffa726"/><path d="M8 11V7a4 4 0 018 0v4" fill="none" stroke="#ffc107" stroke-width="2.5" stroke-linecap="round"/>'),
  ic('screenshot', 'Screenshot', 'system', '<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#90caf9" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#42a5f5" stroke-width="2"/><circle cx="12" cy="12" r="1.5" fill="#42a5f5"/>'),

  // ─── Luces (amarillos) ────────────────────────────────────────
  ic('bulb', 'Bombilla', 'lights', '<path d="M9 21h6m-3-3v3" fill="none" stroke="#bdbdbd" stroke-width="2" stroke-linecap="round"/><path d="M8 14a5 5 0 1110 0c0 2-2 3-2 5H8c0-2-2-3-2-5z" fill="none" stroke="#bdbdbd" stroke-width="2"/>'),
  ic('bulb-on', 'Bombilla on', 'lights', '<path d="M9 21h6m-3-3v3" fill="none" stroke="#ffd54f" stroke-width="2" stroke-linecap="round"/><path d="M8 14a5 5 0 1110 0c0 2-2 3-2 5H8c0-2-2-3-2-5z" fill="#ffc107" stroke="#ffc107" stroke-width="2"/><circle cx="12" cy="11" r="7" fill="#fff9c4" opacity="0.2"/>'),
  ic('sun', 'Sol', 'lights', '<circle cx="12" cy="12" r="4" fill="#ffc107"/><path d="M12 2v3m0 14v3m10-10h-3M5 12H2m15.07-7.07l-2.12 2.12M8.05 15.95l-2.12 2.12m12.14 0l-2.12-2.12M8.05 8.05L5.93 5.93" stroke="#ffa726" stroke-width="2" stroke-linecap="round"/>'),
  ic('moon', 'Luna', 'lights', '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#7986cb"/>'),
  ic('brightness-up', 'Brillo +', 'lights', '<circle cx="12" cy="12" r="4" fill="none" stroke="#ffc107" stroke-width="2"/><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m16.5-6.5l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6" stroke="#ffc107" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="9" x2="12" y2="15" stroke="#ffc107" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="12" x2="15" y2="12" stroke="#ffc107" stroke-width="2" stroke-linecap="round"/>'),
  ic('brightness-down', 'Brillo -', 'lights', '<circle cx="12" cy="12" r="4" fill="none" stroke="#78909c" stroke-width="2"/><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m16.5-6.5l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6" stroke="#78909c" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="12" x2="15" y2="12" stroke="#78909c" stroke-width="2" stroke-linecap="round"/>'),

  // ─── Apps (colores de marca) ──────────────────────────────────
  ic('discord', 'Discord', 'apps', '<path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.11 13.11 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.099.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.419s.956-2.419 2.157-2.419 2.176 1.096 2.157 2.42c0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419s.955-2.419 2.157-2.419 2.176 1.096 2.157 2.42c0 1.332-.946 2.418-2.157 2.418z" fill="#5865F2"/>'),
  ic('obs', 'OBS', 'apps', '<circle cx="12" cy="12" r="10" fill="none" stroke="#e0e0e0" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#e0e0e0" stroke-width="2"/><path d="M12 2a10 10 0 010 20" fill="none" stroke="#e0e0e0" stroke-width="2" stroke-dasharray="4 4"/>'),
  ic('spotify', 'Spotify', 'apps', '<circle cx="12" cy="12" r="10" fill="#1db954"/><path d="M8 15c2.5-1 5.5-1 8 0M7 12c3-1.5 7-1.5 10 0M6 9c3.5-2 8.5-2 12 0" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>'),

  // ─── Nav ──────────────────────────────────────────────────────
  ic('arrow-up', 'Arriba', 'nav', '<polyline points="18,15 12,8 6,15" fill="none" stroke="#90caf9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  ic('arrow-down', 'Abajo', 'nav', '<polyline points="6,9 12,16 18,9" fill="none" stroke="#90caf9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  ic('back', 'Volver', 'nav', '<polyline points="15,18 9,12 15,6" fill="none" stroke="#90caf9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  ic('refresh', 'Refresh', 'nav', '<polyline points="23,4 23,10 17,10" fill="none" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" fill="none" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round"/>'),
];
