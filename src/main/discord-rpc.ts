/**
 * Discord RPC Client via local IPC named pipe
 *
 * Connects to Discord's local RPC server to control voice settings.
 * Handles the full OAuth2 authorization flow for RPC access.
 *
 * Protocol: \\.\pipe\discord-ipc-{0-9}
 * Framing: [opcode:u32le][length:u32le][json payload]
 *
 * Nota de seguridad: en Windows cualquier proceso local puede ocupar ese pipe
 * antes que Discord. Por eso el parser acota el tamaño de trama y nunca crece
 * sin límite con lo que le manden.
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { createLogger } from './lib/logger';

const log = createLogger('DiscordRPC');

enum Opcode {
  HANDSHAKE = 0,
  FRAME = 1,
  CLOSE = 2,
  PING = 3,
  PONG = 4,
}

/** Tamaño máximo de una trama. Discord envía payloads pequeños. */
const MAX_FRAME_BYTES = 1024 * 1024;
/** Tiempo para completar conexión + handshake de un pipe concreto. */
const HANDSHAKE_TIMEOUT_MS = 1500;
/** Tiempo de espera de la respuesta a un comando. */
const COMMAND_TIMEOUT_MS = 10000;
const PIPE_RANGE = 10;

export interface VoiceState {
  mute: boolean;
  deaf: boolean;
}

interface PendingCallback {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
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
    for (let i = 0; i < PIPE_RANGE; i++) {
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

      let settled = false;
      let timer: NodeJS.Timeout | null = null;

      // Se desengancha todo en cualquier salida: antes el listener de '_ready'
      // quedaba registrado en cada intento fallido y se acumulaba.
      const detach = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        this.removeListener('_ready', onReady);
        socket.removeListener('connect', onConnect);
        socket.removeListener('error', onError);
      };

      const succeed = () => {
        if (settled) return;
        settled = true;
        detach();
        this.connected = true;
        resolve();
      };

      const failWith = (err: Error) => {
        if (settled) return;
        settled = true;
        detach();
        // Este socket no sirve: se cierra para no dejarlo abierto.
        if (this.socket === socket) this.socket = null;
        try { socket.removeAllListeners(); socket.destroy(); } catch { /* ignore */ }
        reject(err);
      };

      function onReady() { succeed(); }
      const onError = (err: Error) => failWith(err);
      const onConnect = () => {
        this.socket = socket;
        this.buffer = Buffer.alloc(0);
        this.setupListeners(socket);
        this.sendPacket(Opcode.HANDSHAKE, { v: 1, client_id: this.clientId });
      };

      timer = setTimeout(() => failWith(new Error('Connection timeout')), HANDSHAKE_TIMEOUT_MS);
      socket.once('connect', onConnect);
      socket.on('error', onError);
      this.once('_ready', onReady);
    });
  }

  private setupListeners(socket: net.Socket): void {
    socket.on('data', (chunk) => {
      if (this.socket !== socket) return;
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    });

    socket.on('close', () => {
      // Un socket descartado durante los intentos de conexión no debe emitir
      // 'disconnected' ni pisar el socket activo.
      if (this.socket !== socket) return;
      this.socket = null;
      const wasConnected = this.connected;
      this.connected = false;
      this.authenticated = false;
      this.rejectPending(new Error('Disconnected'));
      if (wasConnected) this.emit('disconnected');
    });

    socket.on('error', (err) => {
      log.error(`Socket error: ${err.message}`);
    });
  }

  private processBuffer(): void {
    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readUInt32LE(0);
      const length = this.buffer.readUInt32LE(4);

      // La longitud la controla el otro extremo del pipe: sin este límite, un
      // valor grande hacía crecer el buffer indefinidamente.
      if (length > MAX_FRAME_BYTES) {
        log.error(`Frame length ${length} exceeds limit; dropping connection`);
        this.disconnect();
        return;
      }

      if (this.buffer.length < 8 + length) break;

      const payload = this.buffer.subarray(8, 8 + length).toString('utf-8');
      this.buffer = this.buffer.subarray(8 + length);

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
      this.settlePending(nonce, payload, null);
      return;
    }

    // Command responses
    if (nonce && this.pendingCallbacks.has(nonce)) {
      if (evt === 'ERROR') {
        this.settlePending(nonce, null, new Error(payload?.message || 'Discord RPC Error'));
      } else {
        this.settlePending(nonce, payload, null);
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

  /** Resuelve o rechaza una petición pendiente, limpiando siempre su timer. */
  private settlePending(nonce: string, data: any, error: Error | null): void {
    const cb = this.pendingCallbacks.get(nonce);
    if (!cb) return;
    this.pendingCallbacks.delete(nonce);
    clearTimeout(cb.timer);
    if (error) cb.reject(error); else cb.resolve(data);
  }

  private rejectPending(error: Error): void {
    const pending = Array.from(this.pendingCallbacks.entries());
    this.pendingCallbacks.clear();
    for (const [, cb] of pending) {
      clearTimeout(cb.timer);
      cb.reject(error);
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

  /** Registra una petición pendiente con su timeout ya asociado. */
  private request(frame: (nonce: string) => object): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = String(++this.nonce);
      const timer = setTimeout(() => {
        this.pendingCallbacks.delete(id);
        reject(new Error('Discord RPC request timed out'));
      }, COMMAND_TIMEOUT_MS);
      this.pendingCallbacks.set(id, { resolve, reject, timer });
      this.sendPacket(Opcode.FRAME, frame(id));
    });
  }

  private sendCommand(cmd: string, args: object = {}): Promise<any> {
    return this.request((nonce) => ({ cmd, args, nonce }));
  }

  /**
   * Suscribirse a un evento de Discord.
   * El protocolo requiere { cmd: "SUBSCRIBE", evt: "EVENT_NAME", nonce: "..." }
   * (evt va a nivel top, no dentro de args)
   */
  private subscribe(event: string, args: object = {}): Promise<any> {
    return this.request((nonce) => ({ cmd: 'SUBSCRIBE', evt: event, args, nonce }));
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
        let tooLarge = false;
        res.on('data', (chunk) => {
          if (tooLarge) return;
          data += chunk;
          if (data.length > 256 * 1024) {
            tooLarge = true;
            req.destroy();
            reject(new Error('Token response too large'));
          }
        });
        res.on('end', () => {
          if (tooLarge) return;
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

  /**
   * Invierte el mute leyendo el estado una sola vez.
   * La suscripción a VOICE_SETTINGS_UPDATE mantiene `voiceState` al día, así
   * que no hacen falta dos lecturas ni una espera artificial.
   */
  async toggleMute(): Promise<VoiceState> {
    const current = await this.getVoiceSettings();
    await this.setMute(!current.mute);
    return this.voiceState;
  }

  async toggleDeaf(): Promise<VoiceState> {
    const current = await this.getVoiceSettings();
    await this.setDeaf(!current.deaf);
    return this.voiceState;
  }

  disconnect(): void {
    const socket = this.socket;
    this.socket = null;

    const wasConnected = this.connected;
    this.connected = false;
    this.authenticated = false;
    this.buffer = Buffer.alloc(0);

    if (socket) {
      // Se quitan los listeners antes de destruir para que 'close' no emita un
      // segundo 'disconnected'.
      try { socket.removeAllListeners(); socket.destroy(); } catch { /* ignore */ }
    }

    this.rejectPending(new Error('Disconnected'));
    if (wasConnected) this.emit('disconnected');
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}
