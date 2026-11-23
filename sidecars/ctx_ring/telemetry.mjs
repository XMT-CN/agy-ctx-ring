/**
 * Read-only Antigravity telemetry reader for agy-ctx-ring.
 *
 * Reads ground-truth context usage, model display name, TTFT + streaming decode speed,
 * token totals, turns/steps, and wall-clock tool call duration from per-conversation
 * SQLite (`gen_metadata` + `steps`), and derives the 4-category breakdown (`^ 构成`)
 * from `transcript.jsonl`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const AGY_ROOT = join(homedir(), '.gemini', 'antigravity');
const CONVERSATIONS_DIR = join(AGY_ROOT, 'conversations');
const BRAIN_DIR = join(AGY_ROOT, 'brain');
const SUMMARIES_DB = join(AGY_ROOT, 'conversation_summaries.db');

export const ID_RE = /^[0-9a-f-]{8,}$/i;
const DEFAULT_LIMIT = 512000;

const STEP_USER_INPUT = 14;
const STEP_PLANNER_RESPONSE = 15;
const STEP_CHECKPOINT = 23;
const STEP_TOOL_GENERIC = 132;

const TOP_WANT = new Set([1]);
const META_WANT = new Set([4, 9, 11, 12, 19, 21]);
const USAGE_WANT = new Set([2, 3, 5, 9, 10]);
const CTX_PARENT_WANT = new Set([1, 10]);
const CTX_WANT = new Set([1, 3, 4]);
const DUR_WANT = new Set([1, 2]);
const STEP_TIME_WANT = new Set([1, 8, 32]);

const dbCache = new Map();
const transcriptCache = new Map();

/**
 * Fast wire-level protobuf field scanner that skips unneeded length-delimited blobs
 * (e.g. multi-megabyte prompt payloads) without allocating sub-buffers.
 */
export function readFields(buf, wantSet = null) {
  const out = Object.create(null);
  if (!buf || buf.length === 0) return out;
  let o = 0;
  const len = buf.length;

  const readVarint = () => {
    let v = 0n;
    let s = 0n;
    while (o < len) {
      const b = buf[o++];
      v |= BigInt(b & 0x7f) << s;
      if ((b & 0x80) === 0) {
        return v > BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : Number(v);
      }
      s += 7n;
      if (s > 63n) break;
    }
    return 0;
  };

  while (o < len) {
    const tag = readVarint();
    const fn = Math.floor(tag / 8);
    const wire = tag & 7;
    if (fn <= 0) break;

    if (wire === 0) {
      const v = readVarint();
      if (!wantSet || wantSet.has(fn)) out[fn] = v;
    } else if (wire === 1) {
      if (o + 8 > len) break;
      o += 8;
    } else if (wire === 5) {
      if (o + 4 > len) break;
      o += 4;
    } else if (wire === 2) {
      const blen = readVarint();
      if (blen < 0 || o + blen > len) break;
      if (!wantSet || wantSet.has(fn)) {
        out[fn] = buf.subarray(o, o + blen);
      }
      o += blen;
    } else {
      break;
    }
  }
  return out;
}

function readAllFields(buf) {
  const out = [];
  if (!buf || buf.length === 0) return out;
  let o = 0;
  const len = buf.length;
  const readVarint = () => {
    let v = 0n;
    let s = 0n;
    while (o < len) {
      const b = buf[o++];
      v |= BigInt(b & 0x7f) << s;
      if ((b & 0x80) === 0) {
        return v > BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : Number(v);
      }
      s += 7n;
      if (s > 63n) break;
    }
    return 0;
  };
  while (o < len) {
    const tag = readVarint();
    const fn = Math.floor(tag / 8);
    const wire = tag & 7;
    if (fn <= 0) break;
    if (wire === 0) {
      out.push([fn, 'v', readVarint()]);
    } else if (wire === 1) {
      if (o + 8 > len) break;
      o += 8;
    } else if (wire === 5) {
      if (o + 4 > len) break;
      o += 4;
    } else if (wire === 2) {
      const blen = readVarint();
      if (blen < 0 || o + blen > len) break;
      out.push([fn, 'b', buf.subarray(o, o + blen)]);
      o += blen;
    } else {
      break;
    }
  }
  return out;
}

