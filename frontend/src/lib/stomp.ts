'use client';

import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { API_URL, api } from './api';

type Listener = (body: unknown) => void;
type StatusListener = (connected: boolean) => void;

/**
 * One shared STOMP-over-SockJS connection for the whole tab.
 * Subscriptions are reference counted and automatically re-established after reconnects,
 * so components can mount/unmount freely without leaking sockets.
 */
class StompManager {
  private client: Client | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private subs = new Map<string, StompSubscription>();
  private statusListeners = new Set<StatusListener>();
  private connected = false;
  private refCount = 0;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    fn(this.connected);
    return () => this.statusListeners.delete(fn);
  }

  private setConnected(v: boolean) {
    this.connected = v;
    this.statusListeners.forEach((fn) => fn(v));
  }

  private async ensureClient() {
    if (this.client) return;
    // sockjs-client expects a Node-style `global` in the browser.
    const g = globalThis as unknown as { global?: unknown };
    if (typeof g.global === 'undefined') g.global = globalThis;
    const SockJS = (await import('sockjs-client')).default;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws-tracker`, undefined, { transports: ['websocket', 'xhr-streaming', 'xhr-polling'] }),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => undefined,
    });
    // Authenticate the CONNECT frame with a fresh token from the REST session, so the socket can never
    // be anonymous or a previous user just because the handshake cookie was expired or stale.
    client.beforeConnect = async () => {
      try {
        const { token } = await api.auth.wsToken();
        client.connectHeaders = { Authorization: `Bearer ${token}` };
      } catch {
        client.connectHeaders = {};
      }
    };
    client.onConnect = () => {
      this.setConnected(true);
      this.subs.clear();
      this.listeners.forEach((_set, dest) => this.attach(dest));
    };
    client.onWebSocketClose = () => this.setConnected(false);
    client.onStompError = () => this.setConnected(false);
    this.client = client;
    client.activate();
  }

  private attach(destination: string) {
    if (!this.client || !this.connected || this.subs.has(destination)) return;
    const sub = this.client.subscribe(destination, (msg: IMessage) => {
      let body: unknown = msg.body;
      try { body = JSON.parse(msg.body); } catch { /* plain text frame */ }
      this.listeners.get(destination)?.forEach((fn) => fn(body));
    });
    this.subs.set(destination, sub);
  }

  subscribe(destination: string, fn: Listener): () => void {
    this.retain();
    let set = this.listeners.get(destination);
    if (!set) {
      set = new Set();
      this.listeners.set(destination, set);
    }
    set.add(fn);
    void this.ensureClient().then(() => this.attach(destination));

    return () => {
      const current = this.listeners.get(destination);
      current?.delete(fn);
      if (current && current.size === 0) {
        this.listeners.delete(destination);
        const sub = this.subs.get(destination);
        if (sub && this.connected) {
          try { sub.unsubscribe(); } catch { /* socket already gone */ }
        }
        this.subs.delete(destination);
      }
      this.release();
    };
  }

  publish(destination: string, body: unknown): boolean {
    if (!this.client || !this.connected) return false;
    this.client.publish({ destination, body: JSON.stringify(body) });
    return true;
  }

  /** Called after login/logout so the handshake picks up the new auth cookie. */
  reconnect() {
    const c = this.client;
    this.client = null;
    this.subs.clear();
    this.setConnected(false);
    if (c) void c.deactivate();
    if (this.listeners.size > 0) void this.ensureClient();
  }

  private retain() {
    this.refCount += 1;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private release() {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      // Grace period avoids reconnect churn during route transitions.
      this.stopTimer = setTimeout(() => {
        if (this.refCount === 0 && this.client) {
          void this.client.deactivate();
          this.client = null;
          this.subs.clear();
          this.setConnected(false);
        }
      }, 5000);
    }
  }
}

export const stomp = new StompManager();
