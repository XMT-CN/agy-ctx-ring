/**
 * Zero-patch runtime CDP injector for agy-ctx-ring.
 *
 * Connects to Antigravity's workbench pages (`https://127.0.0.1:<port>/...`)
 * when launched with `--remote-debugging-port=0`, mounts a DSH-style 3-segment
 * bottom status bar inside every visible composer pane (single view, multi-pane grid,
 * and multi-window), and pushes live metrics every 1.5s or immediately on binding notify.
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

async function listMainPageTargets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) return [];
  const targets = await res.json();
  if (!Array.isArray(targets)) return [];

  const out = [];
  for (const t of targets) {
    if (!t || t.type !== 'page' || typeof t.webSocketDebuggerUrl !== 'string') continue;
    const url = String(t.url || '');
    if (!/^https?:\/\/(127\.0\.0\.1|localhost):\d+\//i.test(url)) continue;
    out.push({
      id: String(t.id || t.webSocketDebuggerUrl),
      wsUrl: t.webSocketDebuggerUrl,
      url,
    });
  }
  return out;
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

export function computeMetricsSig(metrics) {
  return JSON.stringify({
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
}

export function startCdpInjector({ readMetrics, readRecentMetrics }) {
  const portFile = getDevToolsPortFile();
  const injectedBundle = buildInjectedScript();

  const status = {
    connected: false,
    mounted: false,
    mountedCount: 0,
    activeConversationId: '',
    activeConversationIds: [],
    windowCount: 0,
    port: null,
  };

  const entries = new Map();
  let timer = null;
  let stopped = false;
  let busy = false;
  let rerunRequested = false;
  let nextDiscoverAt = 0;

  function requestImmediateTick() {
    if (stopped) return;
    if (busy) {
      rerunRequested = true;
      return;
    }
    tick();
  }

  function closeEntry(entry) {
    if (!entry) return;
    if (entry.preloadTimer) {
      clearTimeout(entry.preloadTimer);
      entry.preloadTimer = null;
    }
    entries.delete(entry.id);
    try {
      entry.session?.close();
    } catch {}
  }

  function clearAllEntries() {
    for (const entry of [...entries.values()]) {
      closeEntry(entry);
    }
  }

  function schedulePreload(entry) {
    if (entry.preloadTimer) {
      clearTimeout(entry.preloadTimer);
      entry.preloadTimer = null;
    }
    if (typeof readRecentMetrics !== 'function') return;
    entry.preloadTimer = setTimeout(async () => {
      entry.preloadTimer = null;
      if (stopped || entries.get(entry.id) !== entry) return;
      try {
        const map = readRecentMetrics(40);
        if (stopped || entries.get(entry.id) !== entry) return;
        await entry.session.evalJs(`window.__agyCtxRing && window.__agyCtxRing.preload(${JSON.stringify(map)})`);
      } catch {}
    }, 30);
  }

  async function ensureTargetsSynced() {
    const port = readActivePort(portFile);
    if (!port) {
      clearAllEntries();
      status.port = null;
      status.connected = false;
      status.mounted = false;
      status.mountedCount = 0;
      status.activeConversationId = '';
      status.activeConversationIds = [];
      status.windowCount = 0;
      nextDiscoverAt = Date.now() + 3000;
      return false;
    }
    status.port = port;

    if (entries.size > 0 && Date.now() < nextDiscoverAt) {
      return true;
    }
    if (entries.size === 0 && Date.now() < nextDiscoverAt) {
      return false;
    }

    try {
      const targets = await listMainPageTargets(port);
      nextDiscoverAt = Date.now() + (targets.length > 0 ? 4500 : 3000);

      const targetById = new Map(targets.map((t) => [t.id, t]));
      for (const [id, entry] of [...entries.entries()]) {
        const t = targetById.get(id);
        if (!t || t.wsUrl !== entry.wsUrl) {
          closeEntry(entry);
        }
      }

      for (const t of targets) {
        if (stopped) break;
        if (entries.has(t.id)) continue;

        const entry = {
          id: t.id,
          wsUrl: t.wsUrl,
          session: null,
          lastSigByConv: new Map(),
          preloadTimer: null,
        };
        const session = new CdpSession(
          t.wsUrl,
          () => {
            if (entries.get(entry.id) === entry) {
              if (entry.preloadTimer) {
                clearTimeout(entry.preloadTimer);
                entry.preloadTimer = null;
              }
              entries.delete(entry.id);
              nextDiscoverAt = 0;
            }
          },
          (method, params) => {
            if (method === 'Runtime.bindingCalled' && params?.name === '__agyCtxRingNotify') {
              requestImmediateTick();
            }
          }
        );
        entry.session = session;
        try {
          await session.connect();
          try {
            await session.send('Runtime.enable');
            await session.send('Runtime.addBinding', { name: '__agyCtxRingNotify' });
          } catch {}
          await session.evalJs(injectedBundle);
          entries.set(entry.id, entry);
          schedulePreload(entry);
        } catch {
          session.close();
        }
      }
    } catch {
      nextDiscoverAt = Date.now() + 3000;
    }

    return entries.size > 0;
  }

  async function tick() {
    if (stopped || busy) return;
    busy = true;
    try {
      const hasTargets = await ensureTargetsSynced();
      if (!hasTargets || entries.size === 0) {
        status.connected = false;
        status.mounted = false;
        status.mountedCount = 0;
        status.activeConversationId = '';
        status.activeConversationIds = [];
        status.windowCount = 0;
        return;
      }

      let anyConnected = false;
      let anyMounted = false;
      let totalMounted = 0;
      const allConvIds = [];
      const seenConvSet = new Set();

      for (const entry of [...entries.values()]) {
        if (stopped) break;
        try {
          let ctx = await entry.session.evalJs(
            'window.__agyCtxRing ? window.__agyCtxRing.getContext() : { needBootstrap: true }'
          );
          if (!ctx || ctx.needBootstrap) {
            await entry.session.evalJs(injectedBundle);
            ctx = await entry.session.evalJs(
              'window.__agyCtxRing ? window.__agyCtxRing.getContext() : { mounted: false, mountedCount: 0, conversationId: "", conversationIds: [] }'
            );
            entry.lastSigByConv.clear();
            schedulePreload(entry);
          }

          anyConnected = true;
          const mCount = Number(ctx?.mountedCount) || (ctx?.mounted ? 1 : 0);
          totalMounted += mCount;
          if (ctx?.mounted || mCount > 0) anyMounted = true;

          const rawIds = Array.isArray(ctx?.conversationIds)
            ? ctx.conversationIds
            : (typeof ctx?.conversationId === 'string' && ctx.conversationId ? [ctx.conversationId] : []);
          const convIds = [];
          const convSet = new Set();
          for (const rawId of rawIds) {
            const cid = typeof rawId === 'string' ? rawId.trim() : '';
            if (cid && !convSet.has(cid)) {
              convSet.add(cid);
              convIds.push(cid);
              if (!seenConvSet.has(cid)) {
                seenConvSet.add(cid);
                allConvIds.push(cid);
              }
            }
          }

          for (const prevCid of [...entry.lastSigByConv.keys()]) {
            if (!convSet.has(prevCid)) {
              entry.lastSigByConv.delete(prevCid);
            }
          }

          const changedMap = Object.create(null);
          let changedCount = 0;
          for (const cid of convIds) {
            const metrics = readMetrics(cid);
            const sig = computeMetricsSig(metrics);
            if (entry.lastSigByConv.get(cid) !== sig) {
              entry.lastSigByConv.set(cid, sig);
              changedMap[cid] = metrics;
              changedCount += 1;
            }
          }

          if (changedCount > 0) {
            await entry.session.evalJs(
              `window.__agyCtxRing && window.__agyCtxRing.updateMany(${JSON.stringify(changedMap)})`
            );
          }
        } catch {
          closeEntry(entry);
          nextDiscoverAt = 0;
        }
      }

      status.connected = anyConnected;
      status.mounted = anyMounted;
      status.mountedCount = totalMounted;
      status.activeConversationIds = allConvIds;
      status.activeConversationId = allConvIds[0] || '';
      status.windowCount = entries.size;
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
    getStatus: () => ({ ...status, activeConversationIds: [...status.activeConversationIds] }),
    stop: async () => {
      stopped = true;
      if (timer) clearInterval(timer);
      for (const entry of [...entries.values()]) {
        if (entry.preloadTimer) {
          clearTimeout(entry.preloadTimer);
          entry.preloadTimer = null;
        }
        try {
          await entry.session?.evalJs('window.__agyCtxRing && window.__agyCtxRing.unmount && window.__agyCtxRing.unmount()');
        } catch {}
        try {
          entry.session?.close();
        } catch {}
      }
      entries.clear();
      status.connected = false;
      status.mounted = false;
      status.mountedCount = 0;
      status.activeConversationId = '';
      status.activeConversationIds = [];
      status.windowCount = 0;
    },
  };
}