export function decodeDuration(buf) {
  if (!buf || buf.length === 0) return null;
  const f = readFields(buf, DUR_WANT);
  const sec = Number(f[1] || 0);
  const nanos = Number(f[2] || 0);
  const total = sec + nanos / 1e9;
  return Number.isFinite(total) && total >= 0 ? total : null;
}

function decodeTimestamp(buf) {
  if (!buf || buf.length === 0) return null;
  const f = readFields(buf, DUR_WANT);
  const sec = Number(f[1] || 0);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  const nanos = Number(f[2] || 0);
  return sec + nanos / 1e9;
}

function decodeUtf8(buf) {
  if (!buf || buf.length === 0) return '';
  try {
    return Buffer.from(buf).toString('utf8').trim();
  } catch {
    return '';
  }
}

function sumMergedIntervals(intervals) {
  if (!intervals || intervals.length === 0) return 0;
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = intervals[0][0];
  let curEnd = intervals[0][1];
  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i];
    if (s <= curEnd) {
      if (e > curEnd) curEnd = e;
    } else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return total;
}

export function classifyTier(pct) {
  if (pct >= 85) {
    return { id: 'crit', label: '接近上限' };
  }
  if (pct >= 60) {
    return { id: 'warn', label: '占用偏高' };
  }
  return { id: 'ok', label: '正常' };
}

