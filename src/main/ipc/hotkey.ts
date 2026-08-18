import { ipcMain, app } from 'electron';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { unlinkSync } from 'fs';

const execAsync = promisify(exec);

const VK_CODES: Record<string, string> = {
  'Ctrl': '0xA2', 'Control': '0xA2', 'Shift': '0xA0', 'Alt': '0xA4', 'Win': '0x5B',
  ...Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => [c, `0x${c.charCodeAt(0).toString(16).toUpperCase()}`])),
  ...Object.fromEntries('0123456789'.split('').map((c) => [c, `0x${(0x30 + Number(c)).toString(16).toUpperCase()}`])),
  'F1': '0x70', 'F2': '0x71', 'F3': '0x72', 'F4': '0x73', 'F5': '0x74', 'F6': '0x75',
  'F7': '0x76', 'F8': '0x77', 'F9': '0x78', 'F10': '0x79', 'F11': '0x7A', 'F12': '0x7B',
  'Enter': '0x0D', 'Tab': '0x09', 'Space': '0x20', 'Escape': '0x1B', 'Esc': '0x1B',
  'Backspace': '0x08', 'Delete': '0x2E', 'Insert': '0x2D',
  'Home': '0x24', 'End': '0x23', 'PageUp': '0x21', 'PageDown': '0x22',
  'Up': '0x26', 'Down': '0x28', 'Left': '0x25', 'Right': '0x27',
  'PrintScreen': '0x2C', 'Pause': '0x13', 'CapsLock': '0x14', 'NumLock': '0x90',
  'VolumeMute': '0xAD', 'VolumeDown': '0xAE', 'VolumeUp': '0xAF',
  'MediaNext': '0xB0', 'MediaPrev': '0xB1', 'MediaStop': '0xB2', 'MediaPlay': '0xB3',
};

function buildKeySequence(combo: string): string {
  const parts = combo.split('+').map((p) => p.trim());
  const modifiers: string[] = [];
  let mainKey = '';

  for (const part of parts) {
    const normalized = part.charAt(0).toUpperCase() + part.slice(1);
    if (['Ctrl', 'Control', 'Shift', 'Alt', 'Win'].includes(normalized)) {
      modifiers.push(normalized);
    } else {
      mainKey = normalized;
    }
  }

  const lines: string[] = [];
  for (const mod of modifiers) {
    const vk = VK_CODES[mod];
    if (vk) lines.push(`[KeySender]::KeyDown(${vk})`);
  }
  if (mainKey) {
    const vk = VK_CODES[mainKey] || VK_CODES[mainKey.toUpperCase()];
    if (vk) {
      lines.push(`[KeySender]::KeyDown(${vk})`);
      lines.push(`Start-Sleep -Milliseconds 50`);
      lines.push(`[KeySender]::KeyUp(${vk})`);
    }
  }
  for (const mod of [...modifiers].reverse()) {
    const vk = VK_CODES[mod];
    if (vk) lines.push(`[KeySender]::KeyUp(${vk})`);
  }
  return lines.join('\n');
}

export function registerHotkeyHandlers(): void {
  ipcMain.handle('hotkey:send', async (_event, keys: string, delay: number = 0) => {
    try {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));

      const keyActions = buildKeySequence(keys);
      const scriptContent = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KeySender {
    [DllImport("user32.dll", SetLastError = true)]
    static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    const uint KEYEVENTF_KEYDOWN = 0x0000;
    const uint KEYEVENTF_KEYUP = 0x0002;
    public static void KeyDown(byte vk) { keybd_event(vk, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero); }
    public static void KeyUp(byte vk) { keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero); }
}
"@
${keyActions}
`;
      const scriptPath = join(app.getPath('temp'), `deckforge_hotkey_${Date.now()}.ps1`);
      await writeFile(scriptPath, scriptContent, 'utf-8');

      try {
        await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`);
      } finally {
        try { unlinkSync(scriptPath); } catch { /* ignore */ }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
