/**
 * Zero-patch runtime CDP injector for agy-ctx-ring.
 *
 * Connects to Antigravity's main workbench page (`https://127.0.0.1:<port>/...`)
 * when launched with `--remote-debugging-port=0` (e.g. via `~/Applications/Antigravity (HUD).app`),
 * mounts the DSH-style 3-segment bottom status bar beneath the composer, and pushes live metrics every 1.5s.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildInjectedScript } from './ui_shared.mjs';

function getDevToolsPortFile() {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort');
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Antigravity', 'DevToolsActivePort');
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'Antigravity', 'DevToolsActivePort');
}

function readActivePort(portFile) {
  if (!existsSync(portFile)) return null;
  try {
    const first = readFileSync(portFile, 'utf8').split(/\r?\n/)[0]?.trim();
    const port = Number(first);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
  } catch {
    return null;
  }
}

async function pickMainPageWsUrl(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) return null;
  const targets = await res.json();
  if (!Array.isArray(targets)) return null;

  const candidates = targets.filter((t) => {
    if (!t || t.type !== 'page' || typeof t.webSocketDebuggerUrl !== 'string') return false;
    const u = String(t.url || '');
    return /^https?:\/\/(127\.0\.0\.1|localhost):\d+\//i.test(u);
  });
  if (candidates.length === 0) return null;

  const preferred =
    candidates.find((t) => /\/c\/[0-9a-f-]{8,}/i.test(String(t.url || ''))) ||
    candidates.find((t) => /antigravity/i.test(String(t.title || '')));
  return (preferred || candidates[0]).webSocketDebuggerUrl;
}

class CdpSession {
  #ws = null;
  #nextId = 1;
  #pending = new Map();
  #closed = false;

  constructor(wsUrl, onClose, onEvent = null) {
    this.wsUrl = wsUrl;
    this.onClose = onClose;
    this.onEvent = onEvent;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.#ws = ws;
      const openTimer = setTimeout(() => {
        try { ws.close(); } catch {}
        reject(new Error('CDP WebSocket open timeout'));
      }, 3000);

      ws.addEventListener('open', () => {
        clearTimeout(openTimer);
        resolve();
      });

      ws.addEventListener('message', (ev) => {
        let msg;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (msg && typeof msg.id === 'number' && this.#pending.has(msg.id)) {
          const entry = this.#pending.get(msg.id);
          this.#pending.delete(msg.id);
          clearTimeout(entry.timer);
          if (msg.error) entry.reject(new Error(msg.error.message || 'CDP error'));
          else entry.resolve(msg.result);
        } else if (msg && typeof msg.method === 'string') {
          try {
            this.onEvent?.(msg.method, msg.params);
          } catch {}
        }
      });

      const handleDisconnect = () => {
        clearTimeout(openTimer);
        for (const entry of this.#pending.values()) {
          clearTimeout(entry.timer);
          entry.reject(new Error('CDP disconnected'));
        }
        this.#pending.clear();
        if (!this.#closed) {
          this.#closed = true;
          this.onClose?.();
        }
      };

      ws.addEventListener('close', handleDisconnect);
      ws.addEventListener('error', (err) => {
        clearTimeout(openTimer);
        reject(err instanceof Error ? err : new Error('CDP WebSocket error'));
        handleDisconnect();
      });
    });
  }

  send(method, params = {}) {
    if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('CDP not open'));
    }
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 4000);
      this.#pending.set(id, { resolve, reject, timer });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJs(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });
    return res?.result?.value;
  }

  close() {
    this.#closed = true;
    for (const entry of this.#pending.values()) {
      clearTimeout(entry.timer);
    }
    this.#pending.clear();
    try {
      this.#ws?.close();
    } catch {}
  }
}

export function startCdpInjector({ readMetrics, readRecentMetrics }) {
  const portFile = getDevToolsPortFile();
  const injectedBundle = buildInjectedScript();

  const status = {
    connected: false,
    mounted: false,
    activeConversationId: '',
    port: null,
  };

  let session = null;
  let timer = null;
  let preloadTimer = null;
  let stopped = false;
  let busy = false;
  let rerunRequested = false;
  let lastPushedSig = '';
  let nextReconnectAt = 0;

  function requestImmediateTick() {
    if (stopped) return;
    if (busy) {
      rerunRequested = true;
      return;
    }
    tick();
  }

  function schedulePreload(targetSession) {
    if (preloadTimer) {
      clearTimeout(preloadTimer);
      preloadTimer = null;
    }
    if (typeof readRecentMetrics !== 'function') return;
    preloadTimer = setTimeout(async () => {
      preloadTimer = null;
      if (stopped || session !== targetSession) return;
      try {
        const map = readRecentMetrics(40);
        if (stopped || session !== targetSession) return;
        await targetSession.evalJs(`window.__agyCtxRing && window.__agyCtxRing.preload(${JSON.stringify(map)})`);
      } catch {}
    }, 30);
  }

  async function ensureConnected() {
    if (session) return true;
    if (Date.now() < nextReconnectAt) return false;

    const port = readActivePort(portFile);
    if (!port) {
      status.port = null;
      nextReconnectAt = Date.now() + 3000;
      return false;
    }

    try {
      const wsUrl = await pickMainPageWsUrl(port);
      if (!wsUrl) {
        nextReconnectAt = Date.now() + 3000;
        return false;
      }

      const next = new CdpSession(
        wsUrl,
        () => {
          if (session === next) session = null;
          status.connected = false;
          status.mounted = false;
          lastPushedSig = '';
          nextReconnectAt = Date.now() + 3000;
        },
        (method, params) => {
          if (method === 'Runtime.bindingCalled' && params?.name === '__agyCtxRingNotify') {
            requestImmediateTick();
          }
        }
      );
      await next.connect();
      try {
        await next.send('Runtime.enable');
        await next.send('Runtime.addBinding', { name: '__agyCtxRingNotify' });
      } catch {}
      await next.evalJs(injectedBundle);
      session = next;
      status.connected = true;
      status.port = port;
      lastPushedSig = '';
      schedulePreload(next);
      return true;
    } catch {
      status.connected = false;
      status.mounted = false;
      nextReconnectAt = Date.now() + 3000;
      return false;
    }
  }

  async function tick() {
    if (stopped || busy) return;
    busy = true;
    try {
      const ok = await ensureConnected();
      if (!ok || !session) return;

      let ctx = await session.evalJs(
        'window.__agyCtxRing ? window.__agyCtxRing.getContext() : { needBootstrap: true }'
      );
      if (!ctx || ctx.needBootstrap) {
        await session.evalJs(injectedBundle);
        ctx = await session.evalJs(
          'window.__agyCtxRing ? window.__agyCtxRing.getContext() : { mounted: false, conversationId: "" }'
        );
        lastPushedSig = '';
        schedulePreload(session);
      }

      status.mounted = Boolean(ctx?.mounted);
      status.activeConversationId = typeof ctx?.conversationId === 'string' ? ctx.conversationId : '';

      const metrics = readMetrics(status.activeConversationId);
      const sig = JSON.stringify({
        c: metrics.conversationId,
        u: metrics.usedTokens,
        l: metrics.limitTokens,
        m: metrics.model,
        t: metrics.turns,
        s: metrics.steps,
        mt: Math.round(metrics.modelTimeSec),
        tt: Math.round(metrics.toolTimeSec),
        dt: metrics.decodeTps ? Math.round(metrics.decodeTps) : 0,
        tot: metrics.totalTokens,
        mtok: metrics.mainTotalTokens || 0,
        sc: metrics.subagentCount || 0,
        st: metrics.subagentTotalTokens || 0,
        sr: metrics.subagentRequestCount || 0,
        lc: metrics.lastCacheTokens,
        cc: metrics.cumCacheTokens,
        r: metrics.requestCount,
        cp: metrics.compactedCount || 0,
        cs: metrics.lastCacheColdReason || '',
        b: Array.isArray(metrics.breakdown) ? metrics.breakdown.map((x) => x.tokens) : [],
      });

      if (sig !== lastPushedSig) {
        lastPushedSig = sig;
        await session.evalJs(`window.__agyCtxRing && window.__agyCtxRing.update(${JSON.stringify(metrics)})`);
      }
    } catch {
      if (session) {
        session.close();
        session = null;
      }
      status.connected = false;
      status.mounted = false;
      nextReconnectAt = Date.now() + 3000;
    } finally {
      busy = false;
      if (rerunRequested && !stopped) {
        rerunRequested = false;
        tick();
      }
    }
  }

  timer = setInterval(tick, 1500);
  tick();

  return {
    getStatus: () => ({ ...status }),
    stop: async () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (preloadTimer) {
        clearTimeout(preloadTimer);
        preloadTimer = null;
      }
      if (session) {
        try {
          await session.evalJs('window.__agyCtxRing && window.__agyCtxRing.unmount && window.__agyCtxRing.unmount()');
        } catch {}
        session.close();
        session = null;
      }
      status.connected = false;
      status.mounted = false;
    },
  };
}