function statSafe(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

export function listRecentConversations(limit = 10) {
  if (!existsSync(SUMMARIES_DB)) return [];
  let db;
  try {
    db = new DatabaseSync(SUMMARIES_DB, { readOnly: true });
    const rows = db
      .prepare(
        `SELECT conversation_id, title, last_modified_time
         FROM conversation_summaries
         ORDER BY last_modified_time DESC
         LIMIT ?`
      )
      .all(limit);
    return rows
      .filter((r) => ID_RE.test(r.conversation_id) && existsSync(join(CONVERSATIONS_DIR, `${r.conversation_id}.db`)))
      .map((r) => ({
        id: r.conversation_id,
        title: (r.title || '').trim() || r.conversation_id.slice(0, 8),
        lastModifiedTime: r.last_modified_time,
      }));
  } catch {
    return [];
  } finally {
    try {
      db?.close();
    } catch {}
  }
}

export function resolveConversationId(preferredId = '') {
  if (typeof preferredId === 'string' && ID_RE.test(preferredId.trim())) {
    const clean = preferredId.trim();
    if (existsSync(join(CONVERSATIONS_DIR, `${clean}.db`))) return clean;
  }

  const recent = listRecentConversations(1);
  if (recent.length > 0) return recent[0].id;

  try {
    const entries = readdirSync(CONVERSATIONS_DIR)
      .filter((n) => n.endsWith('.db'))
      .map((n) => {
        const id = n.slice(0, -3);
        const st = statSafe(join(CONVERSATIONS_DIR, n));
        return { id, mtimeMs: st ? st.mtimeMs : 0 };
      })
      .filter((e) => ID_RE.test(e.id))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (entries.length > 0) return entries[0].id;
  } catch {}
  return '';
}

function scaleBucketsToTotal(counts, targetTotal) {
  const safe = counts.map((v) => Math.max(0, Number(v) || 0));
  const rawSum = safe.reduce((acc, v) => acc + v, 0);
  if (targetTotal <= 0) return safe.map(() => 0);
  const goal = Math.round(targetTotal);
  if (rawSum <= 0) {
    const out = safe.map(() => 0);
    out[0] = goal;
    return out;
  }
  const scale = goal / rawSum;
  const scaled = safe.map((v) => Math.round(v * scale));
  let diff = goal - scaled.reduce((acc, v) => acc + v, 0);
  if (diff > 0) {
    let maxIdx = 0;
    for (let i = 1; i < scaled.length; i++) {
      if (scaled[i] > scaled[maxIdx]) maxIdx = i;
    }
    scaled[maxIdx] += diff;
  } else if (diff < 0) {
    let rem = -diff;
    const order = scaled.map((_, i) => i).sort((a, b) => scaled[b] - scaled[a]);
    for (const idx of order) {
      if (rem <= 0) break;
      const take = Math.min(rem, scaled[idx]);
      scaled[idx] -= take;
      rem -= take;
    }
  }
  return scaled;
}

function buildBreakdownItems(tokensArr, usedTokens) {
  const denom = usedTokens > 0 ? usedTokens : tokensArr.reduce((a, b) => a + b, 0);
  const toPct = (v) => (denom > 0 ? (v / denom) * 100 : 0);
  const defs = [
    ['system', '系统提示与规则'],
    ['injected', '子智能体与系统消息'],
    ['tools', '工具调用与输出'],
    ['model', '模型思考与回复'],
    ['user', '用户输入'],
  ];
  return defs.map(([key, label], i) => ({
    key,
    label,
    tokens: tokensArr[i] || 0,
    pct: toPct(tokensArr[i] || 0),
  }));
}

function decodeNativeBreakdown(ctx3Buf) {
  if (!ctx3Buf || ctx3Buf.length === 0) return null;
  const entries = readAllFields(ctx3Buf);
  let systemTok = 0;
  let injectedTok = 0;
  let toolsTok = 0;
  let modelTok = 0;
  let userTok = 0;
  let compacted = false;

  for (const [fn, wt, val] of entries) {
    if (fn !== 1 || wt !== 'b') continue;
    const subs = readAllFields(val);
    let secName = '';
    let typeId = 0;
    let secTok = 0;
    const childBufs = [];

    for (const [sf, swt, sv] of subs) {
      if (sf === 1 && swt === 'b') secName = decodeUtf8(sv);
      else if (sf === 2 && swt === 'v') typeId = Number(sv || 0);
      else if (sf === 4 && swt === 'v') secTok = Number(sv || 0);
      else if (sf === 5 && swt === 'b') childBufs.push(sv);
    }

    if (typeId === 7 || secName === 'Chat Messages') {
      let childrenSum = 0;
      for (const cb of childBufs) {
        const ch = readAllFields(cb);
        let label = '';
        let ctok = 0;
        for (const [cf, cwt, cv] of ch) {
          if (cf === 1 && cwt === 'b') label = decodeUtf8(cv);
          else if (cf === 3 && cwt === 'v') ctok = Number(cv || 0);
        }
        if (ctok <= 0) continue;
        childrenSum += ctok;
        const idxColon = label.indexOf(': ');
        const stepName = (idxColon >= 0 ? label.slice(idxColon + 2) : label).trim();
        if (stepName === 'USER_INPUT') {
          userTok += ctok;
        } else if (stepName === 'PLANNER_RESPONSE') {
          modelTok += ctok;
        } else if (
          stepName === 'SYSTEM_MESSAGE' ||
          stepName === 'CHECKPOINT' ||
          stepName === 'ERROR_MESSAGE' ||
          stepName === 'EPHEMERAL_MESSAGE'
        ) {
          injectedTok += ctok;
          if (stepName === 'CHECKPOINT') compacted = true;
        } else {
          toolsTok += ctok;
        }
      }
      if (secTok > childrenSum) {
        const rem = secTok - childrenSum;
        if (childrenSum > 0) toolsTok += rem;
        else injectedTok += rem;
      }
    } else {
      systemTok += secTok;
    }
  }

  const total = systemTok + injectedTok + toolsTok + modelTok + userTok;
  if (total <= 0) return null;
  return { total, systemTok, injectedTok, toolsTok, modelTok, userTok, compacted };
}

function formatNativeBreakdown(native, usedTokens) {
  const scaled = scaleBucketsToTotal(
    [native.systemTok, native.injectedTok, native.toolsTok, native.modelTok, native.userTok],
    usedTokens
  );
  return {
    compacted: Boolean(native.compacted),
    items: buildBreakdownItems(scaled, usedTokens),
  };
}

export function readTranscriptBreakdown(conversationId, usedTokens, hints = {}) {
  const empty = {
    compacted: false,
    items: buildBreakdownItems([usedTokens, 0, 0, 0, 0], usedTokens),
  };

  if (!conversationId || !ID_RE.test(conversationId)) return empty;
  const logsDir = join(BRAIN_DIR, conversationId, '.system_generated', 'logs');
  const fullPath = join(logsDir, 'transcript_full.jsonl');
  const compactPath = join(logsDir, 'transcript.jsonl');
  const logPath = existsSync(fullPath) ? fullPath : compactPath;
  const st = statSafe(logPath);
  if (!st) return empty;

  const cacheKey = `${logPath}:${st.mtimeMs}:${st.size}`;
  let parsed = transcriptCache.get(logPath);
  if (!parsed || parsed.key !== cacheKey) {
    let injectedChars = 0;
    let toolsChars = 0;
    let replyChars = 0;
    let thinkingChars = 0;
    let userChars = 0;
    let compacted = false;

    try {
      const raw = readFileSync(logPath, 'utf8');
      const lines = raw.split('\n');
      for (const ln of lines) {
        if (!ln) continue;
        let obj;
        try {
          obj = JSON.parse(ln);
        } catch {
          continue;
        }
        const t = obj.type;
        const contentLen = typeof obj.content === 'string' ? obj.content.length : 0;
        if (t === 'CHECKPOINT') {
          toolsChars = 0;
          replyChars = 0;
          thinkingChars = 0;
          userChars = 0;
          injectedChars = contentLen;
          compacted = true;
          continue;
        }
        if (t === 'USER_INPUT') {
          userChars += contentLen;
        } else if (t === 'PLANNER_RESPONSE') {
          replyChars += contentLen;
          thinkingChars += typeof obj.thinking === 'string' ? obj.thinking.length : 0;
          if (Array.isArray(obj.tool_calls) && obj.tool_calls.length > 0) {
            try {
              toolsChars += JSON.stringify(obj.tool_calls).length;
            } catch {}
          }
        } else if (t === 'SYSTEM_MESSAGE' || t === 'ERROR_MESSAGE' || t === 'EPHEMERAL_MESSAGE') {
          injectedChars += contentLen;
        } else {
          toolsChars += contentLen;
        }
      }
    } catch {}

    parsed = { key: cacheKey, injectedChars, toolsChars, replyChars, thinkingChars, userChars, compacted };
    transcriptCache.set(logPath, parsed);
    if (transcriptCache.size > 128) {
      const oldest = transcriptCache.keys().next().value;
      transcriptCache.delete(oldest);
    }
  }

  if (usedTokens <= 0) {
    return { ...empty, compacted: parsed.compacted };
  }

  const CHARS_PER_TOKEN = 2.4;
  const injectedEst = Math.round(parsed.injectedChars / CHARS_PER_TOKEN);
  const toolsEst = Math.round(parsed.toolsChars / CHARS_PER_TOKEN);
  const replyEst = Math.round(parsed.replyChars / CHARS_PER_TOKEN);
  const thinkingLogEst = Math.round(parsed.thinkingChars / CHARS_PER_TOKEN);
  const thinkingApi = Math.max(0, Number(hints.thinkingSinceCompaction) || 0);
  const modelEst = replyEst + Math.max(thinkingLogEst, thinkingApi);
  const userEst = Math.round(parsed.userChars / CHARS_PER_TOKEN);

  const rawHeader = Number(hints.initialHeaderTokens);
  const baseline = Number.isFinite(rawHeader) && rawHeader > 0 ? rawHeader : 30000;
  const otherSum = injectedEst + toolsEst + modelEst + userEst;
  const systemEst = otherSum > 0 ? Math.min(usedTokens, Math.max(0, baseline)) : usedTokens;

  const scaled = scaleBucketsToTotal([systemEst, injectedEst, toolsEst, modelEst, userEst], usedTokens);
  return {
    compacted: parsed.compacted,
    items: buildBreakdownItems(scaled, usedTokens),
  };
}

function readDbRowsCached(conversationId) {
  const dbPath = join(CONVERSATIONS_DIR, `${conversationId}.db`);
  const st = statSafe(dbPath);
  if (!st) return null;

  const walSt = statSafe(`${dbPath}-wal`);
  const cacheSig = `${st.mtimeMs}:${st.size}:${walSt ? `${walSt.mtimeMs}:${walSt.size}` : '0'}`;
  const cached = dbCache.get(dbPath);
  if (cached && cached.sig === cacheSig) return cached.data;

  let db;
  let gmRows = [];
  let stepRows = [];
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const tables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name)
    );
    if (tables.has('gen_metadata')) {
      gmRows = db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();
    }
    if (tables.has('steps')) {
      stepRows = db.prepare('SELECT step_type, metadata FROM steps').all();
    }
  } catch {
    return cached?.data || null;
  } finally {
    try {
      db?.close();
    } catch {}
  }

  let latestUsedTokens = 0;
  let latestLimitTokens = DEFAULT_LIMIT;
  let latestModel = '';
  let latestInput = 0;
  let latestCacheRead = 0;
  let latestCtx3Buf = null;
  let firstHeaderTokens = 0;
  let lastCpStart = 0;
  let compactedCount = 0;
  let thinkingSinceCompaction = 0;
  let prevReqModel = '';
  let lastCacheColdStart = false;
  let lastCacheColdReason = '';

  let totalUncachedInput = 0;
  let totalCacheRead = 0;
  let totalOutput = 0;

  let modelTimeSec = 0;
  let sumTtft = 0;
  let ttftCount = 0;
  let sumStreamOutput = 0;
  let sumStreaming = 0;
  let lastTps = null;
  let lastDecodeTps = null;
  let totalOutputForSpeed = 0;
  let totalDurationForSpeed = 0;
  let requestCount = 0;

  for (const r of gmRows) {
    const top = readFields(r.data, TOP_WANT);
    if (!top[1]) continue;
    const m = readFields(top[1], META_WANT);
    const u = m[4] ? readFields(m[4], USAGE_WANT) : {};
    const c9 = m[9] ? readFields(m[9], CTX_PARENT_WANT) : {};
    const ctx = c9[10] ? readFields(c9[10], CTX_WANT) : {};

    const input = Number(u[2] || 0);
    const output = Number(u[3] || 0);
    const cacheRead = Number(u[5] || 0);
    const thinkingOut = Number(u[9] || 0);
    const ctxUsed = Number(ctx[1] || 0);
    const ctxCap = Number(ctx[4] || 0);
    const cpStart = Number(c9[1] || 0);

    const ttft = m[11] ? decodeDuration(m[11]) : null;
    const streaming = m[12] ? decodeDuration(m[12]) : null;
    const duration = ttft !== null && streaming !== null ? ttft + streaming : null;
    const modelName = decodeUtf8(m[21]) || decodeUtf8(m[19]);

    if (modelName) latestModel = modelName;
    if (ctxCap > 0) latestLimitTokens = ctxCap;

    if (!firstHeaderTokens && (ctxUsed > 0 || input + cacheRead > 0)) {
      firstHeaderTokens = ctxUsed > 0 ? ctxUsed : input + cacheRead;
    }
    if (cpStart > lastCpStart) {
      compactedCount += 1;
      lastCpStart = cpStart;
      thinkingSinceCompaction = 0;
    }
    thinkingSinceCompaction += thinkingOut;

    if (input + cacheRead > 0) {
      latestUsedTokens = input + cacheRead;
    } else if (ctxUsed > 0) {
      latestUsedTokens = ctxUsed;
    }
    if (ctx[3] && ctx[3].length > 0) {
      latestCtx3Buf = ctx[3];
    }

    if (input + cacheRead > 0 || output > 0) {
      totalUncachedInput += input;
      totalCacheRead += cacheRead;
      totalOutput += output;
    }

    if (input + cacheRead > 0) {
      if (cacheRead === 0 && requestCount > 0) {
        lastCacheColdStart = true;
        lastCacheColdReason =
          prevReqModel && modelName && prevReqModel !== modelName ? 'model_switch' : 'cold_start';
      } else {
        lastCacheColdStart = false;
        lastCacheColdReason = '';
      }
      if (modelName) prevReqModel = modelName;
      latestInput = input;
      latestCacheRead = cacheRead;
      requestCount += 1;
    }

    if (ttft !== null && ttft > 0) {
      sumTtft += ttft;
      ttftCount += 1;
    }

    if (duration !== null && duration > 0) {
      modelTimeSec += duration;
    }

    if (output > 0 && streaming !== null && streaming > 0) {
      sumStreamOutput += output;
      sumStreaming += streaming;
      lastDecodeTps = output / streaming;
    }

    if (output > 0 && duration !== null && duration > 0) {
      lastTps = output / duration;
      totalOutputForSpeed += output;
      totalDurationForSpeed += duration;
    }
  }

  let turns = 0;
  let plannerSteps = 0;
  let toolSteps = 0;
  let checkpointSteps = 0;
  const toolIntervals = [];

  for (const s of stepRows) {
    if (s.step_type === STEP_USER_INPUT) {
      turns += 1;
    } else if (s.step_type === STEP_PLANNER_RESPONSE) {
      plannerSteps += 1;
    } else if (s.step_type === STEP_CHECKPOINT) {
      checkpointSteps += 1;
    } else if (s.step_type === STEP_TOOL_GENERIC) {
      toolSteps += 1;
      if (s.metadata) {
        const sm = readFields(s.metadata, STEP_TIME_WANT);
        const tStart = decodeTimestamp(sm[1]);
        const tEnd = decodeTimestamp(sm[8]) ?? decodeTimestamp(sm[32]);
        if (tStart !== null && tEnd !== null && tEnd >= tStart && tEnd - tStart < 3600) {
          toolIntervals.push([tStart, tEnd]);
        }
      }
    }
  }
  compactedCount = Math.max(compactedCount, checkpointSteps);

  const steps = plannerSteps + toolSteps;
  const toolTimeSec = sumMergedIntervals(toolIntervals);
  const avgTtftSec = ttftCount > 0 ? sumTtft / ttftCount : null;
  const decodeTps =
    sumStreaming > 0 && sumStreamOutput > 0 ? sumStreamOutput / sumStreaming : null;
  const avgTps =
    totalOutputForSpeed > 0 && totalDurationForSpeed > 0
      ? totalOutputForSpeed / totalDurationForSpeed
      : null;

  const lastTotalIn = latestInput + latestCacheRead;
  const lastCachePct = lastTotalIn > 0 ? (latestCacheRead / lastTotalIn) * 100 : null;

  const cumTotalIn = totalUncachedInput + totalCacheRead;
  const cumCachePct = cumTotalIn > 0 ? (totalCacheRead / cumTotalIn) * 100 : null;
  const totalTokens = totalUncachedInput + totalCacheRead + totalOutput;

  const nativeBreakdown = latestCtx3Buf ? decodeNativeBreakdown(latestCtx3Buf) : null;

  const data = {
    usedTokens: latestUsedTokens,
    limitTokens: latestLimitTokens || DEFAULT_LIMIT,
    model: latestModel || '—',
    lastTps,
    avgTps,
    decodeTps,
    lastDecodeTps,
    avgTtftSec,
    modelTimeSec,
    toolTimeSec,
    turns,
    steps,
    toolSteps,
    totalTokens,
    totalUncachedInput,
    totalCacheRead,
    totalOutput,
    lastCacheTokens: latestCacheRead,
    lastCachePct,
    cumCacheTokens: totalCacheRead,
    cumCachePct,
    requestCount,
    nativeBreakdown,
    firstHeaderTokens,
    thinkingSinceCompaction,
    compactedCount,
    lastCacheColdStart,
    lastCacheColdReason,
  };

  dbCache.set(dbPath, { sig: cacheSig, data });
  if (dbCache.size > 128) {
    const oldest = dbCache.keys().next().value;
    dbCache.delete(oldest);
  }
  return data;
}

