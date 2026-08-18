/**
 * Discord RPC Client via local IPC named pipe
 * 
 * Connects to Discord's local RPC server to control voice settings.
 * Handles the full OAuth2 authorization flow for RPC access.
 * 
 * Protocol: \\.\pipe\discord-ipc-{0-9}
 * Framing: [opcode:u32le][length:u32le][json payload]
 */

import * as net from 'net';
import { EventEmitter } from 'events';

enum Opcode {
  HANDSHAKE = 0,
  FRAME = 1,
  CLOSE = 2,
  PING = 3,
  PONG = 4,
}

export interface VoiceState {
  mute: boolean;
  deaf: boolean;
}

interface PendingCallback {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
}

export class DiscordRPC extends EventEmitter {
  private socket: net.Socket | null = null;
  private connected = false;
  private authenticated = false;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private voiceState: VoiceState = { mute: false, deaf: false };
  private nonce = 0;
  private pendingCallbacks = new Map<string, PendingCallback>();
  private buffer = Buffer.alloc(0);

  constructor(clientId: string, clientSecret: string = '') {
    super();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  get isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  get currentVoiceState(): VoiceState {
    return { ...this.voiceState };
  }

  /**
   * Connect to Discord IPC and perform handshake.
   * After connect, you need to call authorize() or authenticate() with a token.
   */
  async connect(): Promise<boolean> {
    for (let i = 0; i <= 9; i++) {
      try {
        await this.tryConnect(i);
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  private tryConnect(pipeNumber: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const pipePath = `\\\\?\\pipe\\discord-ipc-${pipeNumber}`;
      const socket = net.createConnection(pipePath);
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          reject(new Error('Connection timeout'));
        }
      }, 5000);

      socket.on('connect', () => {
        this.socket = socket;
        this.buffer = Buffer.alloc(0);
        this.setupListeners();
        // Send handshake
        this.sendPacket(Opcode.HANDSHAKE, { v: 1, client_id: this.clientId });
      });

      socket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      this.once('_ready', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.connected = true;
          resolve();
        }
      });
    });
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    });

    this.socket.on('close', () => {
      this.connected = false;
      this.authenticated = false;
      this.socket = null;
      this.emit('disconnected');
    });

    this.socket.on('error', (err) => {
      console.error('[Discord RPC] Socket error:', err.message);
    });
  }

  private processBuffer(): void {
    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readUInt32LE(0);
      const length = this.buffer.readUInt32LE(4);

      if (this.buffer.length < 8 + length) break;

      const payload = this.buffer.slice(8, 8 + length).toString('utf-8');
      this.buffer = this.buffer.slice(8 + length);

      this.handlePacket(opcode, payload);
    }
  }

  private handlePacket(opcode: number, payload: string): void {
    let data: any;
    try {
      data = JSON.parse(payload);
    } catch {
      return;
    }

    if (opcode === Opcode.CLOSE) {
      this.disconnect();
      return;
    }
    if (opcode === Opcode.PING) {
      this.sendPacket(Opcode.PONG, data);
      return;
    }
    if (opcode === Opcode.FRAME) {
      this.handleFrame(data);
    }
  }

  private handleFrame(data: any): void {
    const { cmd, evt, nonce, data: payload } = data;

    // Event dispatches (pushed by Discord without request)
    if (cmd === 'DISPATCH' || (!cmd && evt)) {
      if (evt === 'READY') {
        this.emit('_ready', payload);
        return;
      }
      if (evt === 'VOICE_SETTINGS_UPDATE') {
        this.handleVoiceUpdate(payload);
        return;
      }
      return;
    }

    // SUBSCRIBE response — also comes with evt field
    if (cmd === 'SUBSCRIBE' && nonce && this.pendingCallbacks.has(nonce)) {
      const cb = this.pendingCallbacks.get(nonce)!;
      this.pendingCallbacks.delete(nonce);
      cb.resolve(payload);
      return;
    }

    // Command responses
    if (nonce && this.pendingCallbacks.has(nonce)) {
      const cb = this.pendingCallbacks.get(nonce)!;
      this.pendingCallbacks.delete(nonce);

      if (evt === 'ERROR') {
        cb.reject(new Error(payload?.message || 'Discord RPC Error'));
      } else {
        cb.resolve(payload);
      }
      return;
    }

    // Events without nonce (READY comes as evt on the frame directly)
    if (evt === 'READY') {
      this.emit('_ready', payload);
    } else if (evt === 'VOICE_SETTINGS_UPDATE') {
      this.handleVoiceUpdate(payload);
    }
  }

  private handleVoiceUpdate(data: any): void {
    if (!data) return;
    const prev = { ...this.voiceState };
    this.voiceState = {
      mute: !!data.mute,
      deaf: !!data.deaf,
    };
    if (prev.mute !== this.voiceState.mute || prev.deaf !== this.voiceState.deaf) {
      this.emit('voiceStateChange', this.voiceState);
    }
  }

  private sendPacket(opcode: Opcode, data: object): void {
    if (!this.socket) return;
    const payload = JSON.stringify(data);
    const buf = Buffer.from(payload, 'utf-8');
    const header = Buffer.alloc(8);
    header.writeUInt32LE(opcode, 0);
    header.writeUInt32LE(buf.length, 4);
    this.socket.write(Buffer.concat([header, buf]));
  }

  private sendCommand(cmd: string, args: object = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = String(++this.nonce);
      this.pendingCallbacks.set(id, { resolve, reject });
      this.sendPacket(Opcode.FRAME, { cmd, args, nonce: id });

      setTimeout(() => {
        if (this.pendingCallbacks.has(id)) {
          this.pendingCallbacks.delete(id);
          reject(new Error(`Command ${cmd} timed out`));
        }
      }, 10000);
    });
  }

  /**
   * Suscribirse a un evento de Discord.
   * El protocolo requiere { cmd: "SUBSCRIBE", evt: "EVENT_NAME", nonce: "..." }
   * (evt va a nivel top, no dentro de args)
   */
  private subscribe(event: string, args: object = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = String(++this.nonce);
      this.pendingCallbacks.set(id, { resolve, reject });
      this.sendPacket(Opcode.FRAME, { cmd: 'SUBSCRIBE', evt: event, args, nonce: id });

      setTimeout(() => {
        if (this.pendingCallbacks.has(id)) {
          this.pendingCallbacks.delete(id);
          reject(new Error(`Subscribe to ${event} timed out`));
        }
      }, 10000);
    });
  }

  // ─── Authorization Flow ──────────────────────────────────────────────────

  /**
   * Step 1: Request authorization from the user.
   * Discord will show a consent dialog. Returns an authorization code.
   */
  async authorize(): Promise<string> {
    const response = await this.sendCommand('AUTHORIZE', {
      client_id: this.clientId,
      scopes: ['rpc', 'rpc.voice.read', 'rpc.voice.write'],
    });
    if (!response?.code) {
      throw new Error('No authorization code received. User may have denied access.');
    }
    return response.code;
  }

  /**
   * Step 2: Exchange the authorization code for an access token.
   * For local desktop apps without a backend, we use the implicit grant.
   * If clientSecret is available, we can do the code exchange ourselves.
   */
  async exchangeCode(code: string): Promise<string> {
    if (!this.clientSecret) {
      // Sin client secret, no podemos hacer el exchange desde el cliente.
      // Devolvemos el code para que se use con AUTHENTICATE directamente
      // (Discord RPC acepta el code como token en algunos casos para apps locales)
      throw new Error('CLIENT_SECRET_REQUIRED');
    }

    const https = await import('https');
    const querystring = await import('querystring');

    return new Promise((resolve, reject) => {
      const postData = querystring.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'http://localhost',
      });

      const options = {
        hostname: 'discord.com',
        port: 443,
        path: '/api/oauth2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.access_token) {
              resolve(json.access_token);
            } else {
              reject(new Error(json.error || 'Token exchange failed'));
            }
          } catch {
            reject(new Error('Failed to parse token response'));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Step 3: Authenticate with the access token.
   */
  async authenticate(accessToken: string): Promise<void> {
    this.accessToken = accessToken;
    const response = await this.sendCommand('AUTHENTICATE', { access_token: accessToken });
    if (!response?.user) {
      throw new Error('Authentication failed');
    }
    this.authenticated = true;
    this.emit('authenticated', response.user);

    // Subscribe to voice settings updates
    try {
      await this.subscribe('VOICE_SETTINGS_UPDATE');
    } catch { /* Some scopes may not allow this */ }

    // Get initial voice state
    try {
      const settings = await this.sendCommand('GET_VOICE_SETTINGS');
      if (settings) this.handleVoiceUpdate(settings);
    } catch { /* ignore */ }
  }

  /**
   * Full connect + authorize + authenticate flow.
   * If savedToken is provided, tries to authenticate directly first.
   */
  async connectAndAuth(savedToken?: string | null, clientSecret?: string): Promise<void> {
    if (clientSecret) this.clientSecret = clientSecret;

    if (!this.connected) {
      const ok = await this.connect();
      if (!ok) throw new Error('Could not connect to Discord IPC. Is Discord running?');
    }

    // Try with saved token first
    if (savedToken) {
      try {
        await this.authenticate(savedToken);
        return;
      } catch {
        // Token expired or invalid, re-authorize
      }
    }

    // Full authorization flow
    const code = await this.authorize();

    let token: string;
    if (this.clientSecret) {
      token = await this.exchangeCode(code);
    } else {
      // Sin client secret, intentamos autenticar con el code directamente
      // (Discord lo acepta para apps en desarrollo/testing)
      try {
        await this.authenticate(code);
        return;
      } catch {
        throw new Error(
          'Se necesita el Client Secret para completar la autorización. ' +
          'Ve a discord.com/developers, tu app > OAuth2 > Client Secret, y añádelo en Configuración Global.'
        );
      }
    }

    await this.authenticate(token);
  }

  // ─── Public Voice API ────────────────────────────────────────────────────

  async getVoiceSettings(): Promise<VoiceState> {
    const data = await this.sendCommand('GET_VOICE_SETTINGS');
    if (data) this.handleVoiceUpdate(data);
    return this.voiceState;
  }

  async setMute(mute: boolean): Promise<boolean> {
    await this.sendCommand('SET_VOICE_SETTINGS', { mute });
    this.voiceState.mute = mute;
    this.emit('voiceStateChange', this.voiceState);
    return true;
  }

  async setDeaf(deaf: boolean): Promise<boolean> {
    await this.sendCommand('SET_VOICE_SETTINGS', { deaf });
    this.voiceState.deaf = deaf;
    this.emit('voiceStateChange', this.voiceState);
    return true;
  }

  async toggleMute(): Promise<VoiceState> {
    await this.setMute(!this.voiceState.mute);
    return this.voiceState;
  }

  async toggleDeaf(): Promise<VoiceState> {
    await this.setDeaf(!this.voiceState.deaf);
    return this.voiceState;
  }

  disconnect(): void {
    if (this.socket) {
      try { this.socket.destroy(); } catch { /* ignore */ }
      this.socket = null;
    }
    this.connected = false;
    this.authenticated = false;
    this.buffer = Buffer.alloc(0);
    this.pendingCallbacks.forEach(cb => cb.reject(new Error('Disconnected')));
    this.pendingCallbacks.clear();
    this.emit('disconnected');
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}