export function readConversationMetrics(conversationId, { fallbackToRecent = false } = {}) {
  const clean = typeof conversationId === 'string' ? conversationId.trim() : '';
  const resolvedId = fallbackToRecent
    ? resolveConversationId(clean)
    : (ID_RE.test(clean) ? clean : '');
  const raw = resolvedId ? readDbRowsCached(resolvedId) : null;

  const usedTokens = raw?.usedTokens || 0;
  const limitTokens = raw?.limitTokens || DEFAULT_LIMIT;
  const remainingTokens = Math.max(0, limitTokens - usedTokens);
  const usedPct = limitTokens > 0 ? Math.min(100, (usedTokens / limitTokens) * 100) : 0;
  const tier = classifyTier(usedPct);
  const breakdown =
    raw?.nativeBreakdown && usedTokens > 0
      ? formatNativeBreakdown(raw.nativeBreakdown, usedTokens)
      : readTranscriptBreakdown(resolvedId, usedTokens, {
          initialHeaderTokens: raw?.firstHeaderTokens,
          thinkingSinceCompaction: raw?.thinkingSinceCompaction,
        });
  const compacted = Boolean((raw?.compactedCount || 0) > 0 || breakdown.compacted);
  const compactedCount = raw?.compactedCount || (breakdown.compacted ? 1 : 0);

  return {
    conversationId: resolvedId,
    usedTokens,
    remainingTokens,
    limitTokens,
    usedPct,
    tier,
    model: raw?.model || '—',
    lastTps: raw?.lastTps ?? null,
    avgTps: raw?.avgTps ?? null,
    decodeTps: raw?.decodeTps ?? null,
    lastDecodeTps: raw?.lastDecodeTps ?? null,
    avgTtftSec: raw?.avgTtftSec ?? null,
    modelTimeSec: raw?.modelTimeSec || 0,
    toolTimeSec: raw?.toolTimeSec || 0,
    turns: raw?.turns || 0,
    steps: raw?.steps || 0,
    toolSteps: raw?.toolSteps || 0,
    totalTokens: raw?.totalTokens || 0,
    totalUncachedInput: raw?.totalUncachedInput || 0,
    totalCacheRead: raw?.totalCacheRead || 0,
    totalOutput: raw?.totalOutput || 0,
    lastCacheTokens: raw?.lastCacheTokens || 0,
    lastCachePct: raw?.lastCachePct ?? null,
    lastCacheColdStart: Boolean(raw?.lastCacheColdStart),
    lastCacheColdReason: raw?.lastCacheColdReason || '',
    cumCacheTokens: raw?.cumCacheTokens || 0,
    cumCachePct: raw?.cumCachePct ?? null,
    requestCount: raw?.requestCount || 0,
    compacted,
    compactedCount,
    breakdown: breakdown.items,
    updatedAt: Date.now(),
  };
}

export function readRecentConversationMetrics(limit = 40) {
  const recent = listRecentConversations(limit);
  const map = Object.create(null);
  for (const item of recent) {
    map[item.id] = readConversationMetrics(item.id);
  }
  return map;
}
